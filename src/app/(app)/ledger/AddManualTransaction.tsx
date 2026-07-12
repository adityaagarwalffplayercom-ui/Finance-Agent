"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import styles from "./ledger.module.css";

type AddManualTransactionProps = {
  defaultCurrency?: string;
};

type Direction =
  | "CREDIT"
  | "DEBIT"
  | "NEUTRAL";

function getToday() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function createInitialForm(
  currency: string,
) {
  return {
    transactionDate: getToday(),
    description: "",
    counterparty: "",
    category: "",
    amount: "",
    currency:
      currency.toUpperCase(),
    direction:
      "DEBIT" as Direction,
  };
}

export function AddManualTransaction({
  defaultCurrency = "INR",
}: AddManualTransactionProps) {
  const router = useRouter();

  const [open, setOpen] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [form, setForm] =
    useState(() =>
      createInitialForm(
        defaultCurrency,
      ),
    );

  function closeModal() {
    if (saving) {
      return;
    }

    setOpen(false);
    setError("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        "/api/ledger",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify({
            transactionDate:
              form.transactionDate ||
              null,
            description:
              form.description,
            counterparty:
              form.counterparty ||
              null,
            category:
              form.category || null,
            amount: form.amount,
            currency:
              form.currency,
            direction:
              form.direction,
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
            "Manual transaction could not be created.",
        );
      }

      setForm(
        createInitialForm(
          defaultCurrency,
        ),
      );

      setOpen(false);
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Manual transaction could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={
          styles.addManualButton
        }
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <span
          className={
            styles.addManualIcon
          }
        >
          +
        </span>

        <span
          className={
            styles.addManualText
          }
        >
          <strong>
            Add transaction
          </strong>

          <small>
            Cash or offline entry
          </small>
        </span>
      </button>

      {open ? (
        <div
          className={
            styles.modalOverlay
          }
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
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
                  Manual ledger entry
                </span>

                <h3>
                  Add transaction
                </h3>

                <p>
                  Record cash expenses,
                  offline payments,
                  owner investment, or
                  income not available in
                  uploaded documents.
                </p>
              </div>

              <button
                type="button"
                className={
                  styles.modalClose
                }
                onClick={closeModal}
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
                  placeholder="Example: Office rent paid in cash"
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
                <span>Direction</span>

                <select
                  value={
                    form.direction
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        direction:
                          event.target.value as Direction,
                      }),
                    )
                  }
                >
                  <option value="DEBIT">
                    Debit — money out
                  </option>

                  <option value="CREDIT">
                    Credit — money in
                  </option>

                  <option value="NEUTRAL">
                    Neutral — reference
                  </option>
                </select>
              </label>

              <label>
                <span>Amount</span>

                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
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
                <span>Currency</span>

                <input
                  required
                  maxLength={3}
                  placeholder="INR"
                  value={form.currency}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        currency:
                          event.target.value
                            .toUpperCase()
                            .replace(
                              /[^A-Z]/g,
                              "",
                            )
                            .slice(0, 3),
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>Counterparty</span>

                <input
                  placeholder="Vendor, customer or employee"
                  value={
                    form.counterparty
                  }
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
                  placeholder="Rent, Salary, Sales..."
                  value={form.category}
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
            </div>

            {error ? (
              <div
                className={
                  styles.modalError
                }
              >
                {error}
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
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className={
                  styles.modalSave
                }
                disabled={saving}
              >
                {saving
                  ? "Adding..."
                  : "Add transaction"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}