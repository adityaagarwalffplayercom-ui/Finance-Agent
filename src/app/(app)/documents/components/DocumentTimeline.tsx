type TimelineStepState = "done" | "active" | "pending" | "failed";

type DocumentTimelineProps = {
  status: string;
  reviewStatus?: string | null;
  uploadedAt?: Date | string | null;
  extractedAt?: Date | string | null;
  reviewedAt?: Date | string | null;
  processingError?: string | null;
};

function formatTimelineDate(value?: Date | string | null) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStepTone(state: TimelineStepState) {
  if (state === "done") {
    return {
      border: "rgba(46,213,115,0.30)",
      background: "rgba(46,213,115,0.09)",
      color: "#7bed9f",
      dot: "#7bed9f",
    };
  }

  if (state === "active") {
    return {
      border: "rgba(255,193,7,0.34)",
      background: "rgba(255,193,7,0.10)",
      color: "#ffd166",
      dot: "#ffd166",
    };
  }

  if (state === "failed") {
    return {
      border: "rgba(255,71,87,0.34)",
      background: "rgba(255,71,87,0.09)",
      color: "#ff8a95",
      dot: "#ff8a95",
    };
  }

  return {
    border: "var(--color-border)",
    background: "rgba(255,255,255,0.025)",
    color: "var(--color-text-secondary)",
    dot: "rgba(255,255,255,0.28)",
  };
}

function getStepIcon(state: TimelineStepState) {
  if (state === "done") return "✓";
  if (state === "active") return "•";
  if (state === "failed") return "!";
  return "";
}

export function DocumentTimeline({
  status,
  reviewStatus,
  uploadedAt,
  extractedAt,
  reviewedAt,
  processingError,
}: DocumentTimelineProps) {
  const isUploaded = Boolean(uploadedAt);
  const isProcessing = status === "PROCESSING";
  const isProcessed = status === "PROCESSED";
  const isFailed = status === "FAILED";
  const isApproved = reviewStatus === "APPROVED";
  const isRejected = reviewStatus === "REJECTED";
  const needsReview = isProcessed && reviewStatus === "NEEDS_REVIEW";

  const steps: {
    label: string;
    description: string;
    date?: string | null;
    state: TimelineStepState;
  }[] = [
    {
      label: "Uploaded",
      description: "File saved in workspace",
      date: formatTimelineDate(uploadedAt),
      state: isUploaded ? "done" : "pending",
    },
    {
      label: "AI processing",
      description: isFailed
        ? "AI extraction failed"
        : isProcessing
          ? "Gemini is analyzing"
          : isProcessed
            ? "Extraction completed"
            : "Waiting for AI",
      date: formatTimelineDate(extractedAt),
      state: isFailed
        ? "failed"
        : isProcessing
          ? "active"
          : isProcessed
            ? "done"
            : "pending",
    },
    {
      label: "Review",
      description: isApproved
        ? "Approved as trusted"
        : isRejected
          ? "Rejected by reviewer"
          : needsReview
            ? "Waiting for approval"
            : "Not ready yet",
      date: formatTimelineDate(reviewedAt),
      state: isRejected
        ? "failed"
        : isApproved
          ? "done"
          : needsReview
            ? "active"
            : "pending",
    },
    {
      label: "Dashboard",
      description: isApproved
        ? "Included in finance intelligence"
        : "Excluded until approved",
      date: null,
      state: isApproved ? "done" : "pending",
    },
  ];

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        background: "rgba(255,255,255,0.025)",
        borderRadius: 18,
        padding: 14,
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "var(--color-text-primary)",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          Processing timeline
        </p>

        <span
          style={{
            color: isApproved
              ? "#7bed9f"
              : isRejected || isFailed
                ? "#ff8a95"
                : needsReview || isProcessing
                  ? "#ffd166"
                  : "var(--color-text-secondary)",
            fontSize: 12,
            fontWeight: 850,
          }}
        >
          {isApproved
            ? "Dashboard ready"
            : isRejected
              ? "Rejected"
              : isFailed
                ? "Failed"
                : needsReview
                  ? "Needs review"
                  : isProcessing
                    ? "Processing"
                    : "Ready to process"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        {steps.map((step) => {
          const tone = getStepTone(step.state);

          return (
            <div
              key={step.label}
              style={{
                border: `1px solid ${tone.border}`,
                background: tone.background,
                borderRadius: 15,
                padding: 12,
                display: "grid",
                gap: 8,
                minHeight: 108,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: tone.dot,
                    color:
                      step.state === "pending"
                        ? "transparent"
                        : "var(--color-base)",
                    fontSize: 12,
                    fontWeight: 950,
                    boxShadow:
                      step.state === "active"
                        ? `0 0 18px ${tone.dot}`
                        : "none",
                  }}
                >
                  {getStepIcon(step.state)}
                </span>

                <strong
                  style={{
                    color: tone.color,
                    fontSize: 12,
                    lineHeight: 1.2,
                  }}
                >
                  {step.label}
                </strong>
              </div>

              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontSize: 12,
                  lineHeight: 1.35,
                }}
              >
                {step.description}
              </p>

              {step.date && (
                <span
                  style={{
                    color: "var(--color-text-muted)",
                    fontSize: 11,
                    marginTop: "auto",
                  }}
                >
                  {step.date}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {isFailed && processingError && (
        <p
          style={{
            margin: 0,
            color: "#ff8a95",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          Failure reason: {processingError}
        </p>
      )}
    </div>
  );
}