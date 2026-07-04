import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });

  if (!document || document.userId !== session.user.id) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  // Prisma 6 returns Bytes fields as Uint8Array; Buffer.from wraps it
  // without copying so it can be used as a standard Response body.
  const body = Buffer.from(document.content);

  return new NextResponse(body, {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`,
      "Content-Length": String(document.fileSize),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!document || document.userId !== session.user.id) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  await prisma.document.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
