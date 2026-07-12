import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import {
  DocumentCategory,
  DocumentReviewStatus,
  DocumentStatus,
  type Prisma,
} from "@prisma/client";
import { auth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import {
  extractDocumentData,
  extractDocumentLineItemsFromTextChunks,
  type ExtractedDocumentData,
} from "@/lib/gemini";
import { syncLedgerEntriesFromDocument } from "@/lib/transaction-ledger";
import { buildFinancialSummaryText } from "@/lib/financial-text-chunks";
import { backfillFinancialStatementSummary } from "@/lib/financial-summary-backfill";
import { USAGE_LIMITS, formatUsageSize } from "@/lib/usage-limits";
import {
  checkAndRecordAiProcessUsage,
  releaseProcessingLock,
  tryAcquireProcessingLock,
} from "@/lib/usage-events";
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
  previous: ExtractedDocumentData | null;
  rawLineItems: RawFinancialLineItem[];
  fileName: string;
}): ExtractedDocumentData {
  const base: ExtractedDocumentData = params.previous ?? {
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

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const userId = session.user.id;

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
      extractedData: true,
    },
  });

  if (!document || document.userId !== userId) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (document.status === DocumentStatus.PROCESSING) {
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
      },
    });

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

  const usage = await checkAndRecordAiProcessUsage(userId);

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

  const lockAcquired = tryAcquireProcessingLock(userId);

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

  try {
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

    await createAuditEvent({
      userId,
      eventType: "DOCUMENT_PROCESSING_STARTED",
      title: "AI processing started",
      description: `${document.fileName} is being processed by AI.`,
      documentId: document.id,
      fileName: document.fileName,
      metadata: {
        category: document.category,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
      },
    });

    const buffer = Buffer.from(document.content);
    const previousExtracted = getPreviousExtractedData(document.extractedData);
    const summaryOnly =
      document.category === DocumentCategory.FINANCIAL_STATEMENT;

    let extracted: ExtractedDocumentData;
    let chunkLineItems: RawFinancialLineItem[] = [];
    let candidateChunks = 0;
    let completedChunks = 0;
    let failedChunks = 0;

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

        if (document.category === DocumentCategory.FINANCIAL_STATEMENT) {
          try {
            const chunkedExtraction =
              await extractDocumentLineItemsFromTextChunks({
                fileName: document.fileName,
                category: document.category,
                text: pdfText,
                reportedUnit: extracted.reportedUnit,
                scaleMultiplier: extracted.scaleMultiplier,
                documentDate:
                  extracted.documentDate ?? extracted.periodEnd ?? null,
              });

            chunkLineItems = chunkedExtraction.lineItems;
            candidateChunks = chunkedExtraction.candidateChunks;
            completedChunks = chunkedExtraction.completedChunks;
            failedChunks = chunkedExtraction.failedChunks;
          } catch (chunkError) {
            failedChunks = Math.max(failedChunks, 1);
            console.warn(
              "Optional chunked financial-row extraction failed; continuing with whole-document and deterministic rows.",
              getErrorMessage(chunkError),
            );
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
    const summaryBackfill =
      document.category === DocumentCategory.FINANCIAL_STATEMENT
        ? backfillFinancialStatementSummary(mergedWithLineItems, {
            rawText: sourceTextForSummary,
          })
        : { data: mergedWithLineItems, backfilledFields: [], evidence: {} };
    const mergedExtraction = summaryBackfill.data;

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
      summaryMetricEvidence: summaryBackfill.evidence,
    });

    const ledgerEntriesSynced =
      document.reviewStatus === DocumentReviewStatus.APPROVED
        ? await syncLedgerEntriesFromDocument({
            documentId: document.id,
            userId,
          })
        : 0;

    if (ledgerEntriesSynced > 0) {
      revalidatePath("/ledger");
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
      summaryMetricEvidence: summaryBackfill.evidence,
      ledgerEntriesSynced,
      finalLineItemsStored: mergedExtraction.lineItems?.length ?? 0,
    });
  } catch (error) {
    console.error(`Document processing failed for ${id}:`, error);

    const message = getErrorMessage(error);
    const previousExtracted = getPreviousExtractedData(document.extractedData);

    if (rawLineItems.length > 0) {
      const deterministicBase = buildDeterministicOnlyExtraction({
        previous: previousExtracted,
        rawLineItems,
        fileName: document.fileName,
      });
      const deterministicSummary =
        document.category === DocumentCategory.FINANCIAL_STATEMENT
          ? backfillFinancialStatementSummary(deterministicBase, {
              rawText: sourceTextForSummary,
            })
          : { data: deterministicBase, backfilledFields: [], evidence: {} };
      const deterministicOnlyExtraction = deterministicSummary.data;

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

      return NextResponse.json({
        status: DocumentStatus.PROCESSED,
        warning:
          "Gemini did not finish, but deterministic raw line-item extraction succeeded.",
        geminiError: cleanProcessingError(message),
        extractedData: deterministicOnlyExtraction,
        rawLineItemsDetected: rawLineItems.length,
        summaryFieldsBackfilled: deterministicSummary.backfilledFields,
        summaryMetricEvidence: deterministicSummary.evidence,
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

    await createAuditEvent({
      userId,
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
    releaseProcessingLock(userId);
  }
}
