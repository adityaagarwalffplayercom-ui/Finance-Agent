import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getCashFlowReport,
  type CashFlowAction,
  type CashFlowLineItem,
  type CashFlowMetric,
  type CashFlowSignal,
} from "@/lib/cash-flow-engine";

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

  if (clean === "INR") return "Rs. ";
  if (clean === "USD" || currency.trim() === "$") return "$";
  if (clean === "GBP") return "GBP ";
  if (clean === "EUR") return "EUR ";

  return currency ? `${currency} ` : "";
}

function formatMoney(value: number | null, currency: string) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  const sign = value < 0 ? "-" : "";

  return `${sign}${currencySymbol(currency)}${compactNumber(Math.abs(value))}`;
}

function MetricCard({ metric }: { metric: CashFlowMetric }) {
  const style = toneStyle(metric.tone);

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
        {metric.label}
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
        {metric.value}
      </strong>

      <span
        style={{
          color: style.color,
          fontSize: 12,
          lineHeight: 1.5,
          fontWeight: 800,
        }}
      >
        {metric.hint}
      </span>
    </article>
  );
}

function SignalCard({
  signal,
  currency,
}: {
  signal: CashFlowSignal;
  currency: string;
}) {
  const style = toneStyle(signal.tone);

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
        {signal.severity} SIGNAL
      </span>

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 15,
          lineHeight: 1.3,
        }}
      >
        {signal.title}
      </strong>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {signal.detail}
      </p>

      <span
        style={{
          color: style.color,
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        {signal.amount === null ? "No amount" : formatMoney(signal.amount, currency)}
      </span>
    </article>
  );
}

function ActionCard({ action }: { action: CashFlowAction }) {
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

function CashItemCard({
  item,
  currency,
}: {
  item: CashFlowLineItem;
  currency: string;
}) {
  const tone: Tone =
    item.type === "INFLOW"
      ? "good"
      : item.type === "OUTFLOW"
        ? "warning"
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
        gap: 8,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
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
            overflowWrap: "anywhere",
            textAlign: "right",
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
        {item.type} - {item.sourceFileName}
      </span>
    </article>
  );
}

export default async function CashFlowPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const report = await getCashFlowReport(session.user.id);

  const statusTone: Tone =
    report.status === "HEALTHY"
      ? "good"
      : report.status === "WATCH"
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
              Cash Flow Agent
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
              Runway and burn intelligence.
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

          <Link href="/chat?agent=cashflow" className="btn-ghost">
            Ask Cash Flow Agent →
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
          <article
            style={{
              border: `1px solid ${toneStyle(statusTone).border}`,
              background: toneStyle(statusTone).background,
              borderRadius: 20,
              padding: 16,
              display: "grid",
              gap: 10,
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
              Cash flow score
            </p>

            <strong
              style={{
                color: "var(--color-text-primary)",
                fontSize: "clamp(25px, 3vw, 36px)",
                lineHeight: 1,
                fontWeight: 950,
                letterSpacing: "-0.06em",
              }}
            >
              {report.score}/100
            </strong>

            <span
              style={{
                color: toneStyle(statusTone).color,
                fontSize: 12,
                lineHeight: 1.5,
                fontWeight: 800,
              }}
            >
              {report.status}
            </span>
          </article>

          {report.cards.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
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
                Cash signals
              </p>

              <h2
                style={{
                  margin: "8px 0 0",
                  color: "var(--color-text-primary)",
                  fontSize: 24,
                  lineHeight: 1.15,
                }}
              >
                What needs attention
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              {report.signals.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  currency={report.currency}
                />
              ))}
            </div>
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
                Cash actions
              </p>

              <h2
                style={{
                  margin: "8px 0 0",
                  color: "var(--color-text-primary)",
                  fontSize: 24,
                  lineHeight: 1.15,
                }}
              >
                What to do next
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
              Cash movement
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              Top inflows and outflows
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "var(--color-sage)",
                  fontSize: 15,
                }}
              >
                Top inflows
              </h3>

              {report.topInflows.length > 0 ? (
                report.topInflows.map((item) => (
                  <CashItemCard
                    key={item.id}
                    item={item}
                    currency={report.currency}
                  />
                ))
              ) : (
                <p
                  style={{
                    margin: 0,
                    color: "var(--color-text-secondary)",
                    fontSize: 13,
                    lineHeight: 1.65,
                  }}
                >
                  No inflow line items found yet.
                </p>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "var(--color-gold)",
                  fontSize: 15,
                }}
              >
                Top outflows
              </h3>

              {report.topOutflows.length > 0 ? (
                report.topOutflows.map((item) => (
                  <CashItemCard
                    key={item.id}
                    item={item}
                    currency={report.currency}
                  />
                ))
              ) : (
                <p
                  style={{
                    margin: 0,
                    color: "var(--color-text-secondary)",
                    fontSize: 13,
                    lineHeight: 1.65,
                  }}
                >
                  No outflow line items found yet.
                </p>
              )}
            </div>
          </div>
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
              Cash data by document
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
                      {document.category} - {document.cashSignalCount} cash
                      signal(s)
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