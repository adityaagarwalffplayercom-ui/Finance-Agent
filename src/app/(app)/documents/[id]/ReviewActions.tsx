"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ReviewStatus = "NEEDS_REVIEW" | "APPROVED" | "REJECTED";

type ReviewActionsProps = {
  documentId: string;
  reviewStatus: ReviewStatus;
  processingStatus: string;
  reviewNote?: string | null;
  reviewedAt?: string | null;
};

const REVIEW_STYLE: Record<
  ReviewStatus,
  {
    label: string;
    color: string;
    background: string;
    border: string;
    description: string;
  }
> = {
  NEEDS_REVIEW: {
    label: "Needs review",
    color: "#ffd166",
    background: "rgba(255,193,7,0.10)",
    border: "rgba(255,193,7,0.28)",
    description:
      "AI extracted this data, but it should be verified before being treated as trusted financial data.",
  },
  APPROVED: {
    label: "Approved",
    color: "#7bed9f",
    background: "rgba(46,213,115,0.10)",
    border: "rgba(46,213,115,0.28)",
    description:
      "This extraction has been approved and can be treated as trusted business data.",
  },
  REJECTED: {
    label: "Rejected",
    color: "#ff8a95",
    background: "rgba(255,71,87,0.10)",
    border: "rgba(255,71,87,0.28)",
    description:
      "This extraction has been rejected and should not be trusted for financial decisions.",
  },
};

export function ReviewActions({
  documentId,
  reviewStatus,
  processingStatus,
  reviewNote,
  reviewedAt,
}: ReviewActionsProps) {
  const router = useRouter();

  const [note, setNote] = useState(reviewNote ?? "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const style = REVIEW_STYLE[reviewStatus] ?? REVIEW_STYLE.NEEDS_REVIEW;
  const canApprove = processingStatus === "PROCESSED";

  async function updateReviewStatus(nextStatus: ReviewStatus) {
    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${documentId}/review`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewStatus: nextStatus,
          reviewNote: note,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to update review status.");
      }

      router.refresh();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update review status.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <section
      className="alerts-card"
      style={{
        display: "grid",
        gap: 18,
        marginBottom: 28,
        border: `1px solid ${style.border}`,
        background: style.background,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <p className="section-title">Human review status</p>
          <p className="section-hint">
            Approve or reject AI-extracted financial data before trusting it.
          </p>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: `1px solid ${style.border}`,
            background: "rgba(0,0,0,0.16)",
            color: style.color,
            borderRadius: 999,
            padding: "9px 12px",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: style.color,
              boxShadow: `0 0 12px ${style.color}`,
            }}
          />
          {style.label}
        </span>
      </div>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-primary)",
          fontSize: 14,
          lineHeight: 1.65,
        }}
      >
        {style.description}
      </p>

      {reviewedAt && (
        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 13,
          }}
        >
          Last reviewed: {new Date(reviewedAt).toLocaleString("en-US")}
        </p>
      )}

      <div>
        <label
          htmlFor="review-note"
          style={{
            display: "block",
            marginBottom: 8,
            color: "var(--color-text-secondary)",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 800,
          }}
        >
          Review note
        </label>

        <textarea
          id="review-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional: mention what you verified or why you rejected this extraction."
          rows={3}
          style={{
            width: "100%",
            resize: "vertical",
            border: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--color-text-primary)",
            borderRadius: 14,
            padding: 12,
            fontSize: 14,
            lineHeight: 1.5,
            outline: "none",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => updateReviewStatus("APPROVED")}
          disabled={isUpdating || !canApprove}
          style={{
            border: "1px solid rgba(46,213,115,0.35)",
            background: "rgba(46,213,115,0.16)",
            color: "#7bed9f",
            borderRadius: 14,
            padding: "11px 14px",
            fontSize: 13,
            fontWeight: 900,
            cursor: isUpdating || !canApprove ? "not-allowed" : "pointer",
            opacity: isUpdating || !canApprove ? 0.6 : 1,
          }}
        >
          Approve extraction
        </button>

        <button
          type="button"
          onClick={() => updateReviewStatus("REJECTED")}
          disabled={isUpdating}
          style={{
            border: "1px solid rgba(255,71,87,0.35)",
            background: "rgba(255,71,87,0.12)",
            color: "#ff8a95",
            borderRadius: 14,
            padding: "11px 14px",
            fontSize: 13,
            fontWeight: 900,
            cursor: isUpdating ? "not-allowed" : "pointer",
            opacity: isUpdating ? 0.6 : 1,
          }}
        >
          Reject extraction
        </button>

        <button
          type="button"
          onClick={() => updateReviewStatus("NEEDS_REVIEW")}
          disabled={isUpdating}
          style={{
            border: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--color-text-secondary)",
            borderRadius: 14,
            padding: "11px 14px",
            fontSize: 13,
            fontWeight: 900,
            cursor: isUpdating ? "not-allowed" : "pointer",
            opacity: isUpdating ? 0.6 : 1,
          }}
        >
          Mark needs review
        </button>
      </div>

      {!canApprove && (
        <p
          style={{
            margin: 0,
            color: "#ffd166",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          This document must be successfully processed before it can be approved.
        </p>
      )}

      {error && (
        <p
          style={{
            margin: 0,
            color: "#ff8a95",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {error}
        </p>
      )}
    </section>
  );
}