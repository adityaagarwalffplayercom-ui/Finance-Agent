import { NextResponse } from "next/server";
import { CorrectionStatus, DocumentReviewStatus, WorkspaceRole, type Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/lib/audit-log";
import { getValueAtPath, setValueAtPath, validateCorrectionValue } from "@/lib/document-corrections";
import { requireWorkspaceRole } from "@/lib/workspace-context";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const document = await prisma.document.findFirst({
    where: {
      id,
      OR: [
        { userId: session.user.id },
        { workspace: { members: { some: { userId: session.user.id } } } },
      ],
    },
    select: { workspaceId: true },
  });
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  await requireWorkspaceRole(session.user.id, document.workspaceId, WorkspaceRole.VIEWER);
  const corrections = await prisma.documentCorrection.findMany({
    where: { documentId: id, status: CorrectionStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ corrections });
}

export async function POST(request: Request, context: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as {
    fieldPath?: string;
    correctedValue?: unknown;
    reason?: string;
  } | null;
  const fieldPath = body?.fieldPath?.trim();
  if (!fieldPath || fieldPath.length > 160) {
    return NextResponse.json({ error: "A valid field path is required." }, { status: 400 });
  }

  const document = await prisma.document.findFirst({
    where: {
      id,
      OR: [
        { userId: session.user.id },
        { workspace: { members: { some: { userId: session.user.id } } } },
      ],
    },
    select: { id: true, fileName: true, workspaceId: true, extractedData: true },
  });
  if (!document || !document.extractedData) {
    return NextResponse.json({ error: "Processed document not found." }, { status: 404 });
  }
  await requireWorkspaceRole(session.user.id, document.workspaceId, WorkspaceRole.ACCOUNTANT);

  let correctedValue: Prisma.InputJsonValue;
  let updatedData: Prisma.InputJsonValue;
  try {
    correctedValue = validateCorrectionValue(fieldPath, body?.correctedValue);
    updatedData = setValueAtPath(document.extractedData, fieldPath, correctedValue) as Prisma.InputJsonValue;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid correction." }, { status: 400 });
  }

  const latestRun = await prisma.extractionRun.findFirst({
    where: { documentId: document.id },
    orderBy: { runNumber: "desc" },
    select: { id: true },
  });
  const originalValue = getValueAtPath(document.extractedData, fieldPath);

  const correction = await prisma.$transaction(async (tx) => {
    await tx.documentCorrection.updateMany({
      where: { documentId: document.id, fieldPath, status: CorrectionStatus.ACTIVE },
      data: { status: CorrectionStatus.REVOKED },
    });
    const correction = await tx.documentCorrection.create({
      data: {
        documentId: document.id,
        extractionRunId: latestRun?.id ?? null,
        userId: session.user.id,
        workspaceId: document.workspaceId,
        fieldPath,
        originalValue: originalValue === undefined ? undefined : (originalValue as Prisma.InputJsonValue),
        correctedValue,
        reason: body?.reason?.trim().slice(0, 500) || null,
      },
    });
    await tx.document.update({
      where: { id: document.id },
      data: {
        extractedData: updatedData,
        reviewStatus: DocumentReviewStatus.NEEDS_REVIEW,
        reviewedAt: null,
        reviewNote: "Manual correction applied; review required again.",
      },
    });
    await tx.ledgerEntry.deleteMany({ where: { documentId: document.id } });
    return correction;
  });

  await createAuditEvent({
    userId: session.user.id,
    workspaceId: document.workspaceId,
    eventType: "DOCUMENT_CORRECTED",
    title: "Document value corrected",
    description: `${fieldPath} was manually corrected in ${document.fileName}.`,
    documentId: document.id,
    fileName: document.fileName,
    metadata: { fieldPath, originalValue: originalValue ?? null, correctedValue, reason: body?.reason ?? null },
  });

  return NextResponse.json({ success: true, correction, extractedData: updatedData });
}
