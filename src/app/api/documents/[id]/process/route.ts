import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { DocumentStatus, type Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { extractDocumentData, type ExtractedDocumentData } from "@/lib/gemini";
import { USAGE_LIMITS, formatUsageSize } from "@/lib/usage-limits";
import {
  checkAndRecordAiProcessUsage,
  releaseProcessingLock,
  tryAcquireProcessingLock,
} from "@/lib/usage-events";

const XLSX_MIME_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

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
      content: true,
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
      title: "Processing blocked",
      description: message,
      documentId: document.id,
      fileName: document.fileName,
      metadata: {
        reason: "already_processing",
        status: document.status,
      },
    });

    return NextResponse.json({ error: message }, { status: 409 });
  }

  if (document.fileSize > USAGE_LIMITS.MAX_AI_PROCESS_FILE_SIZE_BYTES) {
    const message = `This file is ${formatUsageSize(
      document.fileSize,
    )}. AI processing is limited to ${formatUsageSize(
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
    const message = usage.message ?? "AI processing limit reached. Try again later.";

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

    let extracted: ExtractedDocumentData;

    if (document.mimeType === "text/csv") {
      const text = Buffer.from(document.content)
        .toString("utf-8")
        .slice(0, USAGE_LIMITS.MAX_TEXT_CHARS_FOR_AI);

      extracted = await extractDocumentData({
        fileName: document.fileName,
        category: document.category,
        content: {
          kind: "text",
          text,
        },
      });
    } else if (XLSX_MIME_TYPES.includes(document.mimeType)) {
      const workbook = XLSX.read(Buffer.from(document.content), {
        type: "buffer",
      });

      const csv = workbook.SheetNames.slice(
        0,
        USAGE_LIMITS.MAX_SPREADSHEET_SHEETS_FOR_AI,
      )
        .map(
          (name) =>
            `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`,
        )
        .join("\n\n")
        .slice(0, USAGE_LIMITS.MAX_TEXT_CHARS_FOR_AI);

      extracted = await extractDocumentData({
        fileName: document.fileName,
        category: document.category,
        content: {
          kind: "text",
          text: csv,
        },
      });
    } else {
      extracted = await extractDocumentData({
        fileName: document.fileName,
        category: document.category,
        content: {
          kind: "inline",
          mimeType: document.mimeType,
          base64Data: Buffer.from(document.content).toString("base64"),
        },
      });
    }

    await prisma.document.update({
      where: {
        id,
      },
      data: {
        status: DocumentStatus.PROCESSED,
        extractedData: extracted as unknown as Prisma.InputJsonValue,
        extractedAt: new Date(),
        processingError: null,
      },
    });

    await createAuditEvent({
      userId,
      eventType: "DOCUMENT_PROCESSING_COMPLETED",
      title: "AI processing completed",
      description: `${document.fileName} was processed successfully and is ready for review.`,
      documentId: document.id,
      fileName: document.fileName,
      metadata: {
        category: document.category,
        status: DocumentStatus.PROCESSED,
        currency: extracted.currency ?? null,
        reportedUnit: extracted.reportedUnit ?? null,
        scaleMultiplier: extracted.scaleMultiplier ?? null,
      },
    });

    return NextResponse.json({
      status: DocumentStatus.PROCESSED,
      extractedData: extracted,
    });
  } catch (error) {
    console.error(`Document processing failed for ${id}:`, error);

    const message = getErrorMessage(error);

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
      },
    });

    return NextResponse.json(
      {
        error: cleanProcessingError(friendlyMessage),
      },
      { status: isQuotaErrorMessage(message) ? 429 : 500 },
    );
  } finally {
    releaseProcessingLock(userId);
  }
}