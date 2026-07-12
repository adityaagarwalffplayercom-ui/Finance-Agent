"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import styles from "./ledger.module.css";

type EditableLedgerEntry = {
  id: string;
  transactionDate: string | null;
  description: string;
  counterparty: string | null;
  category: string | null;
  direction:
    | "CREDIT"
    | "DEBIT"
    | "NEUTRAL";
  amount: string;
  currency: string;
  status:
    | "NEEDS_REVIEW"
    | "APPROVED"
    | "REJECTED";
};

type LedgerEntryActionsProps = {
  entry: EditableLedgerEntry;
};

type UpdatePayload = Partial<{
  transactionDate: string | null;
  description: string;
  counterparty: string | null;
  category: string | null;
  direction:
    | "CREDIT"
    | "DEBIT"
    | "NEUTRAL";
  amount: string;
  status:
    | "NEEDS_REVIEW"
    | "APPROVED"
    | "REJECTED";
}>;

function dateInputValue(
  value: string | null,
) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed
    .toISOString()
    .slice(0, 10);
}

export function LedgerEntryActions({
  entry,
}: LedgerEntryActionsProps) {
  const router = useRouter();

  const [editing, setEditing] =
    useState(false);

  const [busyAction, setBusyAction] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState("");

  const [form, setForm] = useState({
    transactionDate:
      dateInputValue(
        entry.transactionDate,
      ),
    description: entry.description,
    counterparty:
      entry.counterparty ?? "",
    category: entry.category ?? "",
    direction: entry.direction,
    amount: entry.amount,
    status: entry.status,
  });

  useEffect(() => {
    if (!editing) {
      setForm({
        transactionDate:
          dateInputValue(
            entry.transactionDate,
          ),
        description:
          entry.description,
        counterparty:
          entry.counterparty ?? "",
        category:
          entry.category ?? "",
        direction:
          entry.direction,
        amount:
          entry.amount,
        status:
          entry.status,
      });
    }
  }, [editing, entry]);

  async function updateEntry(
    payload: UpdatePayload,
    actionName: string,
  ) {
    setBusyAction(actionName);
    setMessage("");

    try {
      const response = await fetch(
        `/api/ledger/${entry.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify(payload),
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
            "Ledger entry update failed.",
        );
      }

      if (actionName === "save") {
        setEditing(false);
      }

      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Ledger entry update failed.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    updateEntry(
      {
        transactionDate:
          form.transactionDate || null,
        description:
          form.description,
        counterparty:
          form.counterparty || null,
        category:
          form.category || null,
        direction:
          form.direction,
        amount:
          form.amount,
        status:
          form.status,
      },
      "save",
    );
  }

  return (
    <>
      <div className={styles.rowActions}>
        <button
          type="button"
          className={`${styles.rowActionButton} ${styles.editAction}`}
          onClick={() => {
            setMessage("");
            setEditing(true);
          }}
          disabled={
            busyAction !== null
          }
        >
          Edit
        </button>

        {entry.status !== "APPROVED" ? (
          <button
            type="button"
            className={`${styles.rowActionButton} ${styles.approveAction}`}
            disabled={
              busyAction !== null
            }
            onClick={() =>
              updateEntry(
                {
                  status: "APPROVED",
                },
                "approve",
              )
            }
          >
            {busyAction === "approve"
              ? "..."
              : "Approve"}
          </button>
        ) : null}

        {entry.status !== "REJECTED" ? (
          <button
            type="button"
            className={`${styles.rowActionButton} ${styles.rejectAction}`}
            disabled={
              busyAction !== null
            }
            onClick={() =>
              updateEntry(
                {
                  status: "REJECTED",
                },
                "reject",
              )
            }
          >
            {busyAction === "reject"
              ? "..."
              : "Reject"}
          </button>
        ) : null}
      </div>

      {message && !editing ? (
        <span
          className={
            styles.rowActionError
          }
        >
          {message}
        </span>
      ) : null}

      {editing ? (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setEditing(false);
            }
          }}
        >
          <form
            className={styles.modalCard}
            onSubmit={handleSubmit}
          >
            <div
              className={
                styles.modalHeader
              }
            >
              <div>
                <span
                  className={
                    styles.modalEyebrow
                  }
                >
                  Ledger review
                </span>

                <h3>
                  Edit financial entry
                </h3>

                <p>
                  Correct the extracted
                  information before using
                  it in financial analysis.
                </p>
              </div>

              <button
                type="button"
                className={
                  styles.modalClose
                }
                onClick={() =>
                  setEditing(false)
                }
              >
                ×
              </button>
            </div>

            <div
              className={
                styles.modalFormGrid
              }
            >
              <label
                className={
                  styles.modalFullField
                }
              >
                <span>Description</span>

                <input
                  required
                  maxLength={500}
                  value={
                    form.description
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>Date</span>

                <input
                  type="date"
                  value={
                    form.transactionDate
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        transactionDate:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Amount ({entry.currency})
                </span>

                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        amount:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>Counterparty</span>

                <input
                  value={
                    form.counterparty
                  }
                  placeholder="Vendor or customer"
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        counterparty:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>Category</span>

                <input
                  value={form.category}
                  placeholder="Expense, Revenue, Tax..."
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        category:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>Direction</span>

                <select
                  value={form.direction}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        direction:
                          event.target.value as
                            | "CREDIT"
                            | "DEBIT"
                            | "NEUTRAL",
                      }),
                    )
                  }
                >
                  <option value="CREDIT">
                    Credit — money in
                  </option>

                  <option value="DEBIT">
                    Debit — money out
                  </option>

                  <option value="NEUTRAL">
                    Neutral — reference
                  </option>
                </select>
              </label>

              <label>
                <span>Review status</span>

                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        status:
                          event.target.value as
                            | "NEEDS_REVIEW"
                            | "APPROVED"
                            | "REJECTED",
                      }),
                    )
                  }
                >
                  <option value="NEEDS_REVIEW">
                    Needs review
                  </option>

                  <option value="APPROVED">
                    Approved
                  </option>

                  <option value="REJECTED">
                    Rejected
                  </option>
                </select>
              </label>
            </div>

            {message ? (
              <div
                className={
                  styles.modalError
                }
              >
                {message}
              </div>
            ) : null}

            <div
              className={
                styles.modalFooter
              }
            >
              <button
                type="button"
                className={
                  styles.modalCancel
                }
                onClick={() =>
                  setEditing(false)
                }
                disabled={
                  busyAction !== null
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className={
                  styles.modalSave
                }
                disabled={
                  busyAction !== null
                }
              >
                {busyAction === "save"
                  ? "Saving..."
                  : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}