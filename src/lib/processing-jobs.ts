import { randomUUID } from "node:crypto";
import {
  DocumentReviewStatus,
  DocumentStatus,
  ProcessingJobStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "./prisma";
import { AURELI_ENGINE_VERSION, productionConfig } from "./production-config";
import { secureTokenEqual } from "./secure-compare";

export function isWorkerAuthorized(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return secureTokenEqual(token, productionConfig.workerSecret);
}

export async function getWorkerJob(request: Request, documentId: string) {
  if (!isWorkerAuthorized(request)) return null;
  const jobId = request.headers.get("x-aureli-job-id");
  if (!jobId) return null;
  return prisma.processingJob.findFirst({
    where: { id: jobId, documentId, status: ProcessingJobStatus.RUNNING },
  });
}

export async function enqueueDocumentProcessing(params: {
  documentId: string;
  userId: string;
  workspaceId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const document = await tx.document.findFirst({
      where: { id: params.documentId, userId: params.userId },
      select: { id: true, version: true, status: true, workspaceId: true },
    });
    if (!document) throw new Error("DOCUMENT_NOT_FOUND");
    if (
      document.status === DocumentStatus.QUEUED ||
      document.status === DocumentStatus.PROCESSING
    ) {
      const active = await tx.processingJob.findFirst({
        where: {
          documentId: document.id,
          status: { in: [ProcessingJobStatus.QUEUED, ProcessingJobStatus.RUNNING] },
        },
        orderBy: { createdAt: "desc" },
      });
      if (active) return active;
    }

    const nextVersion = document.version + 1;
    await tx.document.update({
      where: { id: document.id },
      data: {
        version: nextVersion,
        status: DocumentStatus.QUEUED,
        processingError: null,
        reviewStatus: DocumentReviewStatus.NEEDS_REVIEW,
        reviewedAt: null,
        reviewNote: null,
      },
    });
    await tx.ledgerEntry.deleteMany({ where: { documentId: document.id, userId: params.userId } });

    return tx.processingJob.create({
      data: {
        documentId: document.id,
        userId: params.userId,
        workspaceId: params.workspaceId ?? document.workspaceId,
        documentVersion: nextVersion,
        engineVersion: AURELI_ENGINE_VERSION,
        idempotencyKey: `${document.id}:${nextVersion}:${AURELI_ENGINE_VERSION}`,
      },
    });
  });
}

export async function claimNextProcessingJob() {
  const candidate = await prisma.processingJob.findFirst({
    where: {
      status: ProcessingJobStatus.QUEUED,
      availableAt: { lte: new Date() },
      attemptCount: { lt: 3 },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  if (!candidate) return null;

  const lockToken = randomUUID();
  const claimed = await prisma.processingJob.updateMany({
    where: { id: candidate.id, status: ProcessingJobStatus.QUEUED },
    data: {
      status: ProcessingJobStatus.RUNNING,
      lockToken,
      lockedAt: new Date(),
      heartbeatAt: new Date(),
      startedAt: candidate.startedAt ?? new Date(),
      attemptCount: { increment: 1 },
      lastError: null,
    },
  });
  if (claimed.count !== 1) return null;
  return prisma.processingJob.findUnique({ where: { id: candidate.id } });
}

export async function heartbeatProcessingJob(jobId: string) {
  await prisma.processingJob.updateMany({
    where: { id: jobId, status: ProcessingJobStatus.RUNNING },
    data: { heartbeatAt: new Date() },
  });
}

export async function completeProcessingJob(jobId: string, result?: Prisma.InputJsonValue) {
  await prisma.processingJob.updateMany({
    where: { id: jobId, status: ProcessingJobStatus.RUNNING },
    data: {
      status: ProcessingJobStatus.COMPLETED,
      finishedAt: new Date(),
      heartbeatAt: new Date(),
      result,
      lockToken: null,
    },
  });
}

export async function failProcessingJob(jobId: string, error: string) {
  const job = await prisma.processingJob.findFirst({
    where: { id: jobId, status: ProcessingJobStatus.RUNNING },
  });
  if (!job) return;
  const retry = job.attemptCount < job.maxAttempts;
  const delaySeconds = Math.min(900, 30 * 2 ** Math.max(0, job.attemptCount - 1));
  await prisma.$transaction([
    prisma.processingJob.update({
      where: { id: job.id },
      data: retry
        ? {
            status: ProcessingJobStatus.QUEUED,
            availableAt: new Date(Date.now() + delaySeconds * 1000),
            lastError: error.slice(0, 1200),
            lockToken: null,
            lockedAt: null,
            heartbeatAt: null,
          }
        : {
            status: ProcessingJobStatus.FAILED,
            finishedAt: new Date(),
            lastError: error.slice(0, 1200),
            lockToken: null,
          },
    }),
    prisma.document.update({
      where: { id: job.documentId },
      data: {
        status: retry ? DocumentStatus.QUEUED : DocumentStatus.FAILED,
        processingError: retry ? null : error.slice(0, 1200),
      },
    }),
  ]);
}

export async function requeueStaleProcessingJobs() {
  const staleBefore = new Date(Date.now() - productionConfig.staleJobMinutes * 60_000);
  const stale = await prisma.processingJob.findMany({
    where: {
      status: ProcessingJobStatus.RUNNING,
      OR: [{ heartbeatAt: null }, { heartbeatAt: { lt: staleBefore } }],
    },
    select: { id: true, documentId: true, attemptCount: true, maxAttempts: true },
  });
  for (const job of stale) {
    const retry = job.attemptCount < job.maxAttempts;
    await prisma.$transaction([
      prisma.processingJob.update({
        where: { id: job.id },
        data: retry
          ? {
              status: ProcessingJobStatus.QUEUED,
              availableAt: new Date(),
              lastError: "Worker heartbeat expired; job was requeued.",
              lockToken: null,
              lockedAt: null,
              heartbeatAt: null,
            }
          : {
              status: ProcessingJobStatus.FAILED,
              finishedAt: new Date(),
              lastError: "Worker heartbeat expired after maximum attempts.",
              lockToken: null,
            },
      }),
      prisma.document.update({
        where: { id: job.documentId },
        data: {
          status: retry ? DocumentStatus.QUEUED : DocumentStatus.FAILED,
          processingError: retry ? null : "Processing worker stopped responding after maximum attempts.",
        },
      }),
    ]);
  }
  return stale.length;
}
