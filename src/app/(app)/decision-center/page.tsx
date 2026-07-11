import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  formatDecisionMoney,
  getDecisionCenterReport,
  type DecisionAction,
  type DecisionPriority,
} from "@/lib/decision-center-engine";

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

function priorityTone(priority: DecisionPriority): Tone {
  if (priority === "CRITICAL") return "danger";
  if (priority === "HIGH") return "danger";
  if (priority === "MEDIUM") return "warning";
  return "good";
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  return `${value.toFixed(1)}%`;
}

function formatMonths(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  return `${value.toFixed(1)} months`;
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

function ActionCard({ action }: { action: DecisionAction }) {
  const style = toneStyle(priorityTone(action.priority));

  return (
    <article
      style={{
        border: `1px solid ${style.border}`,
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.024))",
        borderRadius: 20,
        padding: 16,
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
        <span
          style={{
            color: style.color,
            border: `1px solid ${style.border}`,
            background: style.background,
            borderRadius: 999,
            padding: "5px 9px",
            fontSize: 11,
            fontWeight: 950,
            letterSpacing: "0.08em",
          }}
        >
          {action.priority} - {action.timeframe}
        </span>

        <span
          style={{
            color: "var(--color-text-secondary)",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {action.category}
        </span>
      </div>

      <h3
        style={{
          margin: 0,
          color: "var(--color-text-primary)",
          fontSize: 20,
          lineHeight: 1.2,
        }}
      >
        {action.title}
      </h3>

      <div
        style={{
          display: "grid",
          gap: 9,
        }}
      >
        <InfoBlock label="Problem" value={action.problem} />
        <InfoBlock label="Action" value={action.action} />
        <InfoBlock label="Expected impact" value={action.expectedImpact} />
      </div>

      <span
        style={{
          color: style.color,
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        Confidence: {action.confidence}
      </span>
    </article>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <p
      style={{
        margin: 0,
        color: "var(--color-text-secondary)",
        fontSize: 13,
        lineHeight: 1.65,
      }}
    >
      <strong style={{ color: "var(--color-text-primary)" }}>{label}:</strong>{" "}
      {value}
    </p>
  );
}

function ListCard({
  title,
  items,
  empty,
  tone = "neutral",
}: {
  title: string;
  items: string[];
  empty: string;
  tone?: Tone;
}) {
  const style = toneStyle(tone);

  return (
    <section
      className="section-card"
      style={{
        padding: 20,
        display: "grid",
        gap: 12,
      }}
    >
      <h2
        style={{
          margin: 0,
          color: "var(--color-text-primary)",
          fontSize: 20,
          lineHeight: 1.2,
        }}
      >
        {title}
      </h2>

      {items.length > 0 ? (
        <div style={{ display: "grid", gap: 9 }}>
          {items.map((item) => (
            <div
              key={item}
              style={{
                border: `1px solid ${style.border}`,
                background: style.background,
                borderRadius: 14,
                padding: 12,
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      ) : (
        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {empty}
        </p>
      )}
    </section>
  );
}

export default async function DecisionCenterPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const report = await getDecisionCenterReport(session.user.id);

  const statusTone: Tone =
    report.overallStatus === "STABLE"
      ? "good"
      : report.overallStatus === "WATCH"
        ? "warning"
        : report.overallStatus === "URGENT"
          ? "danger"
          : "neutral";

  return (
    <main>
      <header
        style={{
          marginBottom: 24,
          border: "1px solid rgba(245,158,11,0.22)",
          background:
            "radial-gradient(circle at top left, rgba(245,158,11,0.16), transparent 34%), radial-gradient(circle at bottom right, rgba(255,138,149,0.10), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.062), rgba(255,255,255,0.026))",
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
              AI Executive Decision Center
            </p>

            <h1
              style={{
                margin: "12px 0 0",
                color: "var(--color-text-primary)",
                fontSize: "clamp(38px, 5.2vw, 72px)",
                lineHeight: 0.98,
                letterSpacing: "-0.078em",
                maxWidth: 960,
              }}
            >
              What should the owner fix first?
            </h1>

            <p
              className="page-intro"
              style={{
                margin: "16px 0 0",
                lineHeight: 1.7,
                maxWidth: 850,
              }}
            >
              {report.executiveSummary}
            </p>
          </div>

          <Link href="/chat?agent=team" className="btn-ghost">
            Ask AI Finance Team →
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
            label="Decision score"
            value={`${report.score}/100`}
            hint={report.overallStatus}
            tone={statusTone}
          />

          <MetricCard
            label="Owner focus"
            value={report.ownerFocus}
            hint="Highest-priority decision"
            tone={statusTone}
          />

          <MetricCard
            label="Profit"
            value={formatDecisionMoney(report.metrics.profit, report.currency)}
            hint={`Margin: ${formatPercent(report.metrics.profitMarginPercent)}`}
            tone={
              report.metrics.profit === null
                ? "neutral"
                : report.metrics.profit >= 0
                  ? "good"
                  : "danger"
            }
          />

          <MetricCard
            label="Cash runway"
            value={formatMonths(report.metrics.estimatedRunwayMonths)}
            hint="Estimated from cash and monthly burn"
            tone={
              report.metrics.estimatedRunwayMonths === null
                ? "neutral"
                : report.metrics.estimatedRunwayMonths >= 6
                  ? "good"
                  : report.metrics.estimatedRunwayMonths >= 3
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
              Priority engine
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              Top actions for the business owner
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {report.topActions.slice(0, 6).map((action) => (
              <ActionCard key={action.id} action={action} />
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
              Execution timeline
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              Today, this week, this month
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
            <TimelineCard title="Today" actions={report.todayActions} />
            <TimelineCard title="This week" actions={report.weekActions} />
            <TimelineCard title="This month" actions={report.monthActions} />
          </div>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
          }}
        >
          <ListCard
            title="Decision warnings"
            items={report.decisionWarnings}
            empty="No major decision warnings right now."
            tone="danger"
          />

          <ListCard
            title="Missing data"
            items={report.missingData}
            empty="No major missing data detected."
            tone="warning"
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
              Engine inputs
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              What this decision used
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <SmallInput label="Revenue" value={formatDecisionMoney(report.metrics.revenue, report.currency)} />
            <SmallInput label="Expenses" value={formatDecisionMoney(report.metrics.expenses, report.currency)} />
            <SmallInput label="Cash" value={formatDecisionMoney(report.metrics.cash, report.currency)} />
            <SmallInput label="Approved docs" value={`${report.metrics.approvedDocuments}`} />
            <SmallInput label="Failed docs" value={`${report.metrics.failedDocuments}`} />
            <SmallInput label="Line items" value={`${report.metrics.totalLineItems}`} />
            <SmallInput label="Suspicious items" value={`${report.metrics.suspiciousLineItems}`} />
            <SmallInput label="Expense ratio" value={formatPercent(report.metrics.expenseRatioPercent)} />
          </div>
        </section>
      </section>
    </main>
  );
}

function TimelineCard({
  title,
  actions,
}: {
  title: string;
  actions: DecisionAction[];
}) {
  return (
    <article
      style={{
        border: "1px solid rgba(255,255,255,0.09)",
        background: "rgba(255,255,255,0.035)",
        borderRadius: 18,
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <h3
        style={{
          margin: 0,
          color: "var(--color-text-primary)",
          fontSize: 18,
        }}
      >
        {title}
      </h3>

      {actions.length > 0 ? (
        <div style={{ display: "grid", gap: 9 }}>
          {actions.map((action) => (
            <div
              key={`${title}-${action.id}`}
              style={{
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              <strong style={{ color: "var(--color-text-primary)" }}>
                {action.title}
              </strong>
              <br />
              {action.action}
            </div>
          ))}
        </div>
      ) : (
        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          No action assigned.
        </p>
      )}
    </article>
  );
}

function SmallInput({ label, value }: { label: string; value: string }) {
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