"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentListItem } from "@/lib/documents";
import { categoryLabel, formatFileSize } from "@/lib/document-categories";
import type { ExtractedDocumentData } from "@/lib/gemini";
import { DocumentTimeline } from "./DocumentTimeline";

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
  string,
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
    label: "Trusted",
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
  const finalCurrency = currency ?? "INR";
  const absoluteValue = Math.abs(amount);

  let compactValue = amount;
  let suffix = "";

  if (absoluteValue >= 1_000_000_000) {
    compactValue = amount / 1_000_000_000;
    suffix = "B";
  } else if (absoluteValue >= 1_000_000) {
    compactValue = amount / 1_000_000;
    suffix = "M";
  } else if (absoluteValue >= 1_000) {
    compactValue = amount / 1_000;
    suffix = "K";
  }

  const currencySymbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
    CHF: "CHF ",
  };

  const symbol = currencySymbols[finalCurrency] ?? `${finalCurrency} `;

  const formattedNumber = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: compactValue % 1 === 0 ? 0 : 2,
  }).format(compactValue);

  return `${symbol}${formattedNumber}${suffix}`;
}

function getNumberValue(
  data: ExtractedDocumentData | null,
  keys: string[],
): number | null {
  if (!data) return null;

  const record = data as unknown as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }
  }

  return null;
}

function getStringValue(
  data: ExtractedDocumentData | null,
  keys: string[],
): string | null {
  if (!data) return null;

  const record = data as unknown as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.UPLOADED;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: `1px solid ${style.border}`,
        background: style.background,
        color: style.color,
        borderRadius: 999,
        padding: "6px 9px",
        fontSize: 12,
        fontWeight: 850,
      }}
    >
      {style.label}
    </span>
  );
}

function ReviewPill({ reviewStatus }: { reviewStatus: string }) {
  const style = REVIEW_STYLE[reviewStatus] ?? REVIEW_STYLE.NEEDS_REVIEW;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: `1px solid ${style.border}`,
        background: style.background,
        color: style.color,
        borderRadius: 999,
        padding: "6px 9px",
        fontSize: 12,
        fontWeight: 850,
      }}
    >
      {style.label}
    </span>
  );
}

async function readErrorMessage(response: Response) {
  try {
    const data = await response.json();

    if (typeof data?.error === "string") {
      return data.error;
    }

    if (typeof data?.message === "string") {
      return data.message;
    }

    return "Processing failed. Please try again.";
  } catch {
    return "Processing failed. Please try again.";
  }
}

function getFriendlyNetworkError(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message.toLowerCase().includes("failed to fetch") ||
      error.message.toLowerCase().includes("network")
    ) {
      return "Request was interrupted. Check if the dev server is still running, then retry once.";
    }

    return error.message;
  }

  return "Request was interrupted. Please retry once.";
}

