import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type AuditEventType =
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_PROCESSING_STARTED"
  | "DOCUMENT_PROCESSING_COMPLETED"
  | "DOCUMENT_PROCESSING_FAILED"
  | "DOCUMENT_APPROVED"
  | "DOCUMENT_REJECTED"
  | "DOCUMENT_REVIEW_RESET"
  | "DOCUMENT_DELETED"
  | "UPLOAD_BLOCKED"
  | "PROCESSING_BLOCKED"
  | "LEDGER_ENTRY_UPDATED"
  | "MANUAL_LEDGER_ENTRY_CREATED"
  | "MANUAL_LEDGER_ENTRY_DELETED";
type CreateAuditEventInput = {
  userId: string;
  eventType: AuditEventType;
  title: string;
  description?: string;
  documentId?: string | null;
  fileName?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function createAuditEvent({
  userId,
  eventType,
  title,
  description,
  documentId,
  fileName,
  metadata,
}: CreateAuditEventInput) {
  try {
    await prisma.auditEvent.create({
      data: {
        userId,
        eventType,
        title,
        description: description ?? null,
        documentId: documentId ?? null,
        fileName: fileName ?? null,
        metadata: metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error("Audit event write failed:", error);
  }
}

export async function getAuditEventsForUser(userId: string, limit = 80) {
  return prisma.auditEvent.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
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