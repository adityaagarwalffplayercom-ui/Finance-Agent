import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import {
  DocumentCategory,
  DocumentReviewStatus,
  DocumentStatus,
  ExtractionRunStatus,
  WorkspaceRole,
  type Prisma,
} from "@prisma/client";
import { auth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import {
  extractDocumentData,
  type ExtractedDocumentData,
} from "@/lib/gemini";
import { syncLedgerEntriesFromDocument } from "@/lib/transaction-ledger";
import { buildFinancialSummaryText } from "@/lib/financial-text-chunks";
import { backfillFinancialStatementSummary } from "@/lib/financial-summary-backfill";
import { validateFinancialStatementSummary } from "@/lib/financial-summary-validation";
import { sanitizeFinancialStatementExtraction } from "@/lib/financial-statement-sanitizer";
import { extractFinancialStatementProduction } from "@/lib/financial-statement-extraction-engine";
import { USAGE_LIMITS, formatUsageSize } from "@/lib/usage-limits";
import {
  checkAndRecordAiProcessUsage,
  recordProcessingUsageDetails,
  releaseProcessingLock,
  tryAcquireProcessingLock,
} from "@/lib/usage-events";
import { loadDocumentBuffer } from "@/lib/object-storage";
import { estimatePdfPageCount, inspectFile } from "@/lib/file-security";
import {
  completeProcessingJob,
  enqueueDocumentProcessing,
  failProcessingJob,
  getWorkerJob,
  heartbeatProcessingJob,
} from "@/lib/processing-jobs";
import {
  AURELI_ENGINE_VERSION,
  productionConfig,
} from "@/lib/production-config";
import { finishExtractionRun, startExtractionRun } from "@/lib/extraction-runs";
import { getRequestId, logger } from "@/lib/logger";
import { requireWorkspaceRole } from "@/lib/workspace-context";
import {
  extractLineItemsFromText,
  extractLineItemsFromWorkbook,
  mergeExtractedLineItems,
  type RawFinancialLineItem,
} from "@/lib/raw-financial-line-items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const XLSX_MIME_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const PDF_MIME_TYPES = ["application/pdf"];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Processing failed for an unknown reason.";
  }
}

function cleanProcessingError(message: string) {
  return message.slice(0, 1200);
}

