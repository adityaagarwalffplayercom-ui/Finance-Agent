import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getAnomalyInsightsReport,
  type AnomalyAction,
  type AnomalyInsight,
  type ExtractedInsightLineItem,
} from "@/lib/anomaly-insights-engine";

type Tone = "good" | "warning" | "danger" | "neutral";

function toneStyle(tone: Tone) {
  return {
    good: {
      color: "var(--color-sage)",
      border: "rgba(46,213,115,0.28)",
      background: "rgba(46,213,115,0.085)",
    },
    warning: {
      color: "var(--color-gold)",
      border: "rgba(255,209,102,0.30)",
      background: "rgba(255,209,102,0.085)",
    },
    danger: {
      color: "var(--color-danger)",
      border: "rgba(255,138,149,0.30)",
      background: "rgba(255,138,149,0.085)",
    },
    neutral: {
      color: "var(--color-text-secondary)",
      border: "var(--color-border)",
      background: "rgba(255,255,255,0.045)",
    },
  }[tone];
}

function compactNumber(value: number) {
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (absolute >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (absolute >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }

  return `${Math.round(value)}`;
}

function currencySymbol(currency: string) {
  const clean = currency.trim().toUpperCase();
  const rupee = "Rs. ";

  if (clean === "INR" || currency.trim() === rupee) return rupee;
  if (clean === "USD" || currency.trim() === "$") return "$";
  if (clean === "GBP" || currency.trim() === "£") return "£";
  if (clean === "EUR" || currency.trim() === "€") return "€";

  return currency || "";
}

function formatMoney(value: number | null, currency: string) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  const symbol = currencySymbol(currency);
  const sign = value < 0 ? "-" : "";

  return `${sign}${symbol}${compactNumber(Math.abs(value))}`;
}

function metricTone(value: number, goodAt: number, warningAt: number): Tone {
  if (value >= goodAt) return "good";
  if (value >= warningAt) return "warning";
  return "danger";
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: Tone;
}) {
  const style = toneStyle(tone);

  return (
    <article
      style={{
        border: `1px solid ${style.border}`,
        background: style.background,
        borderRadius: 20,
        padding: 16,
        display: "grid",
        gap: 10,
        minWidth: 0,
      }}
    >
      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 11,
          fontWeight: 950,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </p>

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: "clamp(25px, 3vw, 36px)",
          lineHeight: 1,
          fontWeight: 950,
          letterSpacing: "-0.06em",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </strong>

      <span
        style={{
          color: style.color,
          fontSize: 12,
          lineHeight: 1.5,
          fontWeight: 800,
        }}
      >
        {hint}
      </span>
    </article>
  );
}

function LineItemCard({
  item,
  currency,
}: {
  item: ExtractedInsightLineItem;
  currency: string;
}) {
  const tone: Tone =
    item.type === "EXPENSE"
      ? "warning"
      : item.type === "REVENUE"
        ? "good"
        : item.amount < 0
          ? "danger"
          : "neutral";

  const style = toneStyle(tone);

  return (
    <article
      style={{
        border: `1px solid ${style.border}`,
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.024))",
        borderRadius: 18,
        padding: 14,
        display: "grid",
        gap: 9,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <strong
          style={{
            color: "var(--color-text-primary)",
            fontSize: 14,
            lineHeight: 1.35,
            overflowWrap: "anywhere",
          }}
        >
          {item.label}
        </strong>

        <span
          style={{
            color: style.color,
            fontSize: 13,
            fontWeight: 950,
            whiteSpace: "normal",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
            textAlign: "right",
            maxWidth: "100%",
            minWidth: 0,
          }}
        >
          {formatMoney(item.amount, currency)}
        </span>
      </div>

      <span
        style={{
          color: "var(--color-text-secondary)",
          fontSize: 12,
          lineHeight: 1.45,
          overflowWrap: "anywhere",
        }}
      >
        {item.type} · {item.sourceFileName}
      </span>
    </article>
  );
}

function AnomalyCard({
  anomaly,
  currency,
}: {
  anomaly: AnomalyInsight;
  currency: string;
}) {
  const style = toneStyle(anomaly.tone);

  return (
    <article
      style={{
        border: `1px solid ${style.border}`,
        background: style.background,
        borderRadius: 18,
        padding: 14,
        display: "grid",
        gap: 8,
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: style.color,
          fontSize: 11,
          fontWeight: 950,
          letterSpacing: "0.08em",
        }}
      >
        {anomaly.severity} SIGNAL
      </span>

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 15,
          lineHeight: 1.3,
        }}
      >
        {anomaly.title}
      </strong>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {anomaly.detail}
      </p>

      <span
        style={{
          color: style.color,
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        {anomaly.amount !== null
          ? formatMoney(anomaly.amount, currency)
          : anomaly.source}
      </span>
    </article>
  );
}

function ActionCard({ action }: { action: AnomalyAction }) {
  const tone: Tone =
    action.priority === "HIGH"
      ? "danger"
      : action.priority === "MEDIUM"
        ? "warning"
        : "good";

  const style = toneStyle(tone);

  return (
    <article
      style={{
        border: `1px solid ${style.border}`,
        background: style.background,
        borderRadius: 18,
        padding: 14,
        display: "grid",
        gap: 8,
      }}
    >
      <span
        style={{
          color: style.color,
          fontSize: 11,
          fontWeight: 950,
          letterSpacing: "0.08em",
        }}
      >
        {action.priority} PRIORITY
      </span>

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 15,
          lineHeight: 1.3,
        }}
      >
        {action.title}
      </strong>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {action.detail}
      </p>
    </article>
  );
}

