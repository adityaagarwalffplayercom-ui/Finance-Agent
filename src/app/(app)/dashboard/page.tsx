import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFinancialProfile } from "@/lib/financial-profile";

type Tone = "sage" | "amber" | "gold" | "danger" | "neutral";

type Alert = {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
};

type StatBlock = {
  value: string;
  delta: string;
};

type AgentCardData = {
  id: string;
  icon: string;
  name: string;
  role: string;
  insight: string;
  tone: Tone;
};

function getToneStyle(tone: Tone) {
  return {
    sage: {
      color: "var(--color-sage)",
      border: "rgba(46,213,115,0.28)",
      background: "rgba(46,213,115,0.085)",
      glow: "rgba(46,213,115,0.12)",
    },
    amber: {
      color: "var(--color-amber)",
      border: "rgba(245,158,11,0.30)",
      background: "rgba(245,158,11,0.095)",
      glow: "rgba(245,158,11,0.13)",
    },
    gold: {
      color: "var(--color-gold)",
      border: "rgba(255,209,102,0.30)",
      background: "rgba(255,209,102,0.085)",
      glow: "rgba(255,209,102,0.12)",
    },
    danger: {
      color: "var(--color-danger)",
      border: "rgba(255,138,149,0.30)",
      background: "rgba(255,138,149,0.085)",
      glow: "rgba(255,138,149,0.10)",
    },
    neutral: {
      color: "var(--color-text-secondary)",
      border: "var(--color-border)",
      background: "rgba(255,255,255,0.045)",
      glow: "rgba(255,255,255,0.06)",
    },
  }[tone];
}

function displayValue(value?: string | null) {
  return value && value.trim().length > 0 ? value.trim() : "Not set";
}

function getGreetingName(value?: string | null) {
  if (!value) return "there";
  const first = value.split(" ")[0]?.trim();
  return first || value;
}

function normalizeUnavailable(value: string) {
  const cleaned = value.trim();
  return cleaned === "—" || cleaned === "-" || cleaned.length === 0
    ? "Not available"
    : cleaned;
}

function getAlertTone(severity: Alert["severity"]): Tone {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "gold";
  return "sage";
}

function getAlertLabel(severity: Alert["severity"]) {
  if (severity === "critical") return "High";
  if (severity === "warning") return "Medium";
  return "Info";
}

function SectionHeading({
  eyebrow,
  title,
  hint,
  action,
}: {
  eyebrow?: string;
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 14,
        alignItems: "flex-start",
        flexWrap: "wrap",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 6,
          minWidth: 0,
        }}
      >
        {eyebrow && (
          <p className="eyebrow" style={{ margin: 0 }}>
            {eyebrow}
          </p>
        )}

        <p className="section-title" style={{ margin: 0 }}>
          {title}
        </p>

        <p
          className="section-hint"
          style={{
            margin: 0,
            lineHeight: 1.55,
            maxWidth: 760,
          }}
        >
          {hint}
        </p>
      </div>

      {action}
    </div>
  );
}

function HeroBadge({ children, tone }: { children: ReactNode; tone: Tone }) {
  const toneStyle = getToneStyle(tone);

  return (
    <span
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: toneStyle.background,
        color: toneStyle.color,
        borderRadius: 999,
        padding: "8px 11px",
        fontSize: 12,
        fontWeight: 950,
        whiteSpace: "nowrap",
        boxShadow: `0 14px 32px ${toneStyle.glow}`,
      }}
    >
      {children}
    </span>
  );
}

