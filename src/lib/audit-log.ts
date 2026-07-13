import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { logger } from "./logger";

export type AuditEventType =
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_PROCESSING_QUEUED"
  | "DOCUMENT_PROCESSING_STARTED"
  | "DOCUMENT_PROCESSING_COMPLETED"
  | "DOCUMENT_PROCESSING_FAILED"
  | "DOCUMENT_APPROVED"
  | "DOCUMENT_REJECTED"
  | "DOCUMENT_REVIEW_RESET"
  | "DOCUMENT_CORRECTED"
  | "DOCUMENT_DELETED"
  | "UPLOAD_BLOCKED"
  | "PROCESSING_BLOCKED"
  | "LEDGER_ENTRY_UPDATED"
  | "MANUAL_LEDGER_ENTRY_CREATED"
  | "MANUAL_LEDGER_ENTRY_DELETED"
  | "WORKSPACE_MEMBER_ADDED"
  | "WORKSPACE_MEMBER_INVITED"
  | "WORKSPACE_MEMBER_REMOVED"
  | "WORKSPACE_SETTINGS_UPDATED"
  | "ACTIVE_WORKSPACE_CHANGED"
  | "RETENTION_DELETE";

type CreateAuditEventInput = {
  userId: string;
  workspaceId?: string | null;
  eventType: AuditEventType;
  title: string;
  description?: string;
  documentId?: string | null;
  fileName?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function createAuditEvent(input: CreateAuditEventInput) {
  try {
    await prisma.auditEvent.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        eventType: input.eventType,
        title: input.title,
        description: input.description ?? null,
        documentId: input.documentId ?? null,
        fileName: input.fileName ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (error) {
    logger.error("audit.write_failed", error, {
      userId: input.userId,
      eventType: input.eventType,
      documentId: input.documentId,
    });
  }
}

export async function getAuditEventsForUser(userId: string, limit = 80) {
  return prisma.auditEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      eventType: true,
      title: true,
      description: true,
      documentId: true,
      fileName: true,
      metadata: true,
      createdAt: true,
    },
  });
}
