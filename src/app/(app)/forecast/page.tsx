import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  formatForecastMoney,
  getForecastReport,
  type ForecastPeriod,
  type ForecastScenario,
  type ForecastStatus,
} from "@/lib/ledger-forecast-engine";

type Tone = "good" | "warning" | "danger" | "neutral";

function toneFromStatus(status: ForecastStatus): Tone {
  if (status === "POSITIVE") return "good";
  if (status === "WATCH") return "warning";
  if (status === "RISK") return "danger";
  return "neutral";
}

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

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  return `${value.toFixed(1)}%`;
}

function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: Tone;
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
          fontSize: "clamp(24px, 3vw, 34px)",
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

function PeriodCard({
  period,
  currency,
}: {
  period: ForecastPeriod;
  currency: string;
}) {
  const style = toneStyle(toneFromStatus(period.status));

  return (
    <article
      style={{
        border: `1px solid ${style.border}`,
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.024))",
        borderRadius: 18,
        padding: 15,
        display: "grid",
        gap: 12,
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
        }}
      >
        <strong
          style={{
            color: "var(--color-text-primary)",
            fontSize: 17,
          }}
        >
          {period.months}-month forecast
        </strong>

        <span
          style={{
            color: style.color,
            border: `1px solid ${style.border}`,
            background: style.background,
            borderRadius: 999,
            padding: "5px 9px",
            fontSize: 11,
            fontWeight: 950,
          }}
        >
          {period.status}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <SmallValue
          label="Revenue"
          value={formatForecastMoney(period.projectedRevenue, currency)}
        />
        <SmallValue
          label="Expenses"
          value={formatForecastMoney(period.projectedExpenses, currency)}
        />
        <SmallValue
          label="Profit"
          value={formatForecastMoney(period.projectedProfit, currency)}
        />
        <SmallValue
          label="Verified cash"
          value={formatForecastMoney(period.projectedCash, currency)}
        />
      </div>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {period.summary}
      </p>
    </article>
  );
}

function SmallValue({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.035)",
        borderRadius: 14,
        padding: 10,
        display: "grid",
        gap: 5,
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: "var(--color-text-secondary)",
          fontSize: 11,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 14,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </strong>
    </span>
  );
}

function ScenarioCard({
  scenario,
  currency,
}: {
  scenario: ForecastScenario;
  currency: string;
}) {
  const twelveMonth = scenario.periods.find((period) => period.months === 12);
  const tone = toneFromStatus(twelveMonth?.status ?? "INSUFFICIENT_DATA");
  const style = toneStyle(tone);

  return (
    <article
      style={{
        border: `1px solid ${style.border}`,
        background: style.background,
        borderRadius: 22,
        padding: 18,
        display: "grid",
        gap: 14,
        minWidth: 0,
      }}
    >
      <div>
        <span
          style={{
            color: style.color,
            fontSize: 11,
            fontWeight: 950,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          What-if scenario
        </span>

        <h3
          style={{
            margin: "8px 0 0",
            color: "var(--color-text-primary)",
            fontSize: 20,
            lineHeight: 1.2,
          }}
        >
          {scenario.title}
        </h3>

        <p
          style={{
            margin: "8px 0 0",
            color: "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {scenario.description}
        </p>
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(0,0,0,0.14)",
          borderRadius: 16,
          padding: 12,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "var(--color-text-primary)" }}>
          Assumption:
        </strong>{" "}
        {scenario.assumption}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
          gap: 10,
        }}
      >
        {scenario.periods.map((period) => (
          <SmallValue
            key={`${scenario.id}-${period.months}`}
            label={`${period.months}m profit`}
            value={formatForecastMoney(period.projectedProfit, currency)}
          />
        ))}
      </div>

      <p
        style={{
          margin: 0,
          color: style.color,
          fontSize: 13,
          lineHeight: 1.6,
          fontWeight: 850,
        }}
      >
        {scenario.recommendation}
      </p>
    </article>
  );
}

export default async function ForecastPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const report = await getForecastReport(session.user.id);
  const statusTone = toneFromStatus(report.status);

  const confidenceTone: Tone =
    report.assumptions.confidence === "HIGH"
      ? "good"
      : report.assumptions.confidence === "MEDIUM"
        ? "warning"
        : "danger";

  return (
    <main>
      <header
        style={{
          marginBottom: 24,
          border: "1px solid rgba(245,158,11,0.22)",
          background:
            "radial-gradient(circle at top left, rgba(245,158,11,0.16), transparent 34%), radial-gradient(circle at bottom right, rgba(56,189,248,0.10), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.062), rgba(255,255,255,0.026))",
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
              Predictive Analytics Agent
            </p>

            <h1
              style={{
                margin: "12px 0 0",
                color: "var(--color-text-primary)",
                fontSize: "clamp(38px, 5.2vw, 72px)",
                lineHeight: 0.98,
                letterSpacing: "-0.078em",
                maxWidth: 940,
              }}
            >
              Forecast and what-if simulator.
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

          <Link href="/chat?agent=cfo" className="btn-ghost">
            Ask CFO Agent →
          </Link>
        </div>
      </header>
      {/* FORECAST_LEDGER_CONFIDENCE */}
      <section
        aria-label="Forecast data confidence"
        style={{
          marginBottom: 18,
          border: `1px solid ${toneStyle(confidenceTone).border}`,
          background: toneStyle(confidenceTone).background,
          borderRadius: 20,
          padding: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 5,
          }}
        >
          <span
            style={{
              color: toneStyle(confidenceTone).color,
              fontSize: 11,
              fontWeight: 950,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {report.assumptions.confidence} forecast confidence
          </span>

          <strong
            style={{
              color: "var(--color-text-primary)",
              fontSize: 17,
              lineHeight: 1.3,
            }}
          >
            Data confidence {report.assumptions.confidenceScore}/100
          </strong>

          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {report.assumptions.confidenceReason}
          </p>
        </div>

        <Link
          href="/ledger?status=NEEDS_REVIEW"
          className="btn-ghost"
        >
          Review Ledger →
        </Link>
      </section>

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
            label="Forecast status"
            value={report.status}
            hint={report.assumptions.confidenceReason}
            tone={statusTone}
          />

          <MetricCard
            label="Current monthly profit"
            value={formatForecastMoney(
              report.baseMetrics.monthlyProfit,
              report.currency,
            )}
            hint="Average from approved ledger months"
            tone={
              report.baseMetrics.monthlyProfit === null
                ? "neutral"
                : report.baseMetrics.monthlyProfit >= 0
                  ? "good"
                  : "danger"
            }
          />

          <MetricCard
            label="Current margin"
            value={formatPercent(report.baseMetrics.currentMarginPercent)}
            hint="Profit as percentage of revenue"
            tone={
              report.baseMetrics.currentMarginPercent === null
                ? "neutral"
                : report.baseMetrics.currentMarginPercent >= 10
                  ? "good"
                  : report.baseMetrics.currentMarginPercent >= 0
                    ? "warning"
                    : "danger"
            }
          />

          <MetricCard
            label="Forecast confidence"
            value={report.assumptions.confidence}
            hint={`${report.dataCoverage.approvedEntries} approved entries · ${report.dataCoverage.observedMonths} month(s)`}
            tone={
              report.assumptions.confidence === "HIGH"
                ? "good"
                : report.assumptions.confidence === "MEDIUM"
                  ? "warning"
                  : "danger"
            }
          />
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
              Base forecast
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              3-month, 6-month and 12-month projection
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
            {report.periods.map((period) => (
              <PeriodCard
                key={period.months}
                period={period}
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
              What-if simulator
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              Test business decisions before taking them
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {report.scenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
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
              Forecast assumptions
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              How Actic Finance estimated the future
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 12,
            }}
          >
            <SmallValue
              label="Revenue growth"
              value={`${report.assumptions.monthlyRevenueGrowthPercent.toFixed(
                1,
              )}% monthly`}
            />

            <SmallValue
              label="Expense growth"
              value={`${report.assumptions.monthlyExpenseGrowthPercent.toFixed(
                1,
              )}% monthly`}
            />

            <SmallValue
              label="Employee cost"
              value={formatForecastMoney(
                report.assumptions.estimatedMonthlyEmployeeCost,
                report.currency,
              )}
            />

            <SmallValue
              label="Ledger coverage"
              value={`${report.dataCoverage.approvedEntries} approved · ${report.dataCoverage.pendingEntries} pending`}
            />
          </div>

          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 13,
              lineHeight: 1.65,
            }}
          >
            Forecasts are estimates, not guarantees. Better bank statements,
            sales invoices, purchase invoices, payroll records, and audited
            financial statements will improve forecast confidence.
          </p>
        </section>
      </section>
    </main>
  );
}