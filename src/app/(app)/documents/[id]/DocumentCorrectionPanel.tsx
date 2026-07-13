"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type MetricKey =
  | "revenue"
  | "expenses"
  | "netIncome"
  | "cash"
  | "assets"
  | "liabilities"
  | "equity";

type Props = {
  documentId: string;
  currency: string;
  initialValues: Record<MetricKey, number | null>;
};

type Correction = {
  id: string;
  fieldPath: string;
  originalValue: unknown;
  correctedValue: unknown;
  reason: string | null;
  createdAt: string;
};

const METRICS: Array<{ key: MetricKey; label: string }> = [
  { key: "revenue", label: "Revenue" },
  { key: "expenses", label: "Expenses" },
  { key: "netIncome", label: "Net income / loss" },
  { key: "cash", label: "Cash" },
  { key: "assets", label: "Assets" },
  { key: "liabilities", label: "Liabilities" },
  { key: "equity", label: "Equity" },
];

function formatValue(value: unknown, currency: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not available";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function DocumentCorrectionPanel({
  documentId,
  currency,
  initialValues,
}: Props) {
  const router = useRouter();
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("revenue");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currentValue = initialValues[selectedMetric];
  const currentLabel = useMemo(
    () => METRICS.find((metric) => metric.key === selectedMetric)?.label ?? selectedMetric,
    [selectedMetric],
  );

  useEffect(() => {
    let cancelled = false;

    void fetch(`/api/documents/${documentId}/corrections`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled && Array.isArray(payload?.corrections)) {
          setCorrections(payload.corrections);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    setValue(typeof currentValue === "number" ? String(currentValue) : "");
  }, [currentValue, selectedMetric]);

  async function saveCorrection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const parsed = Number(value.replace(/,/g, "").trim());
    if (!Number.isFinite(parsed)) {
      setMessage("Enter a valid numeric amount in full currency units.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/documents/${documentId}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldPath: selectedMetric,
          correctedValue: parsed,
          reason: reason.trim(),
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(payload?.error ?? "Correction could not be saved.");
        return;
      }

      setCorrections((existing) => [payload.correction, ...existing]);
      setReason("");
      setMessage("Correction saved. This document requires approval again before dashboard posting.");
      router.refresh();
    } catch {
      setMessage("Network error while saving the correction.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      className="section-card"
      style={{ marginBottom: 24, display: "grid", gap: 18 }}
    >
      <div className="section-heading" style={{ alignItems: "flex-start" }}>
        <div>
          <p className="section-title">Manual corrections</p>
          <p className="section-hint">
            Correct a headline metric without deleting the AI evidence. Every change is audited and resets approval.
          </p>
        </div>
        <span className="badge-sample">{corrections.length} active correction{corrections.length === 1 ? "" : "s"}</span>
      </div>

      <form onSubmit={saveCorrection} style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 7, color: "var(--color-text-secondary)", fontSize: 13 }}>
            Metric
            <select
              value={selectedMetric}
              onChange={(event) => setSelectedMetric(event.target.value as MetricKey)}
              style={{ padding: 11, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)" }}
            >
              {METRICS.map((metric) => (
                <option key={metric.key} value={metric.key}>{metric.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 7, color: "var(--color-text-secondary)", fontSize: 13 }}>
            Corrected amount ({currency}, full units)
            <input
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Example: 231546000000"
              style={{ padding: 11, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)" }}
            />
          </label>
        </div>

        <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: 12 }}>
          Current {currentLabel}: <strong style={{ color: "var(--color-text-primary)" }}>{formatValue(currentValue, currency)}</strong>
        </p>

        <label style={{ display: "grid", gap: 7, color: "var(--color-text-secondary)", fontSize: 13 }}>
          Reason for correction
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Example: Verified against audited statement page 11."
            style={{ padding: 11, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", resize: "vertical" }}
          />
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save audited correction"}
          </button>
          {message && <span style={{ color: message.startsWith("Correction saved") ? "#7bed9f" : "#ffd166", fontSize: 13 }}>{message}</span>}
        </div>
      </form>

      {corrections.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", color: "var(--color-text-primary)", fontWeight: 850 }}>
            Active correction history
          </summary>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {corrections.map((correction) => (
              <div key={correction.id} style={{ border: "1px solid var(--color-border)", borderRadius: 14, padding: 12, display: "grid", gap: 5 }}>
                <strong style={{ color: "var(--color-text-primary)", fontSize: 13 }}>{correction.fieldPath}</strong>
                <span style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>
                  {String(correction.originalValue ?? "Not available")} → {String(correction.correctedValue)}
                </span>
                {correction.reason && <span style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>{correction.reason}</span>}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
