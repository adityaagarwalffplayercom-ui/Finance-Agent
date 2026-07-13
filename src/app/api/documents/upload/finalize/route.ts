import { NextResponse } from "next/server";
import { DocumentStatus, DocumentStorageProvider } from "@prisma/client";
import { auth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { detectMimeType, extensionOf } from "@/lib/file-security";
import { deleteObject, getObjectPrefix, headObject } from "@/lib/object-storage";
import { checkAndRecordUploadUsage } from "@/lib/usage-events";
import { scanStoredDocument } from "@/lib/malware-scan";

const EXTENSION_MIME: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  csv: ["text/csv"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await request.json().catch(() => null) as { documentId?: string; sha256?: string } | null;
  if (!body?.documentId) return NextResponse.json({ error: "Document ID is required." }, { status: 400 });

  const document = await prisma.document.findFirst({
    where: { id: body.documentId, userId: session.user.id },
  });
  if (!document || document.storageProvider !== DocumentStorageProvider.S3 || !document.storageKey) {
    return NextResponse.json({ error: "Upload session not found." }, { status: 404 });
  }
  if (document.status !== DocumentStatus.UPLOADING) {
    return NextResponse.json({ error: "This upload was already finalized." }, { status: 409 });
  }

  try {
    const [head, prefix] = await Promise.all([headObject(document.storageKey), getObjectPrefix(document.storageKey)]);
    if (head.size !== null && head.size !== document.fileSize) {
      throw new Error(`Uploaded size ${head.size} does not match expected size ${document.fileSize}.`);
    }
    const detectedMimeType = detectMimeType(prefix);
    if (!detectedMimeType) throw new Error("The uploaded object is not a supported document format.");
    const allowed = EXTENSION_MIME[extensionOf(document.fileName)] ?? [];
    if (allowed.length > 0 && !allowed.includes(detectedMimeType)) {
      throw new Error("The uploaded file extension does not match its actual content.");
    }

    const scan = await scanStoredDocument({
      fileName: document.fileName,
      mimeType: detectedMimeType,
      fileSize: document.fileSize,
      sha256: body.sha256 ?? document.sha256,
      document,
    });
    if (scan.status === "infected") {
      throw new Error(scan.message ?? "The file failed malware scanning.");
    }

    const usage = await checkAndRecordUploadUsage(session.user.id, {
      storageBytes: document.fileSize,
      metadata: { documentId: document.id, storageProvider: "S3" },
    });
    if (!usage.allowed) throw new Error(usage.message ?? "Upload limit reached.");

    const updated = await prisma.document.update({
      where: { id: document.id },
      data: {
        status: DocumentStatus.UPLOADED,
        detectedMimeType,
        mimeType: detectedMimeType,
        sha256: /^[a-f0-9]{64}$/i.test(body.sha256 ?? "") ? body.sha256!.toLowerCase() : document.sha256,
        processingError: null,
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        category: true,
        status: true,
        uploadedAt: true,
      },
    });

    await createAuditEvent({
      userId: session.user.id,
      workspaceId: document.workspaceId,
      eventType: "DOCUMENT_UPLOADED",
      title: "Document uploaded",
      description: `${document.fileName} was securely uploaded and is ready for processing.`,
      documentId: document.id,
      fileName: document.fileName,
      metadata: {
        storageProvider: "S3",
        detectedMimeType,
        fileSize: document.fileSize,
        malwareScan: scan,
      },
    });

    return NextResponse.json({ document: updated, message: "Secure upload completed." }, { status: 201 });
  } catch (error) {
    await deleteObject(document.storageKey).catch(() => undefined);
    await prisma.document.delete({ where: { id: document.id } }).catch(() => undefined);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload finalization failed." },
      { status: 400 },
    );
  }
}
