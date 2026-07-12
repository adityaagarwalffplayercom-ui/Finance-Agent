"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ledger.module.css";

type ManualEntryDeleteButtonProps = {
  entryId: string;
  description: string;
};

export function ManualEntryDeleteButton({
  entryId,
  description,
}: ManualEntryDeleteButtonProps) {
  const router = useRouter();

  const [deleting, setDeleting] =
    useState(false);

  const [error, setError] =
    useState("");

  async function deleteEntry() {
    if (deleting) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${description}" from the ledger?`,
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/ledger/${entryId}`,
        {
          method: "DELETE",
          headers: {
            Accept:
              "application/json",
          },
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
            "Manual transaction could not be deleted.",
        );
      }

      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Manual transaction could not be deleted.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={
        styles.manualDeleteArea
      }
    >
      <button
        type="button"
        className={
          styles.manualDeleteButton
        }
        disabled={deleting}
        onClick={deleteEntry}
      >
        {deleting
          ? "Deleting..."
          : "Delete manual entry"}
      </button>

      {error ? (
        <span
          className={
            styles.rowActionError
          }
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}