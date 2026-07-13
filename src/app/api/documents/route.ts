import { NextRequest, NextResponse } from "next/server";
import { DocumentStatus, DocumentStorageProvider } from "@prisma/client";
import { auth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { ALLOWED_MIME_TYPES, isValidCategory } from "@/lib/document-categories";
import { inspectFile, sanitizeFileName } from "@/lib/file-security";
import { buildStorageKey, configuredStorageProvider, putObject } from "@/lib/object-storage";
import { checkAndRecordUploadUsage } from "@/lib/usage-events";
import { ensureDefaultWorkspaceForUser } from "@/lib/workspace-context";
import { limitsForPlan } from "@/lib/plan-limits";
import { checkWorkspaceStorageCapacity } from "@/lib/workspace-storage";
import { productionConfig } from "@/lib/production-config";
import { logger, getRequestId } from "@/lib/logger";
import { scanStoredDocument } from "@/lib/malware-scan";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers);
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const userId = session.user.id;
    const formData = await request.formData();
    const file = formData.get("file");
    const category = formData.get("category");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file was provided." }, { status: 400 });
    if (typeof category !== "string" || !isValidCategory(category)) {
      return NextResponse.json({ error: "Pick a document category." }, { status: 400 });
    }
    if (file.size <= 0) return NextResponse.json({ error: "That file is empty." }, { status: 400 });

    const workspace = await ensureDefaultWorkspaceForUser(userId);
    const limits = limitsForPlan(workspace.plan);
    if (file.size > limits.maxFileBytes) {
      return NextResponse.json(
        { error: `Your ${workspace.plan.toLowerCase()} plan allows files up to ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB.` },
        { status: 413 },
      );
    }

    const storageCapacity = await checkWorkspaceStorageCapacity({
      workspaceId: workspace.id,
      incomingBytes: file.size,
      limitBytes: limits.storageBytes,
    });
    if (!storageCapacity.allowed) {
      return NextResponse.json(
        { error: "Workspace storage limit reached. Delete older documents or upgrade the plan." },
        { status: 429 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = sanitizeFileName(file.name);
    const inspection = inspectFile(buffer, safeName, file.type);
    if (!ALLOWED_MIME_TYPES.includes(inspection.detectedMimeType ?? "")) {
      return NextResponse.json({ error: "Use a supported PDF, image, CSV, or Excel file." }, { status: 400 });
    }
    if (inspection.isEncryptedPdf) {
      return NextResponse.json({ error: "Password-protected PDFs must be unlocked before upload." }, { status: 400 });
    }

    const duplicate = await prisma.document.findFirst({
      where: {
        workspaceId: workspace.id,
        sha256: inspection.sha256,
        status: { not: DocumentStatus.FAILED },
      },
      select: { id: true, fileName: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: `This exact file already exists as ${duplicate.fileName}.`, existingDocumentId: duplicate.id },
        { status: 409 },
      );
    }

    const usage = await checkAndRecordUploadUsage(userId, {
      storageBytes: file.size,
      metadata: { requestId, category },
    });
    if (!usage.allowed) return NextResponse.json({ error: usage.message }, { status: 429 });

    const business = await prisma.business.findUnique({ where: { userId }, select: { id: true } });
    const provider = configuredStorageProvider();
    const retentionUntil = new Date(Date.now() + (workspace.retentionDays || productionConfig.defaultRetentionDays) * 86400000);
    let storageKey: string | null = null;
    const created = await prisma.document.create({
      data: {
        fileName: safeName,
        mimeType: inspection.detectedMimeType!,
        detectedMimeType: inspection.detectedMimeType,
        fileSize: file.size,
        category,
        status: DocumentStatus.UPLOADED,
        content: provider === DocumentStorageProvider.DATABASE ? buffer : null,
        storageProvider: provider,
        sha256: inspection.sha256,
        userId,
        workspaceId: workspace.id,
        businessId: business?.id ?? null,
        retentionUntil,
      },
    });

    if (provider === DocumentStorageProvider.S3) {
      storageKey = buildStorageKey({
        workspaceId: workspace.id,
        userId,
        documentId: created.id,
        fileName: safeName,
      });
      try {
        await putObject(storageKey, buffer, inspection.detectedMimeType!);
        await prisma.document.update({ where: { id: created.id }, data: { storageKey } });
      } catch (error) {
        await prisma.document.delete({ where: { id: created.id } }).catch(() => undefined);
        throw error;
      }
    }

    let scan;
    try {
      scan = await scanStoredDocument({
        fileName: safeName,
        mimeType: inspection.detectedMimeType!,
        fileSize: file.size,
        sha256: inspection.sha256,
        document: {
          storageProvider: provider,
          storageKey,
        },
      });
      if (scan.status === "infected") {
        throw new Error(scan.message ?? "The file failed malware scanning.");
      }
    } catch (error) {
      if (storageKey) {
        const { deleteObject } = await import("@/lib/object-storage");
        await deleteObject(storageKey).catch(() => undefined);
      }
      await prisma.document.delete({ where: { id: created.id } }).catch(() => undefined);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Upload security verification failed." },
        { status: 400 },
      );
    }

    await createAuditEvent({
      userId,
      workspaceId: workspace.id,
      eventType: "DOCUMENT_UPLOADED",
      title: "Document uploaded",
      description: `${safeName} was uploaded and is ready for AI processing.`,
      documentId: created.id,
      fileName: safeName,
      metadata: {
        requestId,
        category,
        fileSize: file.size,
        declaredMimeType: file.type,
        detectedMimeType: inspection.detectedMimeType,
        storageProvider: provider,
        sha256: inspection.sha256,
        warnings: inspection.warnings,
        malwareScan: scan,
      },
    });

    return NextResponse.json(
      {
        document: {
          id: created.id,
          fileName: safeName,
          mimeType: inspection.detectedMimeType,
          fileSize: file.size,
          category,
          status: created.status,
          uploadedAt: created.uploadedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error("document.upload_failed", error, { requestId });
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