export default async function AnomalyInsightsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const report = await getAnomalyInsightsReport(session.user.id);

  const statusTone: Tone =
    report.status === "STRONG"
      ? "good"
      : report.status === "NEEDS_REVIEW"
        ? "warning"
        : "danger";

  return (
    <main>
      <header
        style={{
          marginBottom: 24,
          border: "1px solid rgba(245,158,11,0.22)",
          background:
            "radial-gradient(circle at top left, rgba(245,158,11,0.16), transparent 34%), radial-gradient(circle at bottom right, rgba(46,213,115,0.08), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.062), rgba(255,255,255,0.026))",
          borderRadius: 30,
          padding: 26,
          display: "grid",
          gap: 18,
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              Analyst Agent
            </p>

            <h1
              style={{
                margin: "12px 0 0",
                color: "var(--color-text-primary)",
                fontSize: "clamp(38px, 5.2vw, 72px)",
                lineHeight: 0.98,
                letterSpacing: "-0.078em",
                maxWidth: 920,
              }}
            >
              Line item and anomaly insights.
            </h1>

            <p
              className="page-intro"
              style={{
                margin: "16px 0 0",
                lineHeight: 1.7,
                maxWidth: 850,
              }}
            >
              {report.summary}
            </p>
          </div>

          <Link href="/chat?agent=analyst" className="btn-ghost">
            Ask Analyst Agent →
          </Link>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 14,
          }}
        >
          <MetricCard
            label="Anomaly score"
            value={`${report.score}/100`}
            hint={report.status}
            tone={statusTone}
          />

          <MetricCard
            label="Line items"
            value={report.metrics.totalLineItems}
            hint={`${report.metrics.documentsWithLineItems}/${report.metrics.approvedDocuments} documents with items`}
            tone={metricTone(report.metrics.totalLineItems, 20, 5)}
          />

          <MetricCard
            label="High-value items"
            value={report.metrics.highValueItems}
            hint="Items above normal detected size"
            tone={report.metrics.highValueItems > 0 ? "warning" : "good"}
          />

          <MetricCard
            label="Duplicate-looking"
            value={report.metrics.duplicateLookingGroups}
            hint="Similar name and amount groups"
            tone={
              report.metrics.duplicateLookingGroups > 0 ? "warning" : "good"
            }
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(280px, 0.9fr)",
            gap: 18,
            alignItems: "start",
          }}
        >
          <section
            className="section-card"
            style={{
              padding: 22,
              display: "grid",
              gap: 14,
            }}
          >
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>
                Detected anomalies
              </p>

              <h2
                style={{
                  margin: "8px 0 0",
                  color: "var(--color-text-primary)",
                  fontSize: 24,
                  lineHeight: 1.15,
                }}
              >
                What needs analyst review
              </h2>
            </div>

            {report.anomalies.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gap: 10,
                }}
              >
                {report.anomalies.map((anomaly) => (
                  <AnomalyCard
                    key={anomaly.id}
                    anomaly={anomaly}
                    currency={report.currency}
                  />
                ))}
              </div>
            ) : (
              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontSize: 13,
                  lineHeight: 1.65,
                }}
              >
                No anomaly signals found yet.
              </p>
            )}
          </section>

          <section
            className="section-card"
            style={{
              padding: 22,
              display: "grid",
              gap: 14,
            }}
          >
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>
                Analyst actions
              </p>

              <h2
                style={{
                  margin: "8px 0 0",
                  color: "var(--color-text-primary)",
                  fontSize: 24,
                  lineHeight: 1.15,
                }}
              >
                What to check first
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              {report.actions.map((action) => (
                <ActionCard
                  key={`${action.priority}-${action.title}`}
                  action={action}
                />
              ))}
            </div>
          </section>
        </div>

        <section
          className="section-card"
          style={{
            padding: 22,
            display: "grid",
            gap: 14,
          }}
        >
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              Largest items
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              Biggest extracted line items
            </h2>
          </div>

          {report.largestItems.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: 10,
              }}
            >
              {report.largestItems.map((item) => (
                <LineItemCard
                  key={item.id}
                  item={item}
                  currency={report.currency}
                />
              ))}
            </div>
          ) : (
            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.65,
              }}
            >
              No extracted line items found yet.
            </p>
          )}
        </section>

        <section
          className="section-card"
          style={{
            padding: 22,
            display: "grid",
            gap: 14,
          }}
        >
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              Document coverage
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              Line items by document
            </h2>
          </div>

          {report.documentCoverage.length > 0 ? (
            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              {report.documentCoverage.map((document) => (
                <Link
                  key={document.id}
                  href={`/documents/${document.id}`}
                  style={{
                    border: "1px solid rgba(255,255,255,0.09)",
                    background: "rgba(255,255,255,0.035)",
                    borderRadius: 16,
                    padding: 13,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 14,
                    color: "inherit",
                    textDecoration: "none",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      display: "grid",
                      gap: 5,
                    }}
                  >
                    <strong
                      style={{
                        color: "var(--color-text-primary)",
                        fontSize: 14,
                        lineHeight: 1.35,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {document.fileName}
                    </strong>

                    <span
                      style={{
                        color: "var(--color-text-secondary)",
                        fontSize: 12,
                        lineHeight: 1.45,
                      }}
                    >
                      {document.category} · Quality: {document.quality}
                    </span>
                  </span>

                  <strong
                    style={{
                      color: "var(--color-gold)",
                      fontSize: 13,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {document.lineItemCount} items
                  </strong>
                </Link>
              ))}
            </div>
          ) : (
            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.65,
              }}
            >
              No approved documents found.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
