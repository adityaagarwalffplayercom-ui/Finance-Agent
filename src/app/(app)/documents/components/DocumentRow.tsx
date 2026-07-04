"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentListItem } from "@/lib/documents";
import { categoryLabel, formatFileSize } from "@/lib/document-categories";
import type { ExtractedDocumentData } from "@/lib/gemini";

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

function formatAmount(amount: number, currency?: string | null) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toLocaleString("en-US");
  }
}

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.UPLOADED;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        border: `1px solid ${style.border}`,
        background: style.background,
        color: style.color,
        borderRadius: 999,
        padding: "7px 10px",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: style.color,
          boxShadow: `0 0 12px ${style.color}`,
        }}
      />
      {style.label}
    </span>
  );
}

function ProcessingSpinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 14,
        height: 14,
        borderRadius: 999,
        border: "2px solid rgba(255,255,255,0.35)",
        borderTopColor: "white",
        display: "inline-block",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}

export function DocumentRow({ doc }: { doc: DocumentListItem }) {
  const router = useRouter();

  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);

  const extracted = doc.extractedData as ExtractedDocumentData | null;
  const canProcess = doc.status === "UPLOADED" || doc.status === "FAILED";

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

  return (
    <article
      className="alerts-card"
      style={{
        display: "grid",
        gap: 16,
        marginBottom: 18,
        padding: 20,
        borderRadius: 22,
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
                fontWeight: 700,
              }}
            >
              {categoryLabel(doc.category)}
            </span>

            <StatusPill status={doc.status} />
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
            {STATUS_LABEL[doc.status] ?? doc.status} ·{" "}
            {new Date(doc.uploadedAt).toLocaleDateString("en-US")}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {canProcess && (
            <button
              type="button"
              onClick={handleProcess}
              disabled={isProcessing || isDeleting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                border: "1px solid rgba(255,255,255,0.18)",
                background:
                  doc.status === "FAILED"
                    ? "linear-gradient(135deg, rgba(255,159,67,0.95), rgba(255,71,87,0.95))"
                    : "linear-gradient(135deg, var(--color-accent), #7c3aed)",
                color: "white",
                borderRadius: 14,
                padding: "11px 15px",
                fontSize: 13,
                fontWeight: 800,
                cursor: isProcessing || isDeleting ? "not-allowed" : "pointer",
                opacity: isProcessing || isDeleting ? 0.75 : 1,
                boxShadow: "0 14px 34px rgba(0,0,0,0.24)",
                transition:
                  "transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              {isProcessing ? (
                <>
                  <ProcessingSpinner />
                  Analyzing...
                </>
              ) : doc.status === "FAILED" ? (
                <>
                  <span aria-hidden="true">↻</span>
                  Retry analysis
                </>
              ) : (
                <>
                  <span aria-hidden="true">✨</span>
                  Process with AI
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || isProcessing}
            style={{
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--color-text-secondary)",
              borderRadius: 14,
              padding: "11px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: isDeleting || isProcessing ? "not-allowed" : "pointer",
              opacity: isDeleting || isProcessing ? 0.65 : 1,
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
            background: "rgba(255,255,255,0.03)",
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
              {formatAmount(extracted.totalAmount, extracted.currency)}
            </p>
          )}
        </div>
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

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        button:hover:not(:disabled) {
          transform: translateY(-1px);
        }
      `}</style>
    </article>
  );
}