function isQuotaErrorMessage(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes("quota") ||
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("rate limit")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getPreviousExtractedData(
  value: unknown,
): ExtractedDocumentData | null {
  if (!isRecord(value)) {
    return null;
  }

  return value as unknown as ExtractedDocumentData;
}

async function extractPdfText(buffer: Buffer) {
  try {
    // Import the parser implementation directly. The package root executes a
    // bundled debug sample in some Next.js runtimes and tries to open
    // test/data/05-versions-space.pdf from the application working directory.
    const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
    const result = await pdfParseModule.default(buffer);

    return result.text.replace(/\u0000/g, " ").trim();
  } catch (error) {
    console.warn(
      "Deterministic PDF text extraction failed; using inline AI fallback.",
      getErrorMessage(error),
    );

    return "";
  }
}

function getSafeTextForAi(text: string) {
  return text.slice(0, USAGE_LIMITS.MAX_TEXT_CHARS_FOR_AI);
}

function getTextForAi(text: string, summaryOnly: boolean) {
  if (!summaryOnly) {
    return getSafeTextForAi(text);
  }

  return buildFinancialSummaryText(text, {
    maxChars: USAGE_LIMITS.MAX_TEXT_CHARS_FOR_AI,
  });
}

function buildDeterministicOnlyExtraction(params: {
  rawLineItems: RawFinancialLineItem[];
}): ExtractedDocumentData {
  const base: ExtractedDocumentData = {
    summary:
      "Deterministic line-item extraction completed. AI extraction did not finish, so totals may be incomplete.",
    lineItems: [],
    transactions: [],
  };

  return mergeExtractedLineItems(base, params.rawLineItems);
}

async function saveProcessedDocument(params: {
  id: string;
  userId: string;
  fileName: string;
  category: string;
  extracted: ExtractedDocumentData;
  rawLineItemCount: number;
  chunkLineItemCount?: number;
  candidateChunks?: number;
  completedChunks?: number;
  failedChunks?: number;
  summaryFieldsBackfilled?: string[];
  summaryMetricEvidence?: Record<string, string>;
}) {
  await prisma.document.update({
    where: {
      id: params.id,
    },
    data: {
      status: DocumentStatus.PROCESSED,
      extractedData: params.extracted as unknown as Prisma.InputJsonValue,
      extractedAt: new Date(),
      processingError: null,
      reviewStatus: DocumentReviewStatus.NEEDS_REVIEW,
      reviewedAt: null,
      reviewNote: null,
    },
  });

  await createAuditEvent({
    userId: params.userId,
    eventType: "DOCUMENT_PROCESSING_COMPLETED",
    title: "AI processing completed",
    description: `${params.fileName} was processed successfully and is ready for review.`,
    documentId: params.id,
    fileName: params.fileName,
    metadata: {
      category: params.category,
      status: DocumentStatus.PROCESSED,
      currency: params.extracted.currency ?? null,
      reportedUnit: params.extracted.reportedUnit ?? null,
      scaleMultiplier: params.extracted.scaleMultiplier ?? null,
      lineItemsCount: params.extracted.lineItems?.length ?? 0,
      deterministicRawLineItems: params.rawLineItemCount,
      chunkLineItems: params.chunkLineItemCount ?? 0,
      candidateChunks: params.candidateChunks ?? 0,
      completedChunks: params.completedChunks ?? 0,
      failedChunks: params.failedChunks ?? 0,
      summaryFieldsBackfilled: params.summaryFieldsBackfilled ?? [],
      summaryMetricEvidence: params.summaryMetricEvidence ?? {},
      extractionDiagnostics: params.extracted.extractionDiagnostics ?? null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/documents");
  revalidatePath(`/documents/${params.id}`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const requestId = getRequestId(request.headers);
  const workerJob = await getWorkerJob(request, id);
  const session = workerJob
    ? null
    : await auth.api.getSession({ headers: request.headers });

  if (!workerJob && !session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const actorUserId = workerJob?.userId ?? session!.user.id;
  const isWorkerExecution = Boolean(workerJob);

  const document = await prisma.document.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      userId: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      category: true,
      status: true,
      reviewStatus: true,
      content: true,
      storageProvider: true,
      storageKey: true,
      sha256: true,
      detectedMimeType: true,
      workspaceId: true,
      workspace: { select: { aiProcessingConsentAt: true } },
      version: true,
      extractedData: true,
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (isWorkerExecution) {
    if (document.userId !== actorUserId) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
  } else {
    try {
      await requireWorkspaceRole(
        actorUserId,
        document.workspaceId,
        WorkspaceRole.ACCOUNTANT,
      );
    } catch {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
  }

  const userId = document.userId;

  if (
    productionConfig.requireAiProcessingConsent &&
    !document.workspace?.aiProcessingConsentAt
  ) {
    const message =
      "AI processing consent is required. Open Settings and enable AI document processing.";
    await createAuditEvent({
      userId,
      workspaceId: document.workspaceId,
      eventType: "PROCESSING_BLOCKED",
      title: "AI processing consent required",
      description: message,
      documentId: document.id,
      fileName: document.fileName,
      metadata: { reason: "ai_processing_consent_missing" },
    });
    return NextResponse.json({ error: message }, { status: 403 });
  }

  if (document.status === DocumentStatus.QUEUED && !isWorkerExecution) {
    const existingJob = await prisma.processingJob.findFirst({
      where: {
        documentId: document.id,
        status: { in: ["QUEUED", "RUNNING"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return NextResponse.json(
      {
        status: DocumentStatus.QUEUED,
        jobId: existingJob?.id ?? null,
        message: "This document is already queued.",
      },
      { status: 202 },
    );
  }

  if (document.status === DocumentStatus.PROCESSING && !isWorkerExecution) {
    const message =
      "This document is already being processed. Wait for it to finish before retrying.";

    await createAuditEvent({
      userId,
      eventType: "PROCESSING_BLOCKED",
      title: "AI processing blocked",
      description: message,
      documentId: document.id,
      fileName: document.fileName,
      metadata: {
        reason: "already_processing",
      },
    });

    return NextResponse.json({ error: message }, { status: 409 });
  }

  if (document.fileSize > USAGE_LIMITS.MAX_AI_PROCESS_FILE_SIZE_BYTES) {
    const message = `AI processing is limited to ${formatUsageSize(
      USAGE_LIMITS.MAX_AI_PROCESS_FILE_SIZE_BYTES,
    )} to protect Gemini quota. Upload a smaller statement, invoice, bank export, or compressed PDF.`;

    await prisma.document.update({
      where: {
        id,
      },
      data: {
        status: DocumentStatus.FAILED,
        processingError: message,
        reviewStatus: DocumentReviewStatus.NEEDS_REVIEW,
        reviewedAt: null,
        reviewNote: null,
      },
    });

    await syncLedgerEntriesFromDocument({
      documentId: document.id,
      userId,
    });
    revalidatePath("/dashboard");
    revalidatePath("/ledger");

    await createAuditEvent({
      userId,
      eventType: "PROCESSING_BLOCKED",
      title: "AI processing blocked",
      description: message,
      documentId: document.id,
      fileName: document.fileName,
      metadata: {
        reason: "file_too_large",
        fileSize: document.fileSize,
        maxSize: USAGE_LIMITS.MAX_AI_PROCESS_FILE_SIZE_BYTES,
      },
    });

    return NextResponse.json({ error: message }, { status: 413 });
  }

  const usage: { allowed: boolean; message?: string; workspaceId?: string } =
    isWorkerExecution
      ? { allowed: true, workspaceId: document.workspaceId ?? undefined }
      : await checkAndRecordAiProcessUsage(userId);

  if (!usage.allowed) {
    const message =
      usage.message ?? "AI processing limit reached. Try again later.";

    await createAuditEvent({
      userId,
      eventType: "PROCESSING_BLOCKED",
      title: "AI processing limit reached",
      description: message,
      documentId: document.id,
      fileName: document.fileName,
      metadata: {
        reason: "usage_limit",
      },
    });

    return NextResponse.json({ error: message }, { status: 429 });
  }

  if (!isWorkerExecution && productionConfig.processingMode === "queue") {
    const job = await enqueueDocumentProcessing({
      documentId: document.id,
      userId,
      workspaceId: document.workspaceId,
    });

    await createAuditEvent({
      userId,
      workspaceId: document.workspaceId,
      eventType: "DOCUMENT_PROCESSING_QUEUED",
      title: "Document processing queued",
      description: `${document.fileName} was added to the secure processing queue.`,
      documentId: document.id,
      fileName: document.fileName,
      metadata: { requestId, jobId: job.id, engineVersion: AURELI_ENGINE_VERSION },
    });

    return NextResponse.json(
      { status: DocumentStatus.QUEUED, jobId: job.id, message: "Processing queued." },
      { status: 202 },
    );
  }

  const lockAcquired = isWorkerExecution ? true : tryAcquireProcessingLock(userId);

  if (!lockAcquired) {
    const message =
      "Another document is already being processed. Finish that first, then retry this one.";

    await createAuditEvent({
      userId,
      eventType: "PROCESSING_BLOCKED",
      title: "AI processing blocked",
      description: message,
      documentId: document.id,
      fileName: document.fileName,
      metadata: {
        reason: "active_processing_lock",
      },
    });

    return NextResponse.json({ error: message }, { status: 429 });
  }

  let rawLineItems: RawFinancialLineItem[] = [];
  let sourceTextForSummary = "";
  let extractionRunId: string | null = null;
  let pageCount: number | null = null;

  try {
    if (workerJob) await heartbeatProcessingJob(workerJob.id);

    const markProcessing = await prisma.document.updateMany({
      where: {
        id,
        userId,
        status: {
          not: DocumentStatus.PROCESSING,
        },
      },
      data: {
        status: DocumentStatus.PROCESSING,
        processingError: null,
        reviewStatus: DocumentReviewStatus.NEEDS_REVIEW,
        reviewedAt: null,
        reviewNote: null,
      },
    });

    if (markProcessing.count === 0) {
      const message =
        "This document is already being processed. Wait for it to finish before retrying.";

      await createAuditEvent({
        userId,
        eventType: "PROCESSING_BLOCKED",
        title: "AI processing blocked",
        description: message,
        documentId: document.id,
        fileName: document.fileName,
        metadata: {
          reason: "race_condition_processing",
        },
      });

      return NextResponse.json({ error: message }, { status: 409 });
    }

    // Reprocessing invalidates the previous approval immediately. Because the
    // document is PROCESSING + NEEDS_REVIEW, ledger sync removes every old
    // posting/detail row until the new extraction is reviewed and approved.
    await syncLedgerEntriesFromDocument({
      documentId: document.id,
      userId,
    });
    revalidatePath("/dashboard");
    revalidatePath("/ledger");

    await createAuditEvent({
      userId,
      eventType: "DOCUMENT_PROCESSING_STARTED",
      title: "AI processing started",
      description: `${document.fileName} is being processed by AI.`,
      documentId: document.id,
      fileName: document.fileName,
      workspaceId: document.workspaceId,
      metadata: {
        requestId,
        jobId: workerJob?.id ?? null,
        engineVersion: AURELI_ENGINE_VERSION,
        category: document.category,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
      },
    });

    const buffer = await loadDocumentBuffer(document);
    const inspection = inspectFile(
      buffer,
      document.fileName,
      document.detectedMimeType ?? document.mimeType,
    );
    if (inspection.isEncryptedPdf) {
      throw new Error("Password-protected PDFs must be unlocked before processing.");
    }
    if (document.sha256 && document.sha256 !== inspection.sha256) {
      throw new Error("Document integrity verification failed: SHA-256 mismatch.");
    }
    pageCount = estimatePdfPageCount(buffer);
    if (pageCount !== null && pageCount > productionConfig.maxPdfPages) {
      throw new Error(`PDF has ${pageCount} pages; the production limit is ${productionConfig.maxPdfPages}.`);
    }
    await prisma.document.update({
      where: { id: document.id },
      data: {
        sha256: inspection.sha256,
        detectedMimeType: inspection.detectedMimeType,
        pageCount,
      },
    });
    const extractionRun = await startExtractionRun({
      documentId: document.id,
      userId,
      workspaceId: document.workspaceId,
      sourceFileHash: inspection.sha256,
    });
    extractionRunId = extractionRun.id;
    const previousExtracted = getPreviousExtractedData(document.extractedData);
    const summaryOnly =
      document.category === DocumentCategory.FINANCIAL_STATEMENT;

    let extracted: ExtractedDocumentData = {
      summary: "Financial document processing in progress.",
      lineItems: [],
      transactions: [],
    };
    let deterministicMetricEvidence: Record<string, string> = {};
    let extractionWarning: string | null = null;
    const chunkLineItems: RawFinancialLineItem[] = [];
    const candidateChunks = 0;
    const completedChunks = 0;
    const failedChunks = 0;

    if (document.mimeType === "text/csv") {
      const text = buffer.toString("utf-8");
      sourceTextForSummary = text;

      rawLineItems = extractLineItemsFromText(text, {
        documentDate: previousExtracted?.documentDate ?? null,
        scaleMultiplier: previousExtracted?.scaleMultiplier ?? null,
        defaultCategory: document.category,
      });

      extracted = await extractDocumentData({
        fileName: document.fileName,
        category: document.category,
        content: {
          kind: "text",
          text: getTextForAi(text, summaryOnly),
        },
        summaryOnly,
      });
    } else if (XLSX_MIME_TYPES.includes(document.mimeType)) {
      const workbook = XLSX.read(buffer, {
        type: "buffer",
      });

      rawLineItems = extractLineItemsFromWorkbook(workbook, {
        documentDate: previousExtracted?.documentDate ?? null,
        scaleMultiplier: previousExtracted?.scaleMultiplier ?? null,
        defaultCategory: document.category,
      });

      const csv = workbook.SheetNames.slice(
        0,
        USAGE_LIMITS.MAX_SPREADSHEET_SHEETS_FOR_AI,
      )
        .map(
          (name) =>
            `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`,
        )
        .join("\n\n");
      sourceTextForSummary = csv;

      extracted = await extractDocumentData({
        fileName: document.fileName,
        category: document.category,
        content: {
          kind: "text",
          text: getTextForAi(csv, summaryOnly),
        },
        summaryOnly,
      });
    } else if (PDF_MIME_TYPES.includes(document.mimeType)) {
      const isFinancialStatement =
        document.category === DocumentCategory.FINANCIAL_STATEMENT;

      if (isFinancialStatement) {
        const productionExtraction = await extractFinancialStatementProduction({
          buffer,
          fileName: document.fileName,
          mimeType: document.mimeType,
        });

        extracted = productionExtraction.data;
        rawLineItems = productionExtraction.rawLineItems;
        sourceTextForSummary = productionExtraction.sourceText;
        deterministicMetricEvidence = productionExtraction.metricEvidence;
        extractionWarning = productionExtraction.warning;
      } else {
        const pdfText = await extractPdfText(buffer);
        sourceTextForSummary = pdfText;

        rawLineItems = extractLineItemsFromText(pdfText, {
          documentDate: previousExtracted?.documentDate ?? null,
          scaleMultiplier: previousExtracted?.scaleMultiplier ?? null,
          defaultCategory: document.category,
        });

        if (pdfText.trim().length > 2000) {
          extracted = await extractDocumentData({
            fileName: document.fileName,
            category: document.category,
            content: {
              kind: "text",
              text: getTextForAi(pdfText, summaryOnly),
            },
            summaryOnly,
          });
        } else {
          extracted = await extractDocumentData({
            fileName: document.fileName,
            category: document.category,
            content: {
              kind: "inline",
              mimeType: document.mimeType,
              base64Data: buffer.toString("base64"),
            },
            summaryOnly,
          });
        }
      }
    } else {
      extracted = await extractDocumentData({
        fileName: document.fileName,
        category: document.category,
        content: {
          kind: "inline",
          mimeType: document.mimeType,
          base64Data: buffer.toString("base64"),
        },
        summaryOnly,
      });
    }

    const mergedWithLineItems = mergeExtractedLineItems(extracted, [
      ...rawLineItems,
      ...chunkLineItems,
    ]);
    const sanitizedExtraction =
      document.category === DocumentCategory.FINANCIAL_STATEMENT
        ? sanitizeFinancialStatementExtraction(mergedWithLineItems)
        : mergedWithLineItems;
    const summaryBackfill =
      document.category === DocumentCategory.FINANCIAL_STATEMENT
        ? backfillFinancialStatementSummary(sanitizedExtraction, {
            rawText: sourceTextForSummary,
          })
        : { data: sanitizedExtraction, backfilledFields: [], evidence: {} };
    const combinedMetricEvidence = {
      ...summaryBackfill.evidence,
      ...deterministicMetricEvidence,
    };
    const summaryValidation =
      document.category === DocumentCategory.FINANCIAL_STATEMENT
        ? validateFinancialStatementSummary(summaryBackfill.data, {
            evidence: combinedMetricEvidence,
          })
        : {
            data: summaryBackfill.data,
            validation: null,
          };
    const mergedExtraction = summaryValidation.data;

    await saveProcessedDocument({
      id: document.id,
      userId,
      fileName: document.fileName,
      category: document.category,
      extracted: mergedExtraction,
      rawLineItemCount: rawLineItems.length,
      chunkLineItemCount: chunkLineItems.length,
      candidateChunks,
      completedChunks,
      failedChunks,
      summaryFieldsBackfilled: summaryBackfill.backfilledFields,
      summaryMetricEvidence: combinedMetricEvidence,
    });

    if (extractionRunId) {
      await finishExtractionRun({
        runId: extractionRunId,
        status: ExtractionRunStatus.COMPLETED,
        output: mergedExtraction as unknown as Prisma.InputJsonValue,
        diagnostics: (mergedExtraction.extractionDiagnostics ?? {}) as Prisma.InputJsonValue,
        warnings: extractionWarning ? ([extractionWarning] as Prisma.InputJsonValue) : undefined,
      });
    }

    // Every new extraction requires fresh human approval. This call removes
    // previously posted entries while the document is back in NEEDS_REVIEW.
    const ledgerEntriesSynced = await syncLedgerEntriesFromDocument({
      documentId: document.id,
      userId,
    });

    if (ledgerEntriesSynced > 0) {
      revalidatePath("/ledger");
    }

    await recordProcessingUsageDetails({
      workspaceId: document.workspaceId,
      processedPages: pageCount,
    });

    if (workerJob) {
      await completeProcessingJob(workerJob.id, {
        finalLineItemsStored: mergedExtraction.lineItems?.length ?? 0,
        requestId,
      });
    }

    return NextResponse.json({
      status: DocumentStatus.PROCESSED,
      extractedData: mergedExtraction,
      rawLineItemsDetected: rawLineItems.length,
      chunkLineItemsDetected: chunkLineItems.length,
      candidateChunks,
      completedChunks,
      failedChunks,
      summaryFieldsBackfilled: summaryBackfill.backfilledFields,
      summaryMetricEvidence: combinedMetricEvidence,
      metricValidation: summaryValidation.validation,
      extractionDiagnostics: mergedExtraction.extractionDiagnostics ?? null,
      warning: extractionWarning,
      ledgerEntriesSynced,
      finalLineItemsStored: mergedExtraction.lineItems?.length ?? 0,
    });
  } catch (error) {
    logger.error("document.processing_failed", error, {
      requestId,
      documentId: id,
      userId,
      jobId: workerJob?.id ?? null,
    });

    const message = getErrorMessage(error);
    if (rawLineItems.length > 0) {
      const deterministicBase = buildDeterministicOnlyExtraction({
        rawLineItems,
      });
      const sanitizedDeterministicBase =
        document.category === DocumentCategory.FINANCIAL_STATEMENT
          ? sanitizeFinancialStatementExtraction(deterministicBase)
          : deterministicBase;
      const deterministicSummary =
        document.category === DocumentCategory.FINANCIAL_STATEMENT
          ? backfillFinancialStatementSummary(sanitizedDeterministicBase, {
              rawText: sourceTextForSummary,
            })
          : { data: sanitizedDeterministicBase, backfilledFields: [], evidence: {} };
      const deterministicValidation =
        document.category === DocumentCategory.FINANCIAL_STATEMENT
          ? validateFinancialStatementSummary(deterministicSummary.data, {
              evidence: deterministicSummary.evidence,
            })
          : { data: deterministicSummary.data, validation: null };
      const deterministicOnlyExtraction = deterministicValidation.data;

      await saveProcessedDocument({
        id: document.id,
        userId,
        fileName: document.fileName,
        category: document.category,
        extracted: deterministicOnlyExtraction,
        rawLineItemCount: rawLineItems.length,
        summaryFieldsBackfilled: deterministicSummary.backfilledFields,
        summaryMetricEvidence: deterministicSummary.evidence,
      });

      if (extractionRunId) {
        await finishExtractionRun({
          runId: extractionRunId,
          status: ExtractionRunStatus.PARTIAL,
          output: deterministicOnlyExtraction as unknown as Prisma.InputJsonValue,
          diagnostics: { fallback: "deterministic_only", requestId },
          warnings: [cleanProcessingError(message)],
        });
      }
      await recordProcessingUsageDetails({
        workspaceId: document.workspaceId,
        processedPages: pageCount,
      });
      if (workerJob) {
        await completeProcessingJob(workerJob.id, {
          fallback: "deterministic_only",
          finalLineItemsStored: deterministicOnlyExtraction.lineItems?.length ?? 0,
          requestId,
        });
      }

      return NextResponse.json({
        status: DocumentStatus.PROCESSED,
        warning:
          "Gemini did not finish, but deterministic raw line-item extraction succeeded.",
        geminiError: cleanProcessingError(message),
        extractedData: deterministicOnlyExtraction,
        rawLineItemsDetected: rawLineItems.length,
        summaryFieldsBackfilled: deterministicSummary.backfilledFields,
        summaryMetricEvidence: deterministicSummary.evidence,
        metricValidation: deterministicValidation.validation,
        finalLineItemsStored:
          deterministicOnlyExtraction.lineItems?.length ?? 0,
      });
    }

    const friendlyMessage = isQuotaErrorMessage(message)
      ? [
          "Gemini quota or rate limit was reached.",
          "Use a billing-enabled Gemini key, a key from a new Google AI Studio project, or wait for quota reset.",
          "Avoid repeatedly processing large PDFs.",
          "",
          message,
        ].join("\n")
      : message;

    await prisma.document.update({
      where: {
        id,
      },
      data: {
        status: DocumentStatus.FAILED,
        processingError: cleanProcessingError(friendlyMessage),
      },
    });

    if (extractionRunId) {
      await finishExtractionRun({
        runId: extractionRunId,
        status: ExtractionRunStatus.FAILED,
        diagnostics: { requestId },
        warnings: [cleanProcessingError(friendlyMessage)],
      }).catch(() => undefined);
    }
    if (workerJob) {
      await failProcessingJob(workerJob.id, friendlyMessage).catch(() => undefined);
    }

    await createAuditEvent({
      userId,
      workspaceId: document.workspaceId,
      eventType: "DOCUMENT_PROCESSING_FAILED",
      title: "AI processing failed",
      description: cleanProcessingError(friendlyMessage),
      documentId: document.id,
      fileName: document.fileName,
      metadata: {
        category: document.category,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        quotaError: isQuotaErrorMessage(message),
        rawLineItemsDetected: rawLineItems.length,
      },
    });

    return NextResponse.json(
      {
        error: cleanProcessingError(friendlyMessage),
      },
      {
        status: 500,
      },
    );
  } finally {
    if (!isWorkerExecution) releaseProcessingLock(userId);
  }
}
