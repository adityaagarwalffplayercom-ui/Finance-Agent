"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ledger.module.css";

type LedgerSyncButtonProps = {
  approvedDocuments: number;
};

type SyncResult = {
  success?: boolean;
  documentsSynced?: number;
  entriesCreated?: number;
  error?: string;
};

export function LedgerSyncButton({
  approvedDocuments,
}: LedgerSyncButtonProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function handleSync() {
    if (loading) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/ledger/sync", {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });

      const data =
        (await response.json().catch(() => null)) as SyncResult | null;

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.error ??
            "Could not synchronize approved documents.",
        );
      }

      const entries = data.entriesCreated ?? 0;
      const documents = data.documentsSynced ?? 0;

      setResult({
        type: "success",
        message:
          entries > 0
            ? `${entries} entries created from ${documents} document(s).`
            : `${documents} document(s) checked, but no ledger rows were found.`,
      });

      router.refresh();
    } catch (error) {
      setResult({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Ledger synchronization failed.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.syncArea}>
      <button
        type="button"
        onClick={handleSync}
        disabled={loading || approvedDocuments === 0}
        className={styles.syncButton}
      >
        <span className={styles.syncButtonIcon}>
          {loading ? "···" : "↻"}
        </span>

        <span className={styles.syncButtonText}>
          <strong>
            {loading
              ? "Building ledger"
              : "Sync approved documents"}
          </strong>

          <small>
            {approvedDocuments === 0
              ? "Approve a processed document first"
              : `${approvedDocuments} approved document${
                  approvedDocuments === 1 ? "" : "s"
                } available`}
          </small>
        </span>
      </button>

      {result ? (
        <div
          className={
            result.type === "success"
              ? styles.syncSuccess
              : styles.syncError
          }
        >
          {result.message}
        </div>
      ) : null}
    </div>
  );
}