function DashboardStatCard({
  label,
  stat,
  tone,
}: {
  label: string;
  stat: StatBlock;
  tone: Tone;
}) {
  const toneStyle = getToneStyle(tone);

  return (
    <article
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: `linear-gradient(135deg, ${toneStyle.background}, rgba(255,255,255,0.024))`,
        borderRadius: 22,
        padding: 18,
        display: "grid",
        gap: 10,
        minHeight: 144,
        minWidth: 0,
        boxShadow: `0 18px 48px ${toneStyle.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
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
          lineHeight: 1.2,
        }}
      >
        {label}
      </p>

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 30,
          lineHeight: 1,
          fontWeight: 950,
          letterSpacing: "-0.05em",
          overflowWrap: "anywhere",
        }}
      >
        {stat.value}
      </strong>

      <p
        style={{
          margin: 0,
          color: toneStyle.color,
          fontSize: 12,
          lineHeight: 1.45,
          fontWeight: 800,
          overflowWrap: "anywhere",
        }}
      >
        {stat.delta}
      </p>
    </article>
  );
}

function HealthScoreCard({
  score,
  label,
}: {
  score: number;
  label: string;
}) {
  const tone: Tone = score >= 70 ? "sage" : score >= 40 ? "gold" : "danger";
  const toneStyle = getToneStyle(tone);
  const safeScore = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * 80;
  const offset = circumference - (safeScore / 100) * circumference;

  return (
    <section
      style={{
        border: `1px solid ${toneStyle.border}`,
        background:
          "radial-gradient(circle at top left, rgba(245,158,11,0.10), transparent 36%), linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.024))",
        borderRadius: 26,
        padding: 20,
        display: "grid",
        justifyItems: "center",
        alignContent: "center",
        gap: 14,
        minHeight: 290,
        minWidth: 0,
        boxShadow:
          "0 20px 70px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.052)",
      }}
    >
      <svg
        viewBox="0 0 200 200"
        width="190"
        height="190"
        role="img"
        aria-label={`Business health score ${safeScore} out of 100, ${label}`}
      >
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="14"
        />

        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke={toneStyle.color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 100 100)"
        />

        <text
          x="100"
          y="96"
          textAnchor="middle"
          fill="var(--color-text-primary)"
          fontSize="38"
          fontWeight="950"
        >
          {safeScore}
        </text>

        <text
          x="100"
          y="122"
          textAnchor="middle"
          fill="var(--color-text-secondary)"
          fontSize="14"
          fontWeight="800"
        >
          / 100
        </text>
      </svg>

      <div
        style={{
          display: "grid",
          gap: 5,
          justifyItems: "center",
          textAlign: "center",
        }}
      >
        <strong
          style={{
            color: toneStyle.color,
            fontSize: 15,
          }}
        >
          {label}
        </strong>

        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          Calculated from approved financial documents.
        </p>
      </div>
    </section>
  );
}

function buildDashboardAgents({
  healthScore,
  approvedDocuments,
  pendingReview,
  rejectedDocuments,
  revenue,
  profit,
  cash,
}: {
  healthScore: number;
  approvedDocuments: number;
  pendingReview: number;
  rejectedDocuments: number;
  revenue: string;
  profit: string;
  cash: string;
}): AgentCardData[] {
  return [
    {
      id: "cfo",
      icon: "📊",
      name: "CFO Agent",
      role: "Executive finance decision maker",
      insight:
        approvedDocuments > 0
          ? `Health score is ${healthScore}/100. Ask for growth priorities, expense control, runway, and strategy.`
          : "Approve documents so the CFO Agent can analyze your business health and decisions.",
      tone: "sage",
    },
    {
      id: "accountant",
      icon: "🧾",
      name: "Accountant Agent",
      role: "Books and document control",
      insight:
        pendingReview > 0
          ? `${pendingReview} processed document(s) need approval before they can affect the dashboard.`
          : `${approvedDocuments} approved document(s) are being used as trusted financial data.`,
      tone: pendingReview > 0 ? "gold" : "sage",
    },
    {
      id: "analyst",
      icon: "📈",
      name: "Financial Analyst Agent",
      role: "Margins, ratios, and trend analysis",
      insight:
        profit !== "Not available"
          ? `Profit signal is ${profit}. Ask about margins, expense ratio, and trend quality.`
          : "Profit margin is not available yet. Approve income and expense documents for ratio analysis.",
      tone: "amber",
    },
    {
      id: "cashflow",
      icon: "💧",
      name: "Cash Flow Agent",
      role: "Cash runway and liquidity monitor",
      insight:
        cash !== "Not available"
          ? `Latest cash signal is ${cash}. Ask about runway, burn rate, and liquidity gaps.`
          : "Cash is not visible yet. Upload bank statements to unlock cash runway and monthly burn insights.",
      tone: "sage",
    },
    {
      id: "consultant",
      icon: "🧠",
      name: "Business Consultant Agent",
      role: "Growth and cost-control advisor",
      insight:
        approvedDocuments > 0
          ? "The business has enough trusted data to plan profitability, cost control, and growth actions."
          : "Approve financial documents so this agent can recommend realistic business improvements.",
      tone: "amber",
    },
    {
      id: "risk",
      icon: "🛡️",
      name: "Risk & Compliance Agent",
      role: "Financial risk guardrail",
      insight:
        rejectedDocuments > 0
          ? `${rejectedDocuments} rejected document(s) are excluded from analysis. Ask what data gaps remain.`
          : revenue !== "Not available"
            ? "Revenue data is available. Ask this agent to check document gaps and financial red flags."
            : "Revenue data is missing. Upload or approve documents containing revenue.",
      tone: rejectedDocuments > 0 ? "danger" : revenue !== "Not available" ? "sage" : "gold",
    },
  ];
}

function AgentCard({ agent }: { agent: AgentCardData }) {
  const toneStyle = getToneStyle(agent.tone);

  return (
    <article
      style={{
        border: `1px solid ${toneStyle.border}`,
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.024))",
        borderRadius: 24,
        padding: 18,
        minHeight: 320,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 16,
        minWidth: 0,
        overflow: "hidden",
        boxShadow:
          "0 18px 60px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.052)",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 16,
          minWidth: 0,
          flex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              minWidth: 0,
              flex: 1,
            }}
          >
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: toneStyle.background,
                border: `1px solid ${toneStyle.border}`,
                fontSize: 19,
                flex: "0 0 auto",
                boxShadow: `0 14px 34px ${toneStyle.glow}`,
              }}
            >
              {agent.icon}
            </span>

            <div
              style={{
                display: "grid",
                gap: 6,
                minWidth: 0,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "var(--color-text-primary)",
                  fontSize: 19,
                  lineHeight: 1.15,
                  fontWeight: 950,
                  letterSpacing: "-0.04em",
                  overflowWrap: "break-word",
                }}
              >
                {agent.name}
              </h3>

              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontSize: 13,
                  lineHeight: 1.45,
                  fontWeight: 750,
                  overflowWrap: "anywhere",
                }}
              >
                {agent.role}
              </p>
            </div>
          </div>

          <span
            style={{
              border: "1px solid rgba(46,213,115,0.28)",
              background: "rgba(46,213,115,0.10)",
              color: "var(--color-sage)",
              borderRadius: 999,
              padding: "7px 10px",
              fontSize: 11,
              fontWeight: 950,
              lineHeight: 1,
              whiteSpace: "nowrap",
              flex: "0 0 auto",
            }}
          >
            Active
          </span>
        </div>

        <p
          style={{
            margin: 0,
            color: "var(--color-text-primary)",
            fontSize: 14,
            lineHeight: 1.72,
            fontWeight: 760,
            minWidth: 0,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {agent.insight}
        </p>
      </div>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          justifyContent: "flex-start",
        }}
      >
        <Link
          href={`/chat?agent=${agent.id}`}
          className="btn-ghost"
          style={{
            width: "fit-content",
            minWidth: 150,
            maxWidth: "100%",
            justifyContent: "center",
            border: `1px solid ${toneStyle.border}`,
            background: toneStyle.background,
            color: toneStyle.color,
          }}
        >
          Ask agent →
        </Link>
      </div>
    </article>
  );
}

function DashboardAiTeam({
  healthScore,
  approvedDocuments,
  pendingReview,
  rejectedDocuments,
  revenue,
  profit,
  cash,
}: {
  healthScore: number;
  approvedDocuments: number;
  pendingReview: number;
  rejectedDocuments: number;
  revenue: string;
  profit: string;
  cash: string;
}) {
  const agents = buildDashboardAgents({
    healthScore,
    approvedDocuments,
    pendingReview,
    rejectedDocuments,
    revenue,
    profit,
    cash,
  });

  return (
    <section
      style={{
        border: "1px solid rgba(245,158,11,0.18)",
        background:
          "radial-gradient(circle at top left, rgba(245,158,11,0.10), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.024))",
        borderRadius: 28,
        padding: 22,
        display: "grid",
        gap: 18,
        marginBottom: 24,
        overflow: "hidden",
        boxShadow:
          "0 20px 70px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.052)",
      }}
    >
      <SectionHeading
        title="AI Finance Team"
        hint="Your agents use only approved documents. Pending and rejected data stay out of dashboard, chat, and recommendations."
        action={
          <Link href="/chat" className="btn-ghost">
            Open full AI chat
          </Link>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        <MiniTrustCard
          label="Trusted docs"
          value={approvedDocuments}
          hint="Used by agents"
          tone="sage"
        />

        <MiniTrustCard
          label="Pending review"
          value={pendingReview}
          hint="Waiting for approval"
          tone={pendingReview > 0 ? "gold" : "sage"}
        />

        <MiniTrustCard
          label="Rejected"
          value={rejectedDocuments}
          hint="Excluded from analysis"
          tone={rejectedDocuments > 0 ? "danger" : "neutral"}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 18,
          alignItems: "stretch",
        }}
      >
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </section>
  );
}

function MiniTrustCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: Tone;
}) {
  const toneStyle = getToneStyle(tone);

  return (
    <article
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: `linear-gradient(135deg, ${toneStyle.background}, rgba(255,255,255,0.022))`,
        borderRadius: 20,
        padding: 16,
        minHeight: 120,
        display: "grid",
        gap: 8,
        minWidth: 0,
        boxShadow: `0 16px 40px ${toneStyle.glow}, inset 0 1px 0 rgba(255,255,255,0.045)`,
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
          color: toneStyle.color,
          fontSize: 32,
          lineHeight: 1,
          fontWeight: 950,
        }}
      >
        {value}
      </strong>

      <p
        style={{
          margin: 0,
          color: toneStyle.color,
          fontSize: 12,
          lineHeight: 1.35,
          fontWeight: 750,
        }}
      >
        {hint}
      </p>
    </article>
  );
}

function ExecutiveSummary({
  revenue,
  expenses,
  profit,
  healthLabel,
  alerts,
}: {
  revenue: string;
  expenses: string;
  profit: string;
  healthLabel: string;
  alerts: Alert[];
}) {
  const actionAlerts = alerts.slice(0, 2);

  return (
    <section
      style={{
        border: "1px solid rgba(245,158,11,0.18)",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.024))",
        borderRadius: 28,
        padding: 22,
        display: "grid",
        gap: 18,
        marginBottom: 24,
        overflow: "hidden",
        boxShadow:
          "0 20px 70px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.052)",
      }}
    >
      <SectionHeading
        title="Executive summary"
        hint="AI CFO-style interpretation of your current financial position."
      />

      <p
        style={{
          margin: 0,
          color: "var(--color-text-primary)",
          fontSize: 15,
          lineHeight: 1.75,
          fontWeight: 760,
          overflowWrap: "anywhere",
        }}
      >
        Based on approved documents, revenue is {revenue}, expenses are{" "}
        {expenses}, and estimated profit is {profit}. The business appears{" "}
        {healthLabel.toLowerCase()} based on trusted data.
      </p>

      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        <SectionHeading
          title="Recommended actions"
          hint="Prioritized next steps based on processed and approved documents."
        />

        {actionAlerts.length === 0 ? (
          <ActionRow
            label="Info"
            message="No major recommendations yet. Upload and approve more documents to strengthen analysis."
            severity="info"
          />
        ) : (
          actionAlerts.map((alert) => (
            <ActionRow
              key={alert.id}
              label={getAlertLabel(alert.severity)}
              message={alert.message}
              severity={alert.severity}
            />
          ))
        )}
      </div>
    </section>
  );
}

function ActionRow({
  label,
  message,
  severity,
}: {
  label: string;
  message: string;
  severity: Alert["severity"];
}) {
  const tone = getAlertTone(severity);
  const toneStyle = getToneStyle(tone);

  return (
    <article
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: `linear-gradient(135deg, ${toneStyle.background}, rgba(255,255,255,0.022))`,
        borderRadius: 18,
        padding: 14,
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: 12,
        alignItems: "flex-start",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: toneStyle.color,
          boxShadow: `0 0 18px ${toneStyle.color}`,
          marginTop: 7,
        }}
      />

      <div
        style={{
          display: "grid",
          gap: 6,
          minWidth: 0,
        }}
      >
        <span
          style={{
            width: "fit-content",
            border: `1px solid ${toneStyle.border}`,
            background: toneStyle.background,
            color: toneStyle.color,
            borderRadius: 999,
            padding: "5px 8px",
            fontSize: 10,
            fontWeight: 950,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>

        <p
          style={{
            margin: 0,
            color: "var(--color-text-primary)",
            fontSize: 13,
            lineHeight: 1.6,
            fontWeight: 760,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {message}
        </p>
      </div>
    </article>
  );
}

function CashFlowSection({
  trend,
  caption,
}: {
  trend: number[];
  caption: string;
}) {
  const hasTrend = trend.length > 1;
  const max = Math.max(...trend.map((value) => Math.abs(value)), 1);

  return (
    <section
      style={{
        border: "1px solid rgba(245,158,11,0.16)",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.024))",
        borderRadius: 26,
        padding: 20,
        minHeight: 260,
        display: "grid",
        gap: 16,
        overflow: "hidden",
      }}
    >
      <SectionHeading title="Cash flow trend" hint={caption} />

      {hasTrend ? (
        <div
          style={{
            height: 160,
            display: "flex",
            alignItems: "end",
            gap: 10,
            border: "1px solid rgba(245,158,11,0.12)",
            background: "rgba(0,0,0,0.12)",
            borderRadius: 18,
            padding: 14,
          }}
        >
          {trend.map((value, index) => {
            const height = Math.max(10, (Math.abs(value) / max) * 130);
            const positive = value >= 0;

            return (
              <span
                key={`${value}-${index}`}
                title={String(value)}
                style={{
                  flex: 1,
                  height,
                  borderRadius: 999,
                  background: positive
                    ? "linear-gradient(180deg, var(--color-sage), rgba(46,213,115,0.20))"
                    : "linear-gradient(180deg, var(--color-danger), rgba(255,138,149,0.20))",
                  border: positive
                    ? "1px solid rgba(46,213,115,0.30)"
                    : "1px solid rgba(255,138,149,0.30)",
                }}
              />
            );
          })}
        </div>
      ) : (
        <div
          style={{
            border: "1px dashed rgba(245,158,11,0.22)",
            background: "rgba(245,158,11,0.045)",
            borderRadius: 18,
            padding: 18,
            display: "grid",
            gap: 12,
            alignItems: "start",
          }}
        >
          <strong
            style={{
              color: "var(--color-text-primary)",
              fontSize: 15,
              lineHeight: 1.45,
            }}
          >
            Upload and approve documents across multiple months to generate a
            proper cash flow trend.
          </strong>

          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            Bank statements will make this section much stronger.
          </p>

          <Link href="/documents" className="btn-ghost">
            Upload bank statement
          </Link>
        </div>
      )}
    </section>
  );
}

function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <section
      style={{
        border: "1px solid rgba(245,158,11,0.16)",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.024))",
        borderRadius: 26,
        padding: 20,
        minHeight: 260,
        display: "grid",
        gap: 16,
        alignContent: "start",
        overflow: "hidden",
      }}
    >
      <SectionHeading
        title="AI recommendations"
        hint="Priority actions based on approved financial data."
        action={
          <HeroBadge tone="amber">
            {alerts.length} insight{alerts.length === 1 ? "" : "s"}
          </HeroBadge>
        }
      />

      {alerts.length === 0 ? (
        <ActionRow
          label="Info"
          message="No major recommendations yet."
          severity="info"
        />
      ) : (
        <div
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          {alerts.slice(0, 3).map((alert) => (
            <ActionRow
              key={alert.id}
              label={getAlertLabel(alert.severity)}
              message={alert.message}
              severity={alert.severity}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MetricsSection({
  revenue,
  expenses,
  profit,
  cash,
  healthScore,
  healthLabel,
}: {
  revenue: string;
  expenses: string;
  profit: string;
  cash: string;
  healthScore: number;
  healthLabel: string;
}) {
  return (
    <section
      style={{
        border: "1px solid rgba(245,158,11,0.16)",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.024))",
        borderRadius: 28,
        padding: 22,
        display: "grid",
        gap: 18,
        marginTop: 24,
        overflow: "hidden",
      }}
    >
      <SectionHeading
        title="Financial metrics"
        hint="Key CFO ratios calculated from approved business documents."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        <MiniTrustCard
          label="Revenue"
          value={0}
          hint={revenue}
          tone="sage"
        />

        <MiniMetricCard label="Expenses" value={expenses} tone="danger" />
        <MiniMetricCard label="Profit" value={profit} tone="sage" />
        <MiniMetricCard label="Cash" value={cash} tone="amber" />
        <MiniMetricCard
          label="Health"
          value={`${healthScore}/100`}
          hint={healthLabel}
          tone={healthScore >= 70 ? "sage" : "gold"}
        />
      </div>
    </section>
  );
}

function MiniMetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: Tone;
}) {
  const toneStyle = getToneStyle(tone);

  return (
    <article
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: `linear-gradient(135deg, ${toneStyle.background}, rgba(255,255,255,0.022))`,
        borderRadius: 20,
        padding: 16,
        minHeight: 132,
        display: "grid",
        gap: 8,
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
          fontSize: 24,
          lineHeight: 1.1,
          fontWeight: 950,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </strong>

      {hint && (
        <p
          style={{
            margin: 0,
            color: toneStyle.color,
            fontSize: 12,
            lineHeight: 1.4,
            fontWeight: 750,
          }}
        >
          {hint}
        </p>
      )}
    </article>
  );
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [profile, business, approvedDocuments, pendingReview, rejectedDocuments] =
    await Promise.all([
      getFinancialProfile(session.user.id),
      prisma.business.findUnique({
        where: {
          userId: session.user.id,
        },
        select: {
          name: true,
          industry: true,
          country: true,
          currency: true,
        },
      }),
      prisma.document.count({
        where: {
          userId: session.user.id,
          status: "PROCESSED",
          reviewStatus: "APPROVED",
        },
      }),
      prisma.document.count({
        where: {
          userId: session.user.id,
          status: "PROCESSED",
          reviewStatus: "NEEDS_REVIEW",
        },
      }),
      prisma.document.count({
        where: {
          userId: session.user.id,
          reviewStatus: "REJECTED",
        },
      }),
    ]);

  const userName = getGreetingName(session.user.name ?? session.user.email);
  const revenue = normalizeUnavailable(profile.revenue.value);
  const expenses = normalizeUnavailable(profile.expenses.value);
  const profit = normalizeUnavailable(profile.profit.value);
  const cash = normalizeUnavailable(profile.cash.value);

  return (
    <>
      <style>
        {`
          @media (max-width: 1180px) {
            .dashboard-overview-grid,
            .dashboard-lower-grid {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 760px) {
            .dashboard-page-title {
              font-size: 34px !important;
            }
          }
        `}
      </style>

      <header
        style={{
          marginBottom: 24,
          border: "1px solid rgba(245,158,11,0.22)",
          background:
            "radial-gradient(circle at top left, rgba(245,158,11,0.15), transparent 34%), radial-gradient(circle at bottom right, rgba(46,213,115,0.08), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.062), rgba(255,255,255,0.026))",
          borderRadius: 30,
          padding: 26,
          display: "flex",
          justifyContent: "space-between",
          gap: 18,
          alignItems: "flex-start",
          flexWrap: "wrap",
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 10,
            maxWidth: 820,
            minWidth: 0,
          }}
        >
          <p className="eyebrow" style={{ margin: 0 }}>
            Executive command center
          </p>

          <h1
            className="dashboard-page-title"
            style={{
              margin: 0,
              color: "var(--color-text-primary)",
              fontSize: 46,
              lineHeight: 1,
              letterSpacing: "-0.065em",
            }}
          >
            Good to see you, {userName}.
          </h1>

          <p
            className="page-intro"
            style={{
              margin: 0,
              lineHeight: 1.65,
              maxWidth: 780,
            }}
          >
            Your dashboard is based only on approved AI extractions. Pending and
            rejected documents are excluded from financial analysis.
          </p>
        </div>

        <HeroBadge tone="amber">
          Trusted data · {approvedDocuments} approved document
          {approvedDocuments === 1 ? "" : "s"}
        </HeroBadge>
      </header>

      <section
        style={{
          border: "1px solid rgba(245,158,11,0.16)",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.050), rgba(255,255,255,0.024))",
          borderRadius: 26,
          padding: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 5,
            minWidth: 0,
          }}
        >
          <p className="section-title" style={{ margin: 0 }}>
            Ask your AI finance team
          </p>

          <p
            className="section-hint"
            style={{
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            Turn trusted numbers into decisions. Ask about losses, expenses,
            cash flow, risks, hiring, or missing documents.
          </p>
        </div>

        <Link href="/chat" className="btn-ghost">
          Ask AI
        </Link>
      </section>

      <DashboardAiTeam
        healthScore={profile.healthScore}
        approvedDocuments={approvedDocuments}
        pendingReview={pendingReview}
        rejectedDocuments={rejectedDocuments}
        revenue={revenue}
        profit={profit}
        cash={cash}
      />

      <section
        className="dashboard-overview-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 0.35fr) minmax(0, 0.65fr)",
          gap: 18,
          alignItems: "stretch",
          marginBottom: 24,
        }}
      >
        <HealthScoreCard
          score={profile.healthScore}
          label={profile.healthLabel}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 14,
            alignItems: "stretch",
          }}
        >
          <DashboardStatCard label="Revenue" stat={profile.revenue} tone="sage" />
          <DashboardStatCard label="Expenses" stat={profile.expenses} tone="gold" />
          <DashboardStatCard label="Profit" stat={profile.profit} tone="sage" />
          <DashboardStatCard label="Cash on hand" stat={profile.cash} tone="amber" />
        </div>
      </section>

      <ExecutiveSummary
        revenue={revenue}
        expenses={expenses}
        profit={profit}
        healthLabel={profile.healthLabel}
        alerts={profile.alerts}
      />

      <section
        className="dashboard-lower-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 0.65fr)",
          gap: 18,
          alignItems: "stretch",
        }}
      >
        <CashFlowSection
          trend={profile.cashFlowTrend}
          caption={profile.cashFlowCaption}
        />

        <AlertsPanel alerts={profile.alerts} />
      </section>

      <MetricsSection
        revenue={revenue}
        expenses={expenses}
        profit={profit}
        cash={cash}
        healthScore={profile.healthScore}
        healthLabel={profile.healthLabel}
      />

      <section
        style={{
          marginTop: 24,
          border: "1px solid rgba(245,158,11,0.14)",
          background: "rgba(255,255,255,0.030)",
          borderRadius: 24,
          padding: 18,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          Business context:{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>
            {displayValue(business?.name)}
          </strong>{" "}
          · {displayValue(business?.industry)} · {displayValue(business?.country)}
        </p>

        <Link href="/business" className="btn-ghost">
          Edit business profile
        </Link>
      </section>
    </>
  );
}