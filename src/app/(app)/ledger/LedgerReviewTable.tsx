"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { LedgerEntryActions } from "./LedgerEntryActions";
import { ManualEntryDeleteButton } from "./ManualEntryDeleteButton";
import styles from "./ledger.module.css";

type LedgerDirection =
  | "CREDIT"
  | "DEBIT"
  | "NEUTRAL";

type LedgerStatus =
  | "NEEDS_REVIEW"
  | "APPROVED"
  | "REJECTED";

type LedgerSource =
  | "BANK_TRANSACTION"
  | "DOCUMENT_LINE"
  | "STATEMENT_LINE"
  | "DOCUMENT_TOTAL"
  | "MANUAL";

export type ReviewTableEntry = {
  id: string;
  transactionDate: string | null;
  description: string;
  counterparty: string | null;
  category: string | null;
  direction: LedgerDirection;
  amount: string;
  currency: string;
  confidence: number | null;
  status: LedgerStatus;
  sourceType: LedgerSource;
  document: {
    id: string;
    fileName: string;
  } | null;
};

type LedgerReviewTableProps = {
  entries: ReviewTableEntry[];
  approvedDocuments: number;
  filtersActive: boolean;
};

function removeTrailingZeros(value: string) {
  return value
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function formatCompactNumber(value: number) {
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1_000_000_000) {
    const decimals =
      absoluteValue >= 10_000_000_000
        ? 1
        : 2;

    return `${removeTrailingZeros(
      (
        absoluteValue /
        1_000_000_000
      ).toFixed(decimals),
    )}B`;
  }

  if (absoluteValue >= 1_000_000) {
    const decimals =
      absoluteValue >= 10_000_000
        ? 1
        : 2;

    return `${removeTrailingZeros(
      (
        absoluteValue /
        1_000_000
      ).toFixed(decimals),
    )}M`;
  }

  if (absoluteValue >= 1_000) {
    const decimals =
      absoluteValue >= 100_000
        ? 0
        : absoluteValue >= 10_000
          ? 1
          : 2;

    return `${removeTrailingZeros(
      (
        absoluteValue /
        1_000
      ).toFixed(decimals),
    )}K`;
  }

  return absoluteValue.toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 2,
    },
  );
}

function getCurrencySymbol(currency: string) {
  const symbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    AED: "د.إ ",
    CAD: "C$",
    AUD: "A$",
  };

  return (
    symbols[currency.toUpperCase()] ??
    `${currency.toUpperCase()} `
  );
}

