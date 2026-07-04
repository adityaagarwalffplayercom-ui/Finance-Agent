"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentListItem } from "@/lib/documents";
import { categoryLabel, formatFileSize } from "@/lib/document-categories";
import type { ExtractedDocumentData } from "@/lib/gemini";

type ReviewStatus = "NEEDS_REVIEW" | "APPROVED" | "REJECTED";

const STATUS_LABEL: Record<string, string> = {
  UPLOADED: "Uploaded",
  PROCESSING: "Processing",
  PROCESSED: "Processed",
  FAILED: "Failed",
};

const STATUS_STYLE: Record<
  string,
  {
    label: string;
    background: string;
    color: string;
    border: string;
  }
> = {
  UPLOADED: {
    label: "Ready",
    background: "rgba(88,166,255,0.12)",
    color: "#8abfff",
    border: "rgba(88,166,255,0.28)",
  },
  PROCESSING: {
    label: "Processing",
    background: "rgba(255,193,7,0.12)",
    color: "#ffd166",
    border: "rgba(255,193,7,0.28)",
  },
  PROCESSED: {
    label: "Processed",
    background: "rgba(46,213,115,0.12)",
    color: "#7bed9f",
    border: "rgba(46,213,115,0.28)",
  },
  FAILED: {
    label: "Failed",
    background: "rgba(255,71,87,0.12)",
    color: "#ff8a95",
    border: "rgba(255,71,87,0.28)",
  },
};

const REVIEW_STYLE: Record<
  ReviewStatus,
  {
    label: string;
    background: string;
    color: string;
    border: string;
  }
> = {
  NEEDS_REVIEW: {
    label: "Needs review",
    background: "rgba(255,193,7,0.12)",
    color: "#ffd166",
    border: "rgba(255,193,7,0.28)",
  },
  APPROVED: {
    label: "Approved",
    background: "rgba(46,213,115,0.12)",
    color: "#7bed9f",
    border: "rgba(46,213,115,0.28)",
  },
  REJECTED: {
    label: "Rejected",
    background: "rgba(255,71,87,0.12)",
    color: "#ff8a95",
    border: "rgba(255,71,87,0.28)",
  },
};

function formatAmount(amount: number, currency?: string | null) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toLocaleString("en-US");
  }
}

function formatDocumentAmount(
  amount: number,
  currency: string | null | undefined,
  category: string,
) {
  if (category === "FINANCIAL_STATEMENT") {
    const isNegative = amount < 0;
    const absoluteAmount = Math.abs(amount);

    return `${isNegative ? "-" : ""}${formatAmount(
      absoluteAmount,
      currency,
    )}M`;
  }

  return formatAmount(amount, currency);
}

function Pill({
  label,
  color,
  background,
  border,
}: {
  label: string;
  color: string;
  background: string;
  border: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        border: `1px solid ${border}`,
        background,
        color,
        borderRadius: 999,
        padding: "7px 10px",
        fontSize: 12,
        fontWeight: 850,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: color,
          boxShadow: `0 0 12px ${color}`,
        }}
      />
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.UPLOADED;

  return <Pill {...style} />;
}

function ReviewPill({ status }: { status: ReviewStatus }) {
  const style = REVIEW_STYLE[status] ?? REVIEW_STYLE.NEEDS_REVIEW;

  return <Pill {...style} />;
}

