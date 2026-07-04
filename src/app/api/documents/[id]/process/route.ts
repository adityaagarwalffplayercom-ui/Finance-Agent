import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractDocumentData, type ExtractedDocumentData } from "@/lib/gemini";
import type { Prisma } from "@prisma/client";

const XLSX_MIME_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// Keeps token usage (and Gemini free-tier TPM) bounded on huge spreadsheets.
const MAX_TEXT_CHARS = 100_000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      fileName: true,
      mimeType: true,
      category: true,
      content: true,
    },
  });

  if (!document || document.userId !== session.user.id) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  await prisma.document.update({
    where: { id },
    data: { status: "PROCESSING", processingError: null },
  });

  try {
    let extracted: ExtractedDocumentData;

    if (document.mimeType === "text/csv") {
      const text = Buffer.from(document.content).toString("utf-8").slice(0, MAX_TEXT_CHARS);
      extracted = await extractDocumentData({
        fileName: document.fileName,
        category: document.category,
        content: { kind: "text", text },
      });
    } else if (XLSX_MIME_TYPES.includes(document.mimeType)) {
      const workbook = XLSX.read(Buffer.from(document.content), { type: "buffer" });
      const csv = workbook.SheetNames.map(
        (name) => `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`,
      )
        .join("\n\n")
        .slice(0, MAX_TEXT_CHARS);
      extracted = await extractDocumentData({
        fileName: document.fileName,
        category: document.category,
        content: { kind: "text", text: csv },
      });
    } else {
      // PDFs and images go to Gemini as inline binary data.
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
      where: { id },
      data: {
        status: "PROCESSED",
        extractedData: extracted as unknown as Prisma.InputJsonValue,
        extractedAt: new Date(),
      },
    });

    return NextResponse.json({ status: "PROCESSED", extractedData: extracted });
  } catch (err) {
    console.error(`Document processing failed for ${id}:`, err);

    await prisma.document.update({
      where: { id },
      data: {
        status: "FAILED",
        processingError:
          err instanceof Error ? err.message.slice(0, 500) : "Processing failed for an unknown reason.",
      },
    });

    return NextResponse.json({ error: "Processing failed. You can try again." }, { status: 500 });
  }
}
