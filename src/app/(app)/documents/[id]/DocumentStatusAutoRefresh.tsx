"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function DocumentStatusAutoRefresh({ status }: { status: string }) {
  const router = useRouter();
  const pending = status === "UPLOADING" || status === "QUEUED" || status === "PROCESSING";

  useEffect(() => {
    if (!pending) return;
    const interval = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(interval);
  }, [pending, router]);

  return null;
}
