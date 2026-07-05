import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFinancialProfile } from "@/lib/financial-profile";

type Tone = "sage" | "amber" | "gold" | "danger" | "neutral";

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

function formatBusinessLine({
  name,
  industry,
  country,
}: {
  name?: string | null;
  industry?: string | null;
  country?: string | null;
}) {
  const businessName = displayValue(name);
  const businessIndustry = displayValue(industry);
  const businessCountry = displayValue(country);

  if (
    businessName === "Not set" &&
    businessIndustry === "Not set" &&
    businessCountry === "Not set"
  ) {
    return "Connect business profile";
  }

  return `${businessName} · ${businessIndustry} · ${businessCountry}`;
}

function StatCard({
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
        minHeight: 132,
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
          fontSize: 34,
          lineHeight: 1,
          fontWeight: 950,
          letterSpacing: "-0.05em",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </strong>

      <p
        style={{
          margin: 0,
          color: toneStyle.color,
          fontSize: 12,
          lineHeight: 1.45,
          fontWeight: 750,
          overflowWrap: "anywhere",
        }}
      >
        {hint}
      </p>
    </article>
  );
}

function WorkflowCard({
  icon,
  title,
  hint,
}: {
  icon: string;
  title: string;
  hint: string;
}) {
  return (
    <article
      style={{
        border: "1px solid rgba(245,158,11,0.14)",
        background:
          "linear-gradient(135deg, rgba(245,158,11,0.060), rgba(255,255,255,0.024))",
        borderRadius: 20,
        padding: 16,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        minWidth: 0,
        minHeight: 116,
        overflow: "hidden",
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 15,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(245,158,11,0.11)",
          border: "1px solid rgba(245,158,11,0.24)",
          fontSize: 17,
          flex: "0 0 auto",
        }}
      >
        {icon}
      </span>

      <span
        style={{
          display: "grid",
          gap: 6,
          minWidth: 0,
        }}
      >
        <strong
          style={{
            color: "var(--color-text-primary)",
            fontSize: 14,
            lineHeight: 1.25,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </strong>

        <span
          style={{
            color: "var(--color-text-secondary)",
            fontSize: 12,
            lineHeight: 1.55,
            overflowWrap: "anywhere",
          }}
        >
          {hint}
        </span>
      </span>
    </article>
  );
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
        minHeight: 330,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 16,
        minWidth: 0,
        boxShadow:
          "0 18px 60px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.052)",
        overflow: "hidden",
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
              <h2
                style={{
                  margin: 0,
                  color: "var(--color-text-primary)",
                  fontSize: 20,
                  lineHeight: 1.15,
                  fontWeight: 950,
                  letterSpacing: "-0.04em",
                  overflowWrap: "break-word",
                }}
              >
                {agent.name}
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontSize: 13,
                  lineHeight: 1.45,
                  fontWeight: 700,
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

function buildAgents({
  healthScore,
  approvedDocuments,
  pendingReview,
  revenue,
  profit,
  cash,
}: {
  healthScore: number;
  approvedDocuments: number;
  pendingReview: number;
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
          ? `Health score is ${healthScore}/100. Ask for growth priorities, expense control, runway, and strategic next steps.`
          : "Upload and approve documents so the CFO Agent can analyze health score, profitability, and business risk.",
      tone: "sage",
    },
    {
      id: "accountant",
      icon: "🧾",
      name: "Accountant Agent",
      role: "Books and document control",
      insight:
        pendingReview > 0
          ? `${pendingReview} processed document(s) still need review before they can be trusted by dashboard and AI.`
          : `${approvedDocuments} approved document(s) are currently being used as trusted financial data.`,
      tone: pendingReview > 0 ? "gold" : "sage",
    },
    {
      id: "analyst",
      icon: "📈",
      name: "Financial Analyst Agent",
      role: "Margins, ratios, and trend analysis",
      insight:
        profit !== "Not available"
          ? `Profit signal is ${profit}. Ask this agent to explain margins, expense ratio, revenue coverage, and trend quality.`
          : "Profit margin is not available yet. Approve income and expense documents for better ratio analysis.",
      tone: "amber",
    },
    {
      id: "cashflow",
      icon: "💧",
      name: "Cash Flow Agent",
      role: "Cash runway and liquidity monitor",
      insight:
        cash !== "Not available"
          ? `Latest cash signal is ${cash}. Ask about runway, burn rate, and cash flow gaps.`
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
        revenue !== "Not available"
          ? "Revenue data is available. Ask this agent to check concentration risk, document gaps, and financial red flags."
          : "Revenue data is missing. Upload or approve a sales invoice, bank statement, or financial statement containing revenue.",
      tone: revenue !== "Not available" ? "sage" : "gold",
    },
  ];
}

export default async function AiTeamPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [business, approvedDocuments, pendingReview, rejectedDocuments, profile] =
    await Promise.all([
      prisma.business.findUnique({
        where: {
          userId: session.user.id,
        },
        select: {
          name: true,
          industry: true,
          businessType: true,
          country: true,
          currency: true,
          financialYear: true,
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
      getFinancialProfile(session.user.id),
    ]);

  const revenue =
    profile.revenue.value === "—" ? "Not available" : profile.revenue.value;

  const profit =
    profile.profit.value === "—" ? "Not available" : profile.profit.value;

  const cash = profile.cash.value === "—" ? "Not available" : profile.cash.value;

  const businessLine = formatBusinessLine({
    name: business?.name,
    industry: business?.industry,
    country: business?.country,
  });

  const agents = buildAgents({
    healthScore: profile.healthScore,
    approvedDocuments,
    pendingReview,
    revenue,
    profit,
    cash,
  });

  return (
    <>
      <style>
        {`
          @media (max-width: 1280px) {
            .ai-team-hero-grid {
              grid-template-columns: 1fr !important;
            }

            .ai-team-coverage-card {
              max-width: 100% !important;
              justify-self: stretch !important;
            }
          }

          @media (max-width: 760px) {
            .ai-team-page-title {
              font-size: 34px !important;
              line-height: 1.05 !important;
              letter-spacing: -0.055em !important;
            }

            .ai-team-agent-grid {
              grid-template-columns: 1fr !important;
            }

            .ai-team-stat-grid {
              grid-template-columns: 1fr !important;
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
          display: "grid",
          gap: 20,
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <div
          className="ai-team-hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)",
            gap: 20,
            alignItems: "stretch",
            width: "100%",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 14,
              minWidth: 0,
              alignContent: "start",
            }}
          >
            <p className="eyebrow" style={{ margin: 0 }}>
              AI finance team
            </p>

            <h1
              className="ai-team-page-title"
              style={{
                margin: 0,
                color: "var(--color-text-primary)",
                fontSize: "clamp(36px, 5vw, 72px)",
                lineHeight: 0.98,
                letterSpacing: "-0.075em",
                maxWidth: 760,
                overflowWrap: "anywhere",
              }}
            >
              Your executive finance agents are ready.
            </h1>

            <p
              className="page-intro"
              style={{
                margin: 0,
                lineHeight: 1.7,
                maxWidth: 760,
              }}
            >
              Each agent uses your business profile and approved financial
              documents. Pending and rejected data stay out of dashboard, chat,
              and recommendations.
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 6,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  border: "1px solid rgba(245,158,11,0.26)",
                  background: "rgba(245,158,11,0.09)",
                  color: "var(--color-gold)",
                  borderRadius: 999,
                  padding: "10px 14px",
                  fontSize: 12,
                  fontWeight: 900,
                  maxWidth: "100%",
                  overflowWrap: "anywhere",
                }}
              >
                {businessLine}
              </span>

              <span
                style={{
                  border: "1px solid rgba(46,213,115,0.26)",
                  background: "rgba(46,213,115,0.085)",
                  color: "var(--color-sage)",
                  borderRadius: 999,
                  padding: "10px 14px",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {approvedDocuments} trusted document
                {approvedDocuments === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <aside
            className="ai-team-coverage-card"
            style={{
              border: "1px solid rgba(245,158,11,0.14)",
              background:
                "linear-gradient(135deg, rgba(0,0,0,0.16), rgba(255,255,255,0.025))",
              borderRadius: 24,
              padding: 18,
              display: "grid",
              gap: 12,
              alignContent: "start",
              width: "100%",
              minWidth: 0,
              maxWidth: 360,
              justifySelf: "end",
              overflow: "hidden",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 12,
                fontWeight: 950,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                overflowWrap: "anywhere",
              }}
            >
              Agent coverage
            </p>

            <div
              style={{
                display: "grid",
                gap: 10,
                minWidth: 0,
              }}
            >
              <WorkflowCard
                icon="✅"
                title="Trusted data only"
                hint="Agents use approved documents, not pending or rejected files."
              />

              <WorkflowCard
                icon="💬"
                title="Ask role-based questions"
                hint="CFO, accountant, analyst, cash flow, consultant, and risk agents."
              />
            </div>
          </aside>
        </div>
      </header>

      <section
        className="ai-team-stat-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 14,
          alignItems: "stretch",
          marginBottom: 24,
        }}
      >
        <StatCard
          label="Trusted docs"
          value={approvedDocuments}
          hint="Used by dashboard, reports, and AI"
          tone="sage"
        />

        <StatCard
          label="Pending review"
          value={pendingReview}
          hint="Processed but not trusted yet"
          tone={pendingReview > 0 ? "gold" : "sage"}
        />

        <StatCard
          label="Rejected"
          value={rejectedDocuments}
          hint="Excluded from finance intelligence"
          tone={rejectedDocuments > 0 ? "danger" : "neutral"}
        />

        <StatCard
          label="Health score"
          value={`${profile.healthScore}/100`}
          hint={profile.healthLabel}
          tone={profile.healthScore >= 70 ? "sage" : "gold"}
        />
      </section>

      <section
        className="section-card"
        style={{
          display: "grid",
          gap: 18,
          padding: 22,
          overflow: "hidden",
          minWidth: 0,
        }}
      >
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
            <p className="section-title" style={{ margin: 0 }}>
              Specialist agents
            </p>

            <p
              className="section-hint"
              style={{
                margin: 0,
                lineHeight: 1.55,
              }}
            >
              Pick the right finance agent for the question you want to ask.
            </p>
          </div>

          <Link href="/chat" className="btn-ghost">
            Open full AI chat
          </Link>
        </div>

        <div
          className="ai-team-agent-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 18,
            alignItems: "stretch",
            minWidth: 0,
          }}
        >
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </section>
    </>
  );
}