export function DocumentRow({ doc }: { doc: DocumentListItem }) {
  const router = useRouter();

  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const extracted = doc.extractedData as ExtractedDocumentData | null;
  const canProcess = doc.status === "UPLOADED" || doc.status === "FAILED";
  const canApprove = doc.status === "PROCESSED";
  const reviewStatus = doc.reviewStatus as ReviewStatus;

  async function handleDelete() {
    if (!window.confirm(`Delete "${doc.fileName}"? This can't be undone.`)) {
      return;
    }

    setIsDeleting(true);

    const response = await fetch(`/api/documents/${doc.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      router.refresh();
      return;
    }

    setIsDeleting(false);
  }

  async function handleProcess() {
    setIsProcessing(true);
    setProcessError(null);

    const response = await fetch(`/api/documents/${doc.id}/process`, {
      method: "POST",
    });

    setIsProcessing(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      setProcessError(data?.error ?? "Processing failed. Try again.");
      router.refresh();
      return;
    }

    router.refresh();
  }

  async function handleReview(nextStatus: ReviewStatus) {
    setIsReviewing(true);
    setReviewError(null);

    try {
      const response = await fetch(`/api/documents/${doc.id}/review`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewStatus: nextStatus,
          reviewNote:
            nextStatus === "APPROVED"
              ? "Approved from document trust center."
              : nextStatus === "REJECTED"
                ? "Rejected from document trust center."
                : "Marked for review from document trust center.",
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to update review status.");
      }

      router.refresh();
    } catch (error) {
      setReviewError(
        error instanceof Error
          ? error.message
          : "Failed to update review status.",
      );
    } finally {
      setIsReviewing(false);
    }
  }

  return (
    <article
      style={{
        display: "grid",
        gap: 16,
        padding: 18,
        border: "1px solid var(--color-border)",
        background: "rgba(255,255,255,0.025)",
        borderRadius: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 360px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                color: "var(--color-text-secondary)",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 850,
              }}
            >
              {categoryLabel(doc.category)}
            </span>

            <StatusPill status={doc.status} />
            <ReviewPill status={reviewStatus} />
          </div>

          <h3
            style={{
              margin: "0 0 8px",
              color: "var(--color-text-primary)",
              fontSize: 17,
              lineHeight: 1.35,
              wordBreak: "break-word",
            }}
          >
            {doc.fileName}
          </h3>

          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {formatFileSize(doc.fileSize)} ·{" "}
            {STATUS_LABEL[doc.status] ?? doc.status} · Uploaded{" "}
            {new Date(doc.uploadedAt).toLocaleDateString("en-US")}
            {doc.reviewedAt
              ? ` · Reviewed ${new Date(doc.reviewedAt).toLocaleDateString(
                  "en-US",
                )}`
              : ""}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <Link
            href={`/documents/${doc.id}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--color-text-primary)",
              borderRadius: 13,
              padding: "10px 13px",
              fontSize: 13,
              fontWeight: 850,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            View details
          </Link>

          {canProcess && (
            <button
              type="button"
              onClick={handleProcess}
              disabled={isProcessing || isDeleting || isReviewing}
              style={{
                border: "1px solid rgba(255,255,255,0.16)",
                background:
                  doc.status === "FAILED"
                    ? "linear-gradient(135deg, rgba(255,159,67,0.95), rgba(255,71,87,0.95))"
                    : "linear-gradient(135deg, var(--color-accent), #7c3aed)",
                color: "white",
                borderRadius: 13,
                padding: "10px 13px",
                fontSize: 13,
                fontWeight: 900,
                cursor:
                  isProcessing || isDeleting || isReviewing
                    ? "not-allowed"
                    : "pointer",
                opacity: isProcessing || isDeleting || isReviewing ? 0.65 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {isProcessing
                ? "Analyzing..."
                : doc.status === "FAILED"
                  ? "Retry analysis"
                  : "Process with AI"}
            </button>
          )}

          {canApprove && reviewStatus !== "APPROVED" && (
            <button
              type="button"
              onClick={() => handleReview("APPROVED")}
              disabled={isReviewing || isDeleting || isProcessing}
              style={{
                border: "1px solid rgba(46,213,115,0.35)",
                background: "rgba(46,213,115,0.14)",
                color: "#7bed9f",
                borderRadius: 13,
                padding: "10px 13px",
                fontSize: 13,
                fontWeight: 900,
                cursor:
                  isReviewing || isDeleting || isProcessing
                    ? "not-allowed"
                    : "pointer",
                opacity: isReviewing || isDeleting || isProcessing ? 0.65 : 1,
                whiteSpace: "nowrap",
              }}
            >
              Approve
            </button>
          )}

          {canApprove && reviewStatus !== "REJECTED" && (
            <button
              type="button"
              onClick={() => handleReview("REJECTED")}
              disabled={isReviewing || isDeleting || isProcessing}
              style={{
                border: "1px solid rgba(255,71,87,0.35)",
                background: "rgba(255,71,87,0.10)",
                color: "#ff8a95",
                borderRadius: 13,
                padding: "10px 13px",
                fontSize: 13,
                fontWeight: 850,
                cursor:
                  isReviewing || isDeleting || isProcessing
                    ? "not-allowed"
                    : "pointer",
                opacity: isReviewing || isDeleting || isProcessing ? 0.65 : 1,
                whiteSpace: "nowrap",
              }}
            >
              Reject
            </button>
          )}

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || isProcessing || isReviewing}
            style={{
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--color-text-secondary)",
              borderRadius: 13,
              padding: "10px 13px",
              fontSize: 13,
              fontWeight: 800,
              cursor:
                isDeleting || isProcessing || isReviewing
                  ? "not-allowed"
                  : "pointer",
              opacity: isDeleting || isProcessing || isReviewing ? 0.65 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {isDeleting ? "Removing..." : "Delete"}
          </button>
        </div>
      </div>

      {doc.status === "PROCESSED" && extracted && (
        <div
          style={{
            border: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.025)",
            borderRadius: 16,
            padding: 14,
          }}
        >
          {extracted.summary && (
            <p
              style={{
                margin: "0 0 10px",
                color: "var(--color-text-primary)",
                fontSize: 14,
                lineHeight: 1.55,
              }}
            >
              {extracted.summary}
            </p>
          )}

          {typeof extracted.totalAmount === "number" && (
            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 13,
              }}
            >
              <strong style={{ color: "var(--color-text-primary)" }}>
                {extracted.totalAmountLabel ?? "Total"}:
              </strong>{" "}
              {formatDocumentAmount(
                extracted.totalAmount,
                extracted.currency,
                doc.category,
              )}
            </p>
          )}
        </div>
      )}

      {reviewStatus === "APPROVED" && (
        <p
          style={{
            margin: 0,
            color: "#7bed9f",
            fontSize: 13,
            lineHeight: 1.5,
            fontWeight: 750,
          }}
        >
          This document is trusted and included in dashboard, AI Team, and chat.
        </p>
      )}

      {reviewStatus === "REJECTED" && (
        <p
          style={{
            margin: 0,
            color: "#ff8a95",
            fontSize: 13,
            lineHeight: 1.5,
            fontWeight: 750,
          }}
        >
          This document is rejected and excluded from trusted financial analysis.
        </p>
      )}

      {reviewStatus === "NEEDS_REVIEW" && doc.status === "PROCESSED" && (
        <p
          style={{
            margin: 0,
            color: "#ffd166",
            fontSize: 13,
            lineHeight: 1.5,
            fontWeight: 750,
          }}
        >
          Review this AI extraction before it affects dashboard and AI answers.
        </p>
      )}

      {doc.status === "FAILED" && doc.processingError && (
        <p
          style={{
            margin: 0,
            color: "#ff8a95",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {doc.processingError}
        </p>
      )}

      {processError && (
        <p
          style={{
            margin: 0,
            color: "#ff8a95",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {processError}
        </p>
      )}

      {reviewError && (
        <p
          style={{
            margin: 0,
            color: "#ff8a95",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {reviewError}
        </p>
      )}
    </article>
  );
}