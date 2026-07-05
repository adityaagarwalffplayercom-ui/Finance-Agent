"use client";

import { useMemo, useState } from "react";
import type { DocumentListItem } from "@/lib/documents";
import { DocumentRow } from "./DocumentRow";

type FilterId =
  | "ALL"
  | "READY"
  | "PROCESSING"
  | "NEEDS_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "FAILED";

type FilterConfig = {
  id: FilterId;
  label: string;
  description: string;
  tone: "blue" | "yellow" | "green" | "red" | "neutral";
};

const FILTERS: FilterConfig[] = [
  {
    id: "ALL",
    label: "All",
    description: "Every uploaded document",
    tone: "neutral",
  },
  {
    id: "READY",
    label: "Ready",
    description: "Waiting for AI processing",
    tone: "blue",
  },
  {
    id: "PROCESSING",
    label: "Processing",
    description: "AI is analyzing",
    tone: "yellow",
  },
  {
    id: "NEEDS_REVIEW",
    label: "Needs review",
    description: "AI extracted, approval pending",
    tone: "yellow",
  },
  {
    id: "APPROVED",
    label: "Approved",
    description: "Trusted by dashboard",
    tone: "green",
  },
  {
    id: "REJECTED",
    label: "Rejected",
    description: "Excluded from analysis",
    tone: "red",
  },
  {
    id: "FAILED",
    label: "Failed",
    description: "Needs retry",
    tone: "red",
  },
];

function getToneStyle(tone: FilterConfig["tone"], isActive: boolean) {
  const styles = {
    blue: {
      border: "rgba(88,166,255,0.34)",
      background: "rgba(88,166,255,0.10)",
      color: "#8abfff",
    },
    yellow: {
      border: "rgba(255,193,7,0.34)",
      background: "rgba(255,193,7,0.10)",
      color: "#ffd166",
    },
    green: {
      border: "rgba(46,213,115,0.34)",
      background: "rgba(46,213,115,0.10)",
      color: "#7bed9f",
    },
    red: {
      border: "rgba(255,71,87,0.34)",
      background: "rgba(255,71,87,0.10)",
      color: "#ff8a95",
    },
    neutral: {
      border: "var(--color-border)",
      background: "rgba(255,255,255,0.045)",
      color: "var(--color-text-secondary)",
    },
  }[tone];

  if (!isActive) {
    return {
      border: "var(--color-border)",
      background: "rgba(255,255,255,0.028)",
      color: "var(--color-text-secondary)",
      shadow: "none",
    };
  }

  return {
    ...styles,
    shadow: `0 0 0 1px ${styles.border}, 0 16px 40px rgba(0,0,0,0.16)`,
  };
}

function matchesFilter(doc: DocumentListItem, filter: FilterId) {
  if (filter === "ALL") return true;

  if (filter === "READY") {
    return doc.status === "UPLOADED";
  }

  if (filter === "PROCESSING") {
    return doc.status === "PROCESSING";
  }

  if (filter === "FAILED") {
    return doc.status === "FAILED";
  }

  if (filter === "NEEDS_REVIEW") {
    return doc.status === "PROCESSED" && doc.reviewStatus === "NEEDS_REVIEW";
  }

  if (filter === "APPROVED") {
    return doc.status === "PROCESSED" && doc.reviewStatus === "APPROVED";
  }

  if (filter === "REJECTED") {
    return doc.reviewStatus === "REJECTED";
  }

  return true;
}

function getCount(documents: DocumentListItem[], filter: FilterId) {
  return documents.filter((doc) => matchesFilter(doc, filter)).length;
}

function EmptyState({
  activeFilter,
  hasDocuments,
}: {
  activeFilter: FilterConfig;
  hasDocuments: boolean;
}) {
  return (
    <div
      style={{
        border: "1px dashed var(--color-border)",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 20,
        padding: 22,
        display: "grid",
        gap: 8,
      }}
    >
      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 15,
        }}
      >
        {hasDocuments
          ? `No ${activeFilter.label.toLowerCase()} documents`
          : "No documents yet"}
      </strong>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.55,
          maxWidth: 680,
        }}
      >
        {hasDocuments
          ? "Try another filter or upload a new financial document."
          : "Upload a bank statement, invoice, payroll sheet, utility bill, or financial statement to get started."}
      </p>
    </div>
  );
}

export function DocumentList({ documents }: { documents: DocumentListItem[] }) {
  const [activeFilterId, setActiveFilterId] = useState<FilterId>("ALL");

  const activeFilter =
    FILTERS.find((filter) => filter.id === activeFilterId) ?? FILTERS[0];

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => matchesFilter(doc, activeFilterId));
  }, [documents, activeFilterId]);

  const hasDocuments = documents.length > 0;

  return (
    <div
      style={{
        display: "grid",
        gap: 18,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 5,
            }}
          >
            <p
              style={{
                margin: 0,
                color: "var(--color-text-primary)",
                fontSize: 14,
                fontWeight: 900,
              }}
            >
              Filter review queue
            </p>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              Quickly find files waiting for AI processing, review, approval, or
              retry.
            </p>
          </div>

          <span
            style={{
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--color-text-secondary)",
              borderRadius: 999,
              padding: "7px 10px",
              fontSize: 12,
              fontWeight: 850,
            }}
          >
            Showing {filteredDocuments.length} of {documents.length}
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Document filters"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
          }}
        >
          {FILTERS.map((filter) => {
            const count = getCount(documents, filter.id);
            const isActive = activeFilterId === filter.id;
            const toneStyle = getToneStyle(filter.tone, isActive);

            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveFilterId(filter.id)}
                style={{
                  border: `1px solid ${toneStyle.border}`,
                  background: toneStyle.background,
                  color: toneStyle.color,
                  borderRadius: 16,
                  padding: 13,
                  display: "grid",
                  gap: 7,
                  textAlign: "left",
                  cursor: "pointer",
                  boxShadow: toneStyle.shadow,
                  transition: "0.18s ease",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <strong
                    style={{
                      color: isActive
                        ? toneStyle.color
                        : "var(--color-text-primary)",
                      fontSize: 13,
                      fontWeight: 950,
                    }}
                  >
                    {filter.label}
                  </strong>

                  <span
                    style={{
                      minWidth: 26,
                      height: 26,
                      borderRadius: 999,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: `1px solid ${toneStyle.border}`,
                      background: isActive
                        ? "rgba(0,0,0,0.20)"
                        : "rgba(255,255,255,0.04)",
                      color: isActive
                        ? toneStyle.color
                        : "var(--color-text-secondary)",
                      fontSize: 12,
                      fontWeight: 950,
                    }}
                  >
                    {count}
                  </span>
                </span>

                <span
                  style={{
                    color: "var(--color-text-secondary)",
                    fontSize: 11,
                    lineHeight: 1.35,
                  }}
                >
                  {filter.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filteredDocuments.length === 0 ? (
        <EmptyState activeFilter={activeFilter} hasDocuments={hasDocuments} />
      ) : (
        <ul
          className="documents-list"
          style={{
            display: "grid",
            gap: 14,
          }}
        >
          {filteredDocuments.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </ul>
      )}
    </div>
  );
}