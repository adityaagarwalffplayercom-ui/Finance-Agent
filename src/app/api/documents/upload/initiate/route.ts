import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { DocumentStatus, DocumentStorageProvider } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidCategory } from "@/lib/document-categories";
import { sanitizeFileName } from "@/lib/file-security";
import { canUseDirectUploads, buildStorageKey, createPresignedObjectUrl } from "@/lib/object-storage";
import { ensureDefaultWorkspaceForUser } from "@/lib/workspace-context";
import { limitsForPlan } from "@/lib/plan-limits";
import { checkWorkspaceStorageCapacity } from "@/lib/workspace-storage";
import { productionConfig } from "@/lib/production-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    category?: string;
    sha256?: string;
  } | null;

  if (!body || !isValidCategory(body.category)) {
    return NextResponse.json({ error: "Pick a valid document category." }, { status: 400 });
  }
  const fileName = sanitizeFileName(body.fileName ?? "document");
  const fileSize = Number(body.fileSize);
  const mimeType = typeof body.mimeType === "string" ? body.mimeType.slice(0, 120) : "application/octet-stream";
  if (!Number.isInteger(fileSize) || fileSize <= 0) {
    return NextResponse.json({ error: "Invalid file size." }, { status: 400 });
  }

  if (!canUseDirectUploads()) {
    return NextResponse.json({ mode: "database" });
  }

  const workspace = await ensureDefaultWorkspaceForUser(session.user.id);
  const limits = limitsForPlan(workspace.plan);
  if (fileSize > limits.maxFileBytes) {
    return NextResponse.json(
      { error: `Your ${workspace.plan.toLowerCase()} plan allows files up to ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB.` },
      { status: 413 },
    );
  }

  const storageCapacity = await checkWorkspaceStorageCapacity({
    workspaceId: workspace.id,
    incomingBytes: fileSize,
    limitBytes: limits.storageBytes,
  });
  if (!storageCapacity.allowed) {
    return NextResponse.json(
      { error: "Workspace storage limit reached. Delete older documents or upgrade the plan." },
      { status: 429 },
    );
  }

  const business = await prisma.business.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  const retentionUntil = new Date(Date.now() + (workspace.retentionDays || productionConfig.defaultRetentionDays) * 86400000);
  const provisionalId = randomUUID().replaceAll("-", "");
  const document = await prisma.document.create({
    data: {
      id: provisionalId,
      fileName,
      mimeType,
      fileSize,
      category: body.category,
      status: DocumentStatus.UPLOADING,
      storageProvider: DocumentStorageProvider.S3,
      sha256: /^[a-f0-9]{64}$/i.test(body.sha256 ?? "") ? body.sha256!.toLowerCase() : null,
      userId: session.user.id,
      workspaceId: workspace.id,
      businessId: business?.id ?? null,
      retentionUntil,
    },
    select: { id: true },
  });

  const storageKey = buildStorageKey({
    workspaceId: workspace.id,
    userId: session.user.id,
    documentId: document.id,
    fileName,
  });
  await prisma.document.update({ where: { id: document.id }, data: { storageKey } });

  return NextResponse.json({
    mode: "s3",
    documentId: document.id,
    uploadUrl: createPresignedObjectUrl({ key: storageKey, method: "PUT", expiresInSeconds: 900 }),
    expiresInSeconds: 900,
  });
}
