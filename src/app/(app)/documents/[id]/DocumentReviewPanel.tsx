"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ReviewStatus = "NEEDS_REVIEW" | "APPROVED" | "REJECTED";

type DocumentReviewPanelProps = {
  documentId: string;
  fileName: string;
  status: string;
  initialReviewStatus: ReviewStatus;
  initialReviewNote?: string | null;
};

const REVIEW_COPY: Record<
  ReviewStatus,
  {
    title: string;
    description: string;
    color: string;
    background: string;
    border: string;
  }
> = {
  NEEDS_REVIEW: {
    title: "Needs review",
    description:
      "AI extracted the document, but it is not trusted yet. Approve it before using it in dashboard and AI answers.",
    color: "#ffd166",
    background: "rgba(255,193,7,0.10)",
    border: "rgba(255,193,7,0.30)",
  },
  APPROVED: {
    title: "Trusted data",
    description:
      "This document is approved and can update dashboard, AI Team, and finance chat.",
    color: "#7bed9f",
    background: "rgba(46,213,115,0.10)",
    border: "rgba(46,213,115,0.30)",
  },
  REJECTED: {
    title: "Rejected data",
    description:
      "This document is excluded from dashboard, AI Team, and finance chat.",
    color: "#ff8a95",
    background: "rgba(255,71,87,0.10)",
    border: "rgba(255,71,87,0.30)",
  },
};

async function readErrorMessage(response: Response) {
  try {
    const data = await response.json();

    if (typeof data?.error === "string") {
      return data.error;
    }

    return "Review update failed.";
  } catch {
    return "Review update failed.";
  }
}

export function DocumentReviewPanel({
  documentId,
  fileName,
  status,
  initialReviewStatus,
  initialReviewNote,
}: DocumentReviewPanelProps) {
  const router = useRouter();

  const [reviewNote, setReviewNote] = useState(initialReviewNote ?? "");
  const [currentReviewStatus, setCurrentReviewStatus] =
    useState<ReviewStatus>(initialReviewStatus);
  const [loadingStatus, setLoadingStatus] = useState<ReviewStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reviewCopy = REVIEW_COPY[currentReviewStatus];
  const canApprove = status === "PROCESSED";

  async function updateReviewStatus(reviewStatus: ReviewStatus) {
    if (loadingStatus) return;

    setError(null);
    setLoadingStatus(reviewStatus);

    try {
      const response = await fetch(`/api/documents/${documentId}/review`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewStatus,
          reviewNote,
        }),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response);
        setError(message);
        return;
      }

      setCurrentReviewStatus(reviewStatus);
      router.refresh();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Review update failed.",
      );
    } finally {
      setLoadingStatus(null);
    }
  }

  return (
    <section
      style={{
        border: `1px solid ${reviewCopy.border}`,
        background: reviewCopy.background,
        borderRadius: 22,
        padding: 18,
        display: "grid",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 7,
            maxWidth: 760,
          }}
        >
          <span
            style={{
              color: reviewCopy.color,
              fontSize: 12,
              fontWeight: 950,
              textTransform: "uppercase",
              letterSpacing: "0.10em",
            }}
          >
            Review decision
          </span>

          <h2
            style={{
              margin: 0,
              color: "var(--color-text-primary)",
              fontSize: 22,
              lineHeight: 1.2,
            }}
          >
            {reviewCopy.title}
          </h2>

          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
              fontSize: 14,
            }}
          >
            {reviewCopy.description}
          </p>
        </div>

        <span
          style={{
            border: `1px solid ${reviewCopy.border}`,
            background: "rgba(0,0,0,0.16)",
            color: reviewCopy.color,
            borderRadius: 999,
            padding: "8px 11px",
            fontSize: 12,
            fontWeight: 950,
            whiteSpace: "nowrap",
          }}
        >
          {currentReviewStatus.replace("_", " ")}
        </span>
      </div>

      <label
        style={{
          display: "grid",
          gap: 8,
        }}
      >
        <span
          style={{
            color: "var(--color-text-secondary)",
            fontSize: 13,
            fontWeight: 850,
          }}
        >
          Review note
        </span>

        <textarea
          value={reviewNote}
          onChange={(event) => setReviewNote(event.target.value)}
          placeholder={`Optional note for ${fileName}`}
          rows={3}
          style={{
            width: "100%",
            border: "1px solid var(--color-border)",
            background: "rgba(0,0,0,0.14)",
            color: "var(--color-text-primary)",
            borderRadius: 14,
            padding: 12,
            resize: "vertical",
            outline: "none",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        />
      </label>

      {error && (
        <div
          style={{
            border: "1px solid rgba(255,71,87,0.30)",
            background: "rgba(255,71,87,0.09)",
            color: "#ff8a95",
            borderRadius: 14,
            padding: 12,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          disabled={!canApprove || Boolean(loadingStatus)}
          onClick={() => updateReviewStatus("APPROVED")}
          style={{
            border: "1px solid rgba(46,213,115,0.36)",
            background: "rgba(46,213,115,0.12)",
            color: "#7bed9f",
            borderRadius: 13,
            padding: "10px 13px",
            fontSize: 13,
            fontWeight: 900,
            cursor: !canApprove || loadingStatus ? "not-allowed" : "pointer",
            opacity: !canApprove || loadingStatus ? 0.6 : 1,
          }}
        >
          {loadingStatus === "APPROVED"
            ? "Approving..."
            : "Approve & trust data"}
        </button>

        <button
          type="button"
          disabled={Boolean(loadingStatus)}
          onClick={() => updateReviewStatus("REJECTED")}
          style={{
            border: "1px solid rgba(255,71,87,0.36)",
            background: "rgba(255,71,87,0.10)",
            color: "#ff8a95",
            borderRadius: 13,
            padding: "10px 13px",
            fontSize: 13,
            fontWeight: 900,
            cursor: loadingStatus ? "not-allowed" : "pointer",
            opacity: loadingStatus ? 0.6 : 1,
          }}
        >
          {loadingStatus === "REJECTED" ? "Rejecting..." : "Reject data"}
        </button>

        <button
          type="button"
          disabled={Boolean(loadingStatus)}
          onClick={() => updateReviewStatus("NEEDS_REVIEW")}
          style={{
            border: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--color-text-primary)",
            borderRadius: 13,
            padding: "10px 13px",
            fontSize: 13,
            fontWeight: 900,
            cursor: loadingStatus ? "not-allowed" : "pointer",
            opacity: loadingStatus ? 0.6 : 1,
          }}
        >
          {loadingStatus === "NEEDS_REVIEW"
            ? "Updating..."
            : "Move back to review"}
        </button>
      </div>

      {!canApprove && (
        <p
          style={{
            margin: 0,
            color: "var(--color-text-muted)",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          Approval is available only after AI processing is completed.
        </p>
      )}
    </section>
  );
}