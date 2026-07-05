"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function readApiError(response: Response) {
  try {
    const data = await response.json();

    if (typeof data?.error === "string") {
      return data.error;
    }

    return "Request failed.";
  } catch {
    return "Request failed.";
  }
}

export function DemoSampleDataButton() {
  const router = useRouter();

  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateSampleData() {
    if (isCreating || isDeleting) return;

    setIsCreating(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/demo/sample-data", {
        method: "POST",
      });

      if (!response.ok) {
        const apiError = await readApiError(response);
        setError(apiError);
        return;
      }

      const data = await response.json();

      setMessage(
        typeof data?.message === "string"
          ? data.message
          : "Demo data created. Dashboard is ready.",
      );

      router.refresh();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create demo sample data.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteSampleData() {
    if (isCreating || isDeleting) return;

    const confirmed = window.confirm(
      "Delete demo sample data? This will remove only [Sample] documents. Your real uploaded documents will stay safe.",
    );

    if (!confirmed) return;

    setIsDeleting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/demo/sample-data", {
        method: "DELETE",
      });

      if (!response.ok) {
        const apiError = await readApiError(response);
        setError(apiError);
        return;
      }

      const data = await response.json();

      const deletedDocuments =
        typeof data?.deletedDocuments === "number"
          ? data.deletedDocuments
          : 0;

      setMessage(`Deleted ${deletedDocuments} demo sample document(s).`);

      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete demo sample data.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const isBusy = isCreating || isDeleting;

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={handleCreateSampleData}
          disabled={isBusy}
          className="btn-ghost"
          style={{
            border: "1px solid rgba(245,158,11,0.38)",
            background: "rgba(245,158,11,0.10)",
            color: "var(--color-amber)",
            cursor: isBusy ? "not-allowed" : "pointer",
            opacity: isBusy ? 0.7 : 1,
          }}
        >
          {isCreating ? "Creating demo data..." : "Create demo data"}
        </button>

        <button
          type="button"
          onClick={handleDeleteSampleData}
          disabled={isBusy}
          className="btn-ghost"
          style={{
            border: "1px solid rgba(255,71,87,0.30)",
            background: "rgba(255,71,87,0.08)",
            color: "#ff8a95",
            cursor: isBusy ? "not-allowed" : "pointer",
            opacity: isBusy ? 0.7 : 1,
          }}
        >
          {isDeleting ? "Deleting demo data..." : "Delete demo data"}
        </button>
      </div>

      {message && (
        <span
          style={{
            color: "#7bed9f",
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1.4,
          }}
        >
          {message}
        </span>
      )}

      {error && (
        <span
          style={{
            color: "#ff8a95",
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1.4,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}