export function DocumentRow({ doc }: { doc: DocumentListItem }) {
  const router = useRouter();

  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);

  const extracted = doc.extractedData as ExtractedDocumentData | null;
  const canProcess = doc.status === "UPLOADED" || doc.status === "FAILED";

  const currency = getStringValue(extracted, ["currency"]) ?? "INR";
  const displayAmount = getNumberValue(extracted, [
    "totalAmount",
    "revenue",
    "totalRevenue",
    "sales",
    "profit",
    "netIncome",
    "cash",
    "closingBalance",
  ]);

  const displayAmountLabel =
    getStringValue(extracted, ["totalAmountLabel"]) ??
    (getNumberValue(extracted, ["revenue", "totalRevenue", "sales"]) !== null
      ? "Revenue"
      : getNumberValue(extracted, ["profit", "netIncome"]) !== null
        ? "Profit"
        : getNumberValue(extracted, ["cash", "closingBalance"]) !== null
          ? "Cash"
          : "Key amount");

  async function handleDelete() {
    if (isDeleting || isProcessing) return;

    if (!window.confirm(`Delete "${doc.fileName}"? This can't be undone.`)) {
      return;
    }

    setIsDeleting(true);
    setProcessError(null);

    try {
      const response = await fetch(`/api/documents/${doc.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.refresh();
        return;
      }

      const message = await readErrorMessage(response);
      setProcessError(message);
    } catch (error) {
      setProcessError(getFriendlyNetworkError(error));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleProcess() {
    if (isProcessing || isDeleting) return;

    setIsProcessing(true);
    setProcessError(null);

    try {
      const response = await fetch(`/api/documents/${doc.id}/process`, {
        method: "POST",
      });

      if (!response.ok) {
        const message = await readErrorMessage(response);
        setProcessError(message);
        router.refresh();
        return;
      }

      router.refresh();
    } catch (error) {
      setProcessError(getFriendlyNetworkError(error));
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <article
      style={{
        border: "1px solid var(--color-border)",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.022))",
        borderRadius: 22,
        padding: 18,
        display: "grid",
        gap: 14,
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
            minWidth: 0,
          }}
        >
          <span
            style={{
              color: "var(--color-amber)",
              fontSize: 12,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.10em",
            }}
          >
            {categoryLabel(doc.category)}
          </span>

          <h3
            style={{
              margin: 0,
              color: "var(--color-text-primary)",
              fontSize: 16,
              fontWeight: 900,
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
              lineHeight: 1.45,
            }}
          >
            {formatFileSize(doc.fileSize)} ·{" "}
            {STATUS_LABEL[doc.status] ?? doc.status} ·{" "}
            {new Date(doc.uploadedAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <StatusPill status={doc.status} />
          <ReviewPill reviewStatus={doc.reviewStatus} />
        </div>
      </div>

      <DocumentTimeline
        status={doc.status}
        reviewStatus={doc.reviewStatus}
        uploadedAt={doc.uploadedAt}
        extractedAt={doc.extractedAt}
        reviewedAt={doc.reviewedAt}
        processingError={doc.processingError}
      />

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
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
            borderRadius: 12,
            padding: "9px 12px",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 850,
          }}
        >
          View details
        </Link>

        {canProcess && (
          <button
            type="button"
            onClick={handleProcess}
            disabled={isProcessing || isDeleting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(245,158,11,0.38)",
              background: "rgba(245,158,11,0.12)",
              color: "var(--color-amber)",
              borderRadius: 12,
              padding: "9px 12px",
              cursor: isProcessing || isDeleting ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 850,
              opacity: isProcessing || isDeleting ? 0.65 : 1,
            }}
          >
            {isProcessing
              ? "Analyzing..."
              : doc.status === "FAILED"
                ? "↻ Retry analysis"
                : "✨ Process with AI"}
          </button>
        )}

        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting || isProcessing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(255,71,87,0.32)",
            background: "rgba(255,71,87,0.08)",
            color: "#ff8a95",
            borderRadius: 12,
            padding: "9px 12px",
            cursor: isDeleting || isProcessing ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 850,
            opacity: isDeleting || isProcessing ? 0.65 : 1,
          }}
        >
          {isDeleting ? "Removing..." : "Delete"}
        </button>
      </div>

      {isProcessing && (
        <div
          style={{
            border: "1px solid rgba(255,193,7,0.28)",
            background: "rgba(255,193,7,0.08)",
            color: "#ffd166",
            borderRadius: 14,
            padding: 12,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          Gemini is analyzing this document. If quota is hit, the backend may
          wait and retry automatically. Do not click Retry again while this is
          running.
        </div>
      )}

      {doc.status === "PROCESSED" && extracted && (
        <div
          style={{
            border: "1px solid rgba(46,213,115,0.22)",
            background: "rgba(46,213,115,0.07)",
            borderRadius: 14,
            padding: 12,
            display: "grid",
            gap: 8,
          }}
        >
          {extracted.summary && (
            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {extracted.summary}
            </p>
          )}

          {typeof displayAmount === "number" && (
            <p
              style={{
                margin: 0,
                color: "var(--color-text-primary)",
                fontSize: 13,
                fontWeight: 850,
              }}
            >
              {displayAmountLabel}: {formatAmount(displayAmount, currency)}
            </p>
          )}
        </div>
      )}

      {doc.status === "FAILED" && doc.processingError && (
        <div
          style={{
            border: "1px solid rgba(255,71,87,0.28)",
            background: "rgba(255,71,87,0.08)",
            color: "#ff8a95",
            borderRadius: 14,
            padding: 12,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {doc.processingError}
        </div>
      )}

      {processError && (
        <div
          style={{
            border: "1px solid rgba(255,71,87,0.28)",
            background: "rgba(255,71,87,0.08)",
            color: "#ff8a95",
            borderRadius: 14,
            padding: 12,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {processError}
        </div>
      )}
    </article>
  );
}