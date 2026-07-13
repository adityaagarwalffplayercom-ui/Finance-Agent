import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { deleteObject, getDocumentDownloadUrl } from "@/lib/object-storage";
import { DocumentStorageProvider, WorkspaceRole } from "@prisma/client";
import { logger, getRequestId } from "@/lib/logger";
import { requireWorkspaceRole } from "@/lib/workspace-context";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: {
      id,
      OR: [
        { userId: session.user.id },
        { workspace: { members: { some: { userId: session.user.id } } } },
      ],
    },
  });
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const downloadUrl = getDocumentDownloadUrl(document);
  if (downloadUrl) {
    return NextResponse.redirect(downloadUrl, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  if (!document.content) return NextResponse.json({ error: "Document content is unavailable." }, { status: 410 });
  return new NextResponse(Buffer.from(document.content), {
    headers: {
      "Content-Type": document.detectedMimeType ?? document.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      "Content-Length": String(document.fileSize),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const requestId = getRequestId(request.headers);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: {
      id,
      OR: [
        { userId: session.user.id },
        { workspace: { members: { some: { userId: session.user.id } } } },
      ],
    },
    select: {
      id: true,
      userId: true,
      workspaceId: true,
      fileName: true,
      status: true,
      reviewStatus: true,
      category: true,
      fileSize: true,
      mimeType: true,
      storageProvider: true,
      storageKey: true,
    },
  });
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  try {
    await requireWorkspaceRole(
      session.user.id,
      document.workspaceId,
      WorkspaceRole.ADMIN,
    );
    if (document.storageProvider === DocumentStorageProvider.S3 && document.storageKey) {
      await deleteObject(document.storageKey);
    }
    await prisma.document.delete({ where: { id } });
    await createAuditEvent({
      userId: session.user.id,
      workspaceId: document.workspaceId,
      eventType: "DOCUMENT_DELETED",
      title: "Document deleted",
      description: `${document.fileName} was permanently deleted.`,
      documentId: document.id,
      fileName: document.fileName,
      metadata: {
        requestId,
        status: document.status,
        reviewStatus: document.reviewStatus,
        category: document.category,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        storageProvider: document.storageProvider,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("document.delete_failed", error, { requestId, documentId: id });
    return NextResponse.json({ error: "Document deletion failed. Please retry." }, { status: 500 });
  }
}
