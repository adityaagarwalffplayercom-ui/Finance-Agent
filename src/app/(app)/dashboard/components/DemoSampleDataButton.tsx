"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ActionState = {
  type: "idle" | "success" | "error";
  message: string;
};

function SampleWorkspaceButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: string;
  onClick: () => void;
  disabled: boolean;
  tone: "gold" | "danger";
}) {
  const isDanger = tone === "danger";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-ghost"
      style={{
        border: isDanger
          ? "1px solid rgba(255,138,149,0.28)"
          : "1px solid rgba(255,209,102,0.30)",
        background: isDanger
          ? "rgba(255,138,149,0.085)"
          : "rgba(245,158,11,0.10)",
        color: isDanger ? "var(--color-danger)" : "var(--color-gold)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function DemoSampleDataButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>({
    type: "idle",
    message: "",
  });

  function loadSampleWorkspace() {
    setState({
      type: "idle",
      message: "",
    });

    startTransition(async () => {
      try {
        const response = await fetch("/api/demo/sample-data", {
          method: "POST",
        });

        const data = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;

        if (!response.ok) {
          throw new Error(data?.error ?? "Sample workspace could not be loaded.");
        }

        setState({
          type: "success",
          message:
            data?.message ??
            "Sample workspace loaded. You can now explore dashboard, charts, AI chat, and reports.",
        });

        router.refresh();
      } catch (error) {
        setState({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Sample workspace could not be loaded.",
        });
      }
    });
  }

  function clearSampleWorkspace() {
    setState({
      type: "idle",
      message: "",
    });

    startTransition(async () => {
      try {
        const response = await fetch("/api/demo/sample-data", {
          method: "DELETE",
        });

        const data = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;

        if (!response.ok) {
          throw new Error(data?.error ?? "Sample workspace could not be cleared.");
        }

        setState({
          type: "success",
          message:
            data?.message ??
            "Sample workspace cleared. Your real uploaded documents remain unchanged.",
        });

        router.refresh();
      } catch (error) {
        setState({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Sample workspace could not be cleared.",
        });
      }
    });
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <SampleWorkspaceButton
          onClick={loadSampleWorkspace}
          disabled={isPending}
          tone="gold"
        >
          {isPending ? "Working..." : "Load sample workspace"}
        </SampleWorkspaceButton>

        <SampleWorkspaceButton
          onClick={clearSampleWorkspace}
          disabled={isPending}
          tone="danger"
        >
          Clear sample workspace
        </SampleWorkspaceButton>
      </div>

      {state.type !== "idle" ? (
        <div
          style={{
            border:
              state.type === "success"
                ? "1px solid rgba(46,213,115,0.28)"
                : "1px solid rgba(255,138,149,0.30)",
            background:
              state.type === "success"
                ? "rgba(46,213,115,0.085)"
                : "rgba(255,138,149,0.085)",
            color:
              state.type === "success"
                ? "var(--color-sage)"
                : "var(--color-danger)",
            borderRadius: 16,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.5,
            fontWeight: 750,
            overflowWrap: "anywhere",
          }}
        >
          {state.message}
        </div>
      ) : null}
    </div>
  );
}

export default DemoSampleDataButton;