function formatMoney(
  value: number,
  currency: string,
) {
  return `${getCurrencySymbol(
    currency,
  )}${formatCompactNumber(value)}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function humanize(value: string | null) {
  if (!value) {
    return "Uncategorised";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function directionClass(
  direction: LedgerDirection,
) {
  if (direction === "CREDIT") {
    return styles.creditBadge;
  }

  if (direction === "DEBIT") {
    return styles.debitBadge;
  }

  return styles.neutralBadge;
}

function statusClass(status: LedgerStatus) {
  if (status === "APPROVED") {
    return styles.approvedBadge;
  }

  if (status === "REJECTED") {
    return styles.rejectedBadge;
  }

  return styles.reviewBadge;
}

export function LedgerReviewTable({
  entries,
  approvedDocuments,
  filtersActive,
}: LedgerReviewTableProps) {
  const router = useRouter();

  const [selectedIds, setSelectedIds] =
    useState<Set<string>>(
      () => new Set(),
    );

  const [busyStatus, setBusyStatus] =
    useState<
      "APPROVED" | "REJECTED" | null
    >(null);

  const [message, setMessage] =
    useState<{
      type: "success" | "error";
      text: string;
    } | null>(null);

  const visibleIds = useMemo(
    () => entries.map((entry) => entry.id),
    [entries],
  );

  const allSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) =>
      selectedIds.has(id),
    );

  useEffect(() => {
    setSelectedIds((current) => {
      const visibleSet = new Set(visibleIds);

      return new Set(
        Array.from(current).filter((id) =>
          visibleSet.has(id),
        ),
      );
    });
  }, [visibleIds]);

  function toggleEntry(id: string) {
    setMessage(null);

    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleAll() {
    setMessage(null);

    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(
      new Set(visibleIds),
    );
  }

  async function bulkUpdate(
    status: "APPROVED" | "REJECTED",
  ) {
    if (
      selectedIds.size === 0 ||
      busyStatus
    ) {
      return;
    }

    setBusyStatus(status);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/ledger/bulk",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            entryIds:
              Array.from(selectedIds),
            status,
          }),
        },
      );

      const result = await response
        .json()
        .catch(() => null);

      if (
        !response.ok ||
        !result?.success
      ) {
        throw new Error(
          result?.error ??
            "Bulk review failed.",
        );
      }

      setMessage({
        type: "success",
        text: `${result.updatedCount} entr${
          result.updatedCount === 1
            ? "y"
            : "ies"
        } ${
          status === "APPROVED"
            ? "approved"
            : "rejected"
        }.`,
      });

      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Bulk review failed.",
      });
    } finally {
      setBusyStatus(null);
    }
  }

  if (entries.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyVisual}>
          <div className={styles.emptyRing}>
            <span>₹</span>
          </div>

          <div
            className={styles.emptyLineOne}
          />
          <div
            className={styles.emptyLineTwo}
          />
          <div
            className={styles.emptyLineThree}
          />
        </div>

        <div className={styles.emptyCopy}>
          <span
            className={styles.emptyEyebrow}
          >
            {filtersActive
              ? "No matching entries"
              : "Your ledger is ready to be built"}
          </span>

          <h3>
            {filtersActive
              ? "Nothing matches this review view"
              : approvedDocuments > 0
                ? `${approvedDocuments} approved document${
                    approvedDocuments === 1
                      ? " is"
                      : "s are"
                  } already trusted`
                : "Approve your first document"}
          </h3>

          <p>
            {filtersActive
              ? "Clear the current filters or open another review tab."
              : approvedDocuments > 0
                ? "Approved documents normally sync automatically. Use Refresh from documents only to rebuild older data."
                : "Process and approve a financial document to start building the ledger."}
          </p>

          <div
            className={styles.emptyActions}
          >
            {filtersActive ? (
              <Link
                href="/ledger"
                className={
                  styles.primaryLink
                }
              >
                Clear filters
              </Link>
            ) : (
              <Link
                href="/documents"
                className={
                  styles.primaryLink
                }
              >
                Open documents
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.reviewTableArea}>
      <div
        className={`${styles.bulkBar} ${
          selectedIds.size > 0
            ? styles.bulkBarVisible
            : ""
        }`}
      >
        <div className={styles.bulkSummary}>
          <strong>
            {selectedIds.size}
          </strong>

          <span>
            entr
            {selectedIds.size === 1
              ? "y"
              : "ies"}{" "}
            selected
          </span>

          <button
            type="button"
            onClick={() =>
              setSelectedIds(new Set())
            }
            disabled={busyStatus !== null}
          >
            Clear
          </button>
        </div>

        <div className={styles.bulkActions}>
          <button
            type="button"
            className={styles.bulkApprove}
            disabled={
              selectedIds.size === 0 ||
              busyStatus !== null
            }
            onClick={() =>
              bulkUpdate("APPROVED")
            }
          >
            {busyStatus === "APPROVED"
              ? "Approving..."
              : "Approve selected"}
          </button>

          <button
            type="button"
            className={styles.bulkReject}
            disabled={
              selectedIds.size === 0 ||
              busyStatus !== null
            }
            onClick={() =>
              bulkUpdate("REJECTED")
            }
          >
            {busyStatus === "REJECTED"
              ? "Rejecting..."
              : "Reject selected"}
          </button>
        </div>
      </div>

      {message ? (
        <div
          className={
            message.type === "success"
              ? styles.bulkSuccess
              : styles.bulkError
          }
        >
          {message.text}
        </div>
      ) : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th
                className={
                  styles.selectionColumn
                }
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  aria-label="Select all visible ledger entries"
                  onChange={toggleAll}
                  className={
                    styles.selectionCheckbox
                  }
                />
              </th>

              <th>Date</th>
              <th>Entry</th>
              <th>Category</th>
              <th>Direction</th>
              <th>Amount</th>
              <th>Confidence</th>
              <th>Status</th>
              <th>Source evidence</th>
            </tr>
          </thead>

          <tbody>
            {entries.map((entry) => {
              const confidence =
                entry.confidence === null
                  ? null
                  : Math.round(
                      entry.confidence * 100,
                    );

              const isSelected =
                selectedIds.has(entry.id);

              return (
                <tr
                  key={entry.id}
                  className={
                    isSelected
                      ? styles.selectedRow
                      : undefined
                  }
                >
                  <td
                    className={
                      styles.selectionCell
                    }
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      aria-label={`Select ${entry.description}`}
                      onChange={() =>
                        toggleEntry(entry.id)
                      }
                      className={
                        styles.selectionCheckbox
                      }
                    />
                  </td>

                  <td>
                    <span
                      className={
                        styles.dateText
                      }
                    >
                      {formatDate(
                        entry.transactionDate,
                      )}
                    </span>
                  </td>

                  <td>
                    <div
                      className={
                        styles.entryCell
                      }
                    >
                      <strong>
                        {entry.description}
                      </strong>

                      <span>
                        {entry.counterparty ??
                          "No counterparty detected"}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span
                      className={
                        styles.categoryPill
                      }
                    >
                      {humanize(
                        entry.category,
                      )}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`${styles.badge} ${directionClass(
                        entry.direction,
                      )}`}
                    >
                      <span
                        className={
                          styles.badgeDot
                        }
                      />

                      {humanize(
                        entry.direction,
                      )}
                    </span>
                  </td>

                  <td>
                    <strong
                      className={
                        entry.direction ===
                        "CREDIT"
                          ? styles.creditAmount
                          : entry.direction ===
                              "DEBIT"
                            ? styles.debitAmount
                            : styles.neutralAmount
                      }
                    >
                      {entry.direction ===
                      "CREDIT"
                        ? "+"
                        : entry.direction ===
                            "DEBIT"
                          ? "−"
                          : ""}

                      {formatMoney(
                        Number(entry.amount),
                        entry.currency,
                      )}
                    </strong>
                  </td>

                  <td>
                    {confidence === null ? (
                      <span
                        className={
                          styles.mutedText
                        }
                      >
                        Not available
                      </span>
                    ) : (
                      <div
                        className={
                          styles.confidenceCell
                        }
                      >
                        <div
                          className={
                            styles.confidenceTrack
                          }
                        >
                          <span
                            style={{
                              width: `${confidence}%`,
                            }}
                          />
                        </div>

                        <strong>
                          {confidence}%
                        </strong>
                      </div>
                    )}
                  </td>

                  <td>
                    <span
                      className={`${styles.badge} ${statusClass(
                        entry.status,
                      )}`}
                    >
                      {humanize(entry.status)}
                    </span>
                  </td>

                  <td>
                    <div
                      className={
                        styles.sourceCell
                      }
                    >
                      <span>
                        {humanize(
                          entry.sourceType,
                        )}
                      </span>

                      {entry.document ? (
                        <Link
                          href={`/documents/${entry.document.id}`}
                          title={
                            entry.document
                              .fileName
                          }
                        >
                          {
                            entry.document
                              .fileName
                          }
                          <small>↗</small>
                        </Link>
                      ) : (
                        <span
                          className={
                            styles.manualSourceLabel
                          }
                        >
                          Entered manually
                        </span>
                      )}

                      <LedgerEntryActions
                        entry={{
                          id: entry.id,
                          transactionDate:
                            entry.transactionDate,
                          description:
                            entry.description,
                          counterparty:
                            entry.counterparty,
                          category:
                            entry.category,
                          direction:
                            entry.direction,
                          amount: entry.amount,
                          currency:
                            entry.currency,
                          status: entry.status,
                        }}
                      />

                      {entry.sourceType ===
                      "MANUAL" ? (
                        <ManualEntryDeleteButton
                          entryId={entry.id}
                          description={
                            entry.description
                          }
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}