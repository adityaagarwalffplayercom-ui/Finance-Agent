import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getCfoDecisionPlan,
  type CfoAction,
  type CfoMetric,
  type CfoScenario,
} from "@/lib/cfo-decision-engine";

function toneStyle(tone: "good" | "warning" | "danger" | "neutral") {
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
  const rupee = String.fromCharCode(8377);

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

function MetricCard({ metric }: { metric: CfoMetric }) {
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

function ScenarioCard({ scenario }: { scenario: CfoScenario }) {
  const style = toneStyle(scenario.tone);

  return (
    <article
      style={{
        border: `1px solid ${style.border}`,
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.024))",
        borderRadius: 22,
        padding: 16,
        display: "grid",
        gap: 12,
        minHeight: 190,
        minWidth: 0,
      }}
    >
      <p
        style={{
          margin: 0,
          color: "var(--color-text-primary)",
          fontSize: 15,
          fontWeight: 950,
          lineHeight: 1.25,
        }}
      >
        {scenario.title}
      </p>

      <strong
        style={{
          color: style.color,
          fontSize: 28,
          lineHeight: 1,
          fontWeight: 950,
          letterSpacing: "-0.055em",
          overflowWrap: "anywhere",
        }}
      >
        {scenario.value}
      </strong>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.65,
        }}
      >
        {scenario.description}
      </p>
    </article>
  );
}

function ActionCard({ action }: { action: CfoAction }) {
  const tone =
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

export default async function CfoDecisionsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const plan = await getCfoDecisionPlan(session.user.id);

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
              CFO Decision Engine
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
              Break-even and profit improvement plan.
            </h1>

            <p
              className="page-intro"
              style={{
                margin: "16px 0 0",
                lineHeight: 1.7,
                maxWidth: 850,
              }}
            >
              {plan.summary}
            </p>
          </div>

          <Link href="/chat?agent=cfo" className="btn-ghost">
            Ask CFO Agent →
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
          {plan.cards.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>

        <section
          className="section-card"
          style={{
            padding: 22,
            display: "grid",
            gap: 18,
          }}
        >
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              Scenarios
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              How to reach break-even
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 14,
            }}
          >
            {plan.scenarios.map((scenario) => (
              <ScenarioCard key={scenario.title} scenario={scenario} />
            ))}
          </div>
        </section>

        <section
          className="section-card"
          style={{
            padding: 22,
            display: "grid",
            gap: 18,
          }}
        >
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              Hiring decision
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              Can the business afford another hire?
            </h2>
          </div>

          <article
            style={{
              border: plan.hiringDecision.canHire
                ? "1px solid rgba(46,213,115,0.28)"
                : "1px solid rgba(255,138,149,0.30)",
              background: plan.hiringDecision.canHire
                ? "rgba(46,213,115,0.085)"
                : "rgba(255,138,149,0.085)",
              borderRadius: 20,
              padding: 16,
              display: "grid",
              gap: 10,
            }}
          >
            <strong
              style={{
                color: plan.hiringDecision.canHire
                  ? "var(--color-sage)"
                  : "var(--color-danger)",
                fontSize: 18,
              }}
            >
              {plan.hiringDecision.canHire
                ? "Hiring may be possible"
                : "Hiring is not recommended yet"}
            </strong>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              {plan.hiringDecision.message}
            </p>
          </article>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
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
                CFO actions
              </p>

              <h2
                style={{
                  margin: "8px 0 0",
                  color: "var(--color-text-primary)",
                  fontSize: 24,
                  lineHeight: 1.15,
                }}
              >
                What to fix first
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              {plan.actions.map((action) => (
                <ActionCard
                  key={`${action.priority}-${action.title}`}
                  action={action}
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
                Expense signals
              </p>

              <h2
                style={{
                  margin: "8px 0 0",
                  color: "var(--color-text-primary)",
                  fontSize: 24,
                  lineHeight: 1.15,
                }}
              >
                Largest cost items
              </h2>
            </div>

            {plan.topExpenseSignals.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gap: 10,
                }}
              >
                {plan.topExpenseSignals.map((item) => (
                  <article
                    key={`${item.source}-${item.label}-${item.amount}`}
                    style={{
                      border: "1px solid rgba(255,209,102,0.24)",
                      background: "rgba(255,209,102,0.075)",
                      borderRadius: 16,
                      padding: 12,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <strong
                      style={{
                        color: "var(--color-text-primary)",
                        fontSize: 13,
                        lineHeight: 1.35,
                      }}
                    >
                      {item.label}
                    </strong>

                    <span
                      style={{
                        color: "var(--color-gold)",
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      {formatMoney(item.amount, plan.currency)}
                    </span>

                    <span
                      style={{
                        color: "var(--color-text-muted)",
                        fontSize: 11,
                        lineHeight: 1.4,
                      }}
                    >
                      {item.source}
                    </span>
                  </article>
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
                No clear expense line items found yet. Upload readable expense
                files or financial statements to improve this section.
              </p>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}