"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function readApiError(response: Response) {
  try {
    const data = await response.json();

    if (typeof data?.error === "string") {
      return data.error;
    }

    return "Could not create demo sample data.";
  } catch {
    return "Could not create demo sample data.";
  }
}

export function DemoSampleDataButton() {
  const router = useRouter();

  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateSampleData() {
    if (isCreating) return;

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

      setMessage("Demo data created. Dashboard is ready.");
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

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={handleCreateSampleData}
        disabled={isCreating}
        className="btn-ghost"
        style={{
          border: "1px solid rgba(245,158,11,0.38)",
          background: "rgba(245,158,11,0.10)",
          color: "var(--color-amber)",
          cursor: isCreating ? "not-allowed" : "pointer",
          opacity: isCreating ? 0.7 : 1,
        }}
      >
        {isCreating ? "Creating demo data..." : "Create demo sample data"}
      </button>

      {message && (
        <span
          style={{
            color: "#7bed9f",
            fontSize: 12,
            fontWeight: 800,
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