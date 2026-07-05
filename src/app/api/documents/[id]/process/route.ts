import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractDocumentData, type ExtractedDocumentData } from "@/lib/gemini";
import {
  USAGE_LIMITS,
  checkAndConsumeRateLimit,
  formatUsageSize,
  getProcessDailyRateLimitKey,
  getProcessHourlyRateLimitKey,
  releaseProcessingLock,
  tryAcquireProcessingLock,
} from "@/lib/usage-limits";

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

  if (document.status === "PROCESSING") {
    return NextResponse.json(
      {
        error:
          "This document is already being processed. Wait for it to finish before retrying.",
      },
      { status: 409 },
    );
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
        status: "FAILED",
        processingError: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 413 });
  }

  const lockAcquired = tryAcquireProcessingLock(userId);

  if (!lockAcquired) {
    return NextResponse.json(
      {
        error:
          "Another document is already being processed. Finish that first, then retry this one.",
      },
      { status: 429 },
    );
  }

  try {
    const hourlyLimit = checkAndConsumeRateLimit({
      key: getProcessHourlyRateLimitKey(userId),
      limit: USAGE_LIMITS.MAX_AI_PROCESSES_PER_HOUR,
      windowMs: 60 * 60 * 1000,
      label: "Hourly AI processing",
    });

    if (!hourlyLimit.allowed) {
      return NextResponse.json(
        {
          error:
            hourlyLimit.message ??
            "Hourly AI processing limit reached. Try again later.",
        },
        { status: 429 },
      );
    }

    const dailyLimit = checkAndConsumeRateLimit({
      key: getProcessDailyRateLimitKey(userId),
      limit: USAGE_LIMITS.MAX_AI_PROCESSES_PER_DAY,
      windowMs: 24 * 60 * 60 * 1000,
      label: "Daily AI processing",
    });

    if (!dailyLimit.allowed) {
      return NextResponse.json(
        {
          error:
            dailyLimit.message ??
            "Daily AI processing limit reached. Try again later.",
        },
        { status: 429 },
      );
    }

    await prisma.document.update({
      where: {
        id,
      },
      data: {
        status: "PROCESSING",
        processingError: null,
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
        status: "PROCESSED",
        extractedData: extracted as unknown as Prisma.InputJsonValue,
        extractedAt: new Date(),
        processingError: null,
      },
    });

    return NextResponse.json({
      status: "PROCESSED",
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
        status: "FAILED",
        processingError: cleanProcessingError(friendlyMessage),
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