import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  DocumentReviewStatus,
  DocumentStatus,
} from "@prisma/client";
import { auth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { syncLedgerForReview } from "@/lib/transaction-ledger";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const VALID_REVIEW_STATUSES = [
  DocumentReviewStatus.NEEDS_REVIEW,
  DocumentReviewStatus.APPROVED,
  DocumentReviewStatus.REJECTED,
] as const;

type ReviewStatus =
  (typeof VALID_REVIEW_STATUSES)[number];

function isReviewStatus(
  value: unknown,
): value is ReviewStatus {
  return (
    typeof value === "string" &&
    VALID_REVIEW_STATUSES.includes(
      value as ReviewStatus,
    )
  );
}

function getReviewAuditType(
  reviewStatus: ReviewStatus,
) {
  if (
    reviewStatus ===
    DocumentReviewStatus.APPROVED
  ) {
    return "DOCUMENT_APPROVED" as const;
  }

  if (
    reviewStatus ===
    DocumentReviewStatus.REJECTED
  ) {
    return "DOCUMENT_REJECTED" as const;
  }

  return "DOCUMENT_REVIEW_RESET" as const;
}

function getReviewAuditTitle(
  reviewStatus: ReviewStatus,
) {
  if (
    reviewStatus ===
    DocumentReviewStatus.APPROVED
  ) {
    return "Document approved";
  }

  if (
    reviewStatus ===
    DocumentReviewStatus.REJECTED
  ) {
    return "Document rejected";
  }

  return "Document moved back to review";
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const session =
      await auth.api.getSession({
        headers: await headers(),
      });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const body = await request
      .json()
      .catch(() => null);

    const reviewStatus =
      body?.reviewStatus;

    if (!isReviewStatus(reviewStatus)) {
      return NextResponse.json(
        { error: "Invalid review status." },
        { status: 400 },
      );
    }

    const reviewNote =
      typeof body?.reviewNote === "string"
        ? body.reviewNote.trim()
        : "";

    const document =
      await prisma.document.findFirst({
        where: {
          id,
          userId: session.user.id,
        },
        select: {
          id: true,
          fileName: true,
          status: true,
          reviewStatus: true,
        },
      });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 },
      );
    }

    if (
      reviewStatus ===
        DocumentReviewStatus.APPROVED &&
      document.status !==
        DocumentStatus.PROCESSED
    ) {
      return NextResponse.json(
        {
          error:
            "Only processed documents can be approved.",
        },
        { status: 400 },
      );
    }

    const updatedDocument =
      await prisma.document.update({
        where: {
          id: document.id,
        },
        data: {
          reviewStatus,
          reviewedAt: new Date(),
          reviewNote:
            reviewNote || null,
        },
        select: {
          id: true,
          fileName: true,
          reviewStatus: true,
          reviewedAt: true,
          reviewNote: true,
        },
      });

    const ledgerEntryCount =
      await syncLedgerForReview({
        documentId: document.id,
        userId: session.user.id,
        reviewStatus,
      });

    await createAuditEvent({
      userId: session.user.id,
      eventType:
        getReviewAuditType(reviewStatus),
      title:
        getReviewAuditTitle(reviewStatus),
      description:
        reviewStatus ===
        DocumentReviewStatus.APPROVED
          ? `${document.fileName} is trusted and ${ledgerEntryCount} ledger entries were synchronized.`
          : reviewStatus ===
              DocumentReviewStatus.REJECTED
            ? `${document.fileName} was rejected and removed from the trusted ledger.`
            : `${document.fileName} was moved back to review and removed from the trusted ledger.`,
      documentId: document.id,
      fileName: document.fileName,
      metadata: {
        previousReviewStatus:
          document.reviewStatus,
        newReviewStatus:
          reviewStatus,
        reviewNote:
          reviewNote || null,
        ledgerEntryCount,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/documents");
    revalidatePath(
      `/documents/${document.id}`,
    );
    revalidatePath("/ledger");

    return NextResponse.json({
      success: true,
      document: updatedDocument,
      ledgerEntryCount,
    });
  } catch (error) {
    console.error(
      "Document review update error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong while updating review status.",
      },
      { status: 500 },
    );
  }
}