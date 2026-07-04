"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentListItem } from "@/lib/documents";
import { categoryLabel, formatFileSize } from "@/lib/document-categories";
import type { ExtractedDocumentData } from "@/lib/gemini";

const STATUS_LABEL: Record<DocumentListItem["status"], string> = {
  UPLOADED: "Uploaded",
  PROCESSING: "Processing",
  PROCESSED: "Processed",
  FAILED: "Failed",
};

function formatAmount(amount: number, currency?: string | null) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Unrecognized currency code — fall back to a plain number.
    return amount.toLocaleString("en-US");
  }
}

export function DocumentRow({ doc }: { doc: DocumentListItem }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);

  const extracted = doc.extractedData as ExtractedDocumentData | null;

  async function handleDelete() {
    if (!window.confirm(`Delete "${doc.fileName}"? This can't be undone.`)) {
      return;
    }

    setIsDeleting(true);
    const response = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });

    if (response.ok) {
      router.refresh();
      return;
    }

    setIsDeleting(false);
  }

  async function handleProcess() {
    setIsProcessing(true);
    setProcessError(null);

    const response = await fetch(`/api/documents/${doc.id}/process`, { method: "POST" });

    setIsProcessing(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setProcessError(data?.error ?? "Processing failed. Try again.");
      router.refresh(); // status is now FAILED server-side even if this fetch errored
      return;
    }

    router.refresh();
  }

  const canProcess = doc.status === "UPLOADED" || doc.status === "FAILED";

  return (
    <li className="document-row">
      <div className="document-row-main">
        <span className="category-badge">{categoryLabel(doc.category)}</span>
        <div>
          <a
            className="document-row-name"
            href={`/api/documents/${doc.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {doc.fileName}
          </a>
          <p className="document-row-meta">
            {formatFileSize(doc.fileSize)} · {STATUS_LABEL[doc.status]} ·{" "}
            {new Date(doc.uploadedAt).toLocaleDateString("en-US")}
          </p>

          {doc.status === "PROCESSED" && extracted && (
            <div className="document-extracted">
              <p className="section-hint">{extracted.summary}</p>
              {typeof extracted.totalAmount === "number" && (
                <p className="document-extracted-amount">
                  {extracted.totalAmountLabel ?? "Total"}:{" "}
                  {formatAmount(extracted.totalAmount, extracted.currency)}
                </p>
              )}
            </div>
          )}

          {doc.status === "FAILED" && doc.processingError && (
            <p className="form-error" role="alert">
              {doc.processingError}
            </p>
          )}

          {processError && (
            <p className="form-error" role="alert">
              {processError}
            </p>
          )}
        </div>
      </div>

      <div className="document-row-actions">
        {canProcess && (
          <button
            type="button"
            className="btn-secondary"
            onClick={handleProcess}
            disabled={isProcessing}
          >
            {isProcessing ? "Processing…" : doc.status === "FAILED" ? "Retry" : "Process"}
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? "Removing…" : "Delete"}
        </button>
      </div>
    </li>
  );
}
