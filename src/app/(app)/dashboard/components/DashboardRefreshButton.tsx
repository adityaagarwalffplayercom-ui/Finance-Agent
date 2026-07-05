"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DashboardRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isPending}
      className="btn-ghost"
      style={{
        whiteSpace: "nowrap",
        opacity: isPending ? 0.7 : 1,
        cursor: isPending ? "not-allowed" : "pointer",
      }}
    >
      {isPending ? "Refreshing..." : "Refresh dashboard"}
    </button>
  );
}