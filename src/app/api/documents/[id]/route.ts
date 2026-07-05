import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: {
      id,
    },
  });

  if (!document || document.userId !== session.user.id) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const body = Buffer.from(document.content);

  return new NextResponse(body, {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(
        document.fileName,
      )}"`,
      "Content-Length": String(document.fileSize),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      userId: true,
      fileName: true,
      status: true,
      reviewStatus: true,
      category: true,
      fileSize: true,
      mimeType: true,
    },
  });

  if (!document || document.userId !== session.user.id) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  await prisma.document.delete({
    where: {
      id,
    },
  });

  await createAuditEvent({
    userId: session.user.id,
    eventType: "DOCUMENT_DELETED",
    title: "Document deleted",
    description: `${document.fileName} was deleted from the workspace.`,
    documentId: document.id,
    fileName: document.fileName,
    metadata: {
      status: document.status,
      reviewStatus: document.reviewStatus,
      category: document.category,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
    },
  });

  return NextResponse.json({ success: true });
}