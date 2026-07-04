import type { FinancialMetric } from "@/lib/financial-profile";

export function MetricsPanel({ metrics }: { metrics: FinancialMetric[] }) {
  return (
    <section className="alerts-card" style={{ marginTop: 24 }}>
      <div style={{ marginBottom: 18 }}>
        <p className="section-title">Financial metrics</p>
        <p className="section-hint">
          Key CFO ratios calculated from processed business documents
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        {metrics.map((metric) => (
          <div
            key={metric.id}
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 16,
              padding: 16,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <p
              style={{
                margin: "0 0 8px",
                color: "var(--color-text-secondary)",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {metric.label}
            </p>

            <p
              style={{
                margin: "0 0 8px",
                color: "var(--color-text-primary)",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {metric.value}
            </p>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.4,
              }}
            >
              {metric.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}