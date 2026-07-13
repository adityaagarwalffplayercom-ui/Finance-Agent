import { NextResponse } from "next/server";
import { DocumentStatus, DocumentStorageProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/object-storage";
import { productionConfig } from "@/lib/production-config";
import { logger, getRequestId } from "@/lib/logger";
import { secureTokenEqual } from "@/lib/secure-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return secureTokenEqual(token, productionConfig.workerSecret);
}

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const abandonedBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { retentionUntil: { lte: now } },
        { status: DocumentStatus.UPLOADING, uploadedAt: { lte: abandonedBefore } },
      ],
    },
    take: 100,
    select: { id: true, storageProvider: true, storageKey: true },
  });
  let deleted = 0;
  const failures: string[] = [];
  for (const document of documents) {
    try {
      if (document.storageProvider === DocumentStorageProvider.S3 && document.storageKey) {
        await deleteObject(document.storageKey);
      }
      await prisma.document.delete({ where: { id: document.id } });
      deleted += 1;
    } catch (error) {
      failures.push(document.id);
      logger.error("retention.document_delete_failed", error, { requestId, documentId: document.id });
    }
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
  const twoYearsAgo = new Date(Date.now() - 730 * 86400000);
  const [jobs, usage] = await prisma.$transaction([
    prisma.processingJob.deleteMany({
      where: { status: { in: ["COMPLETED", "FAILED", "CANCELLED"] }, finishedAt: { lt: ninetyDaysAgo } },
    }),
    prisma.usageEvent.deleteMany({ where: { createdAt: { lt: twoYearsAgo } } }),
  ]);

  return NextResponse.json({ requestId, documentsDeleted: deleted, failures, jobsDeleted: jobs.count, usageEventsDeleted: usage.count });
}
