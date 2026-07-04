import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  getFinancialProfile,
  type FinancialProfile,
} from "@/lib/financial-profile";
import { HealthGauge } from "./components/HealthGauge";
import { StatCard } from "./components/StatCard";
import { CashFlowChart } from "./components/CashFlowChart";
import { AlertsPanel } from "./components/AlertsPanel";
import { ExecutivePanel } from "./components/ExecutivePanel";
import { MetricsPanel } from "./components/MetricsPanel";
import { AiTeamSection } from "./components/AiTeamSection";

function emptyDashboardProfile(): FinancialProfile {
  return {
    hasData: false,
    processedCount: 0,
    healthScore: 50,
    healthLabel: "Not enough data yet",
    revenue: {
      value: "-",
      delta: "Approve revenue documents to calculate this",
    },
    expenses: {
      value: "-",
      delta: "Approve expense documents to calculate this",
    },
    profit: {
      value: "-",
      delta: "Upload and approve documents to see this",
    },
    cash: {
      value: "-",
      delta: "Approve a bank statement to calculate cash",
    },
    cashFlowTrend: [],
    cashFlowCaption: "Not enough data yet",
    alerts: [
      {
        id: "empty-dashboard",
        severity: "info",
        message:
          "Upload and process financial documents to start building a real business dashboard.",
      },
    ],
    executiveSummary:
      "Not enough trusted financial data is available yet. Upload documents, review AI extraction, and approve them to generate executive-level insights.",
    recommendations: [
      {
        id: "upload-documents",
        priority: "high",
        title: "Upload core documents",
        action:
          "Start with one financial statement, one bank statement, and recent invoices so the AI can understand revenue, expenses, cash, and profit.",
      },
      {
        id: "approve-documents",
        priority: "medium",
        title: "Approve trusted data",
        action:
          "Only approved documents are used in the dashboard, AI team, and finance chat.",
      },
    ],
    metrics: [
      {
        id: "data-status",
        label: "Data status",
        value: "Pending",
        description:
          "Upload and approve documents to calculate real financial ratios.",
      },
    ],
  };
}

function getReadinessItems(profile: FinancialProfile) {
  return [
    {
      label: "Trusted documents",
      value: profile.processedCount > 0 ? `${profile.processedCount}` : "0",
      status: profile.processedCount > 0 ? "Ready" : "Missing",
      tone: profile.processedCount > 0 ? "good" : "warning",
    },
    {
      label: "Revenue visibility",
      value: profile.revenue.value !== "-" ? profile.revenue.value : "-",
      status: profile.revenue.value !== "-" ? "Ready" : "Needs data",
      tone: profile.revenue.value !== "-" ? "good" : "warning",
    },
    {
      label: "Cash visibility",
      value: profile.cash.value !== "-" ? profile.cash.value : "-",
      status: profile.cash.value !== "-" ? "Ready" : "Needs bank statement",
      tone: profile.cash.value !== "-" ? "good" : "warning",
    },
  ];
}

function getToneStyle(tone: "good" | "warning" | "danger" | "neutral") {
  if (tone === "good") {
    return {
      border: "1px solid rgba(46,213,115,0.25)",
      background: "rgba(46,213,115,0.08)",
      color: "#7bed9f",
    };
  }

  if (tone === "danger") {
    return {
      border: "1px solid rgba(255,71,87,0.25)",
      background: "rgba(255,71,87,0.08)",
      color: "#ff8a95",
    };
  }

  if (tone === "warning") {
    return {
      border: "1px solid rgba(255,193,7,0.25)",
      background: "rgba(255,193,7,0.08)",
      color: "#ffd166",
    };
  }

  return {
    border: "1px solid var(--color-border)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--color-text-secondary)",
  };
}

function DemoFlowSection() {
  const demoSteps = [
    {
      step: "01",
      title: "Upload documents",
      text: "Upload financial statements, bank statements, invoices, bills, or payroll files.",
      href: "/documents",
    },
    {
      step: "02",
      title: "Review AI extraction",
      text: "Check extracted numbers and approve only trusted financial data.",
      href: "/documents",
    },
    {
      step: "03",
      title: "Dashboard updates",
      text: "Approved data powers revenue, expenses, profit, cash, health score, and alerts.",
      href: "/dashboard",
    },
    {
      step: "04",
      title: "Ask AI finance team",
      text: "Use Overall Team or specialist agents to get decisions, risks, and next actions.",
      href: "/chat",
    },
  ];

  return (
    <section
      className="alerts-card"
      style={{
        marginBottom: 24,
        display: "grid",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 18,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p className="section-title">Demo flow</p>
          <p className="section-hint">
            Explain the platform in this order during presentation.
          </p>
        </div>

        <span className="badge-sample">Upload → Review → Dashboard → AI Team</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {demoSteps.map((item) => (
          <Link
            key={item.step}
            href={item.href}
            style={{
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 18,
              padding: 16,
              textDecoration: "none",
              display: "grid",
              gap: 8,
              minHeight: 150,
            }}
          >
            <span
              style={{
                color: "var(--color-amber)",
                fontSize: 12,
                fontWeight: 950,
                letterSpacing: "0.12em",
              }}
            >
              STEP {item.step}
            </span>

            <span
              style={{
                color: "var(--color-text-primary)",
                fontSize: 15,
                fontWeight: 900,
              }}
            >
              {item.title}
            </span>

            <span
              style={{
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {item.text}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  const profile = session?.user?.id
    ? await getFinancialProfile(session.user.id)
    : emptyDashboardProfile();

  const readinessItems = getReadinessItems(profile);

  const dashboardStatus = profile.hasData
    ? `Trusted data · ${profile.processedCount} processed document${
        profile.processedCount === 1 ? "" : "s"
      }`
    : "No trusted documents yet";

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Executive command center</p>
          <h1>Good to see you, {firstName}.</h1>
        </div>

        <span className="badge-sample">{dashboardStatus}</span>
      </header>

      <p className="page-intro">
        Your dashboard is built from processed financial documents. Review and
        approve AI extractions before trusting them in the dashboard, AI team,
        and finance chat.
      </p>

      <DemoFlowSection />

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.8fr)",
          gap: 18,
          marginBottom: 24,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "relative",
            minHeight: 220,
            border: "1px solid var(--color-border)",
            borderRadius: 22,
            padding: 22,
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 260,
              height: 260,
              borderRadius: "50%",
              background: "rgba(245,158,11,0.13)",
              filter: "blur(45px)",
              right: -90,
              top: -110,
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <p className="section-title">AI CFO overview</p>

            <p
              style={{
                margin: "12px 0 18px",
                color: "var(--color-text-primary)",
                fontSize: 28,
                lineHeight: 1.15,
                fontWeight: 900,
                letterSpacing: "-0.04em",
                maxWidth: 640,
              }}
            >
              {profile.hasData
                ? "Your trusted financial data is ready for decision-making."
                : "Start by building your trusted financial data layer."}
            </p>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 14,
                lineHeight: 1.7,
                maxWidth: 720,
              }}
            >
              {profile.hasData
                ? "Use this dashboard to understand revenue, expenses, profit, cash visibility, risk signals, and next actions."
                : "Upload documents, let AI extract the numbers, approve trusted data, and then your dashboard will become a real executive finance view."}
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 22,
              }}
            >
              <Link
                href="/documents"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  background: "var(--color-amber)",
                  color: "var(--color-base)",
                  borderRadius: 12,
                  padding: "11px 15px",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 850,
                }}
              >
                Review documents
              </Link>

              <Link
                href="/chat"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid var(--color-border)",
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--color-text-primary)",
                  borderRadius: 12,
                  padding: "11px 15px",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 850,
                }}
              >
                Ask AI finance team
              </Link>
            </div>
          </div>
        </div>

        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: 22,
            padding: 18,
            background: "rgba(255,255,255,0.025)",
            display: "grid",
            gap: 12,
          }}
        >
          <div>
            <p className="section-title">Dashboard readiness</p>
            <p className="section-hint">
              What the AI can confidently use right now.
            </p>
          </div>

          {readinessItems.map((item) => {
            const style = getToneStyle(
              item.tone === "good" ? "good" : "warning",
            );

            return (
              <div
                key={item.label}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: 16,
                  padding: 13,
                  background: "rgba(255,255,255,0.03)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  <p
                    style={{
                      margin: "0 0 5px",
                      color: "var(--color-text-primary)",
                      fontSize: 13,
                      fontWeight: 850,
                    }}
                  >
                    {item.label}
                  </p>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--color-text-secondary)",
                      fontSize: 12,
                    }}
                  >
                    {item.value}
                  </p>
                </div>

                <span
                  style={{
                    ...style,
                    borderRadius: 999,
                    padding: "7px 10px",
                    fontSize: 12,
                    fontWeight: 850,
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.status}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section
        className="dashboard-top-grid"
        style={{
          marginBottom: 24,
        }}
      >
        <HealthGauge
          score={profile.healthScore}
          label={profile.healthLabel}
        />

        <div className="stat-grid">
          <StatCard
            label="Revenue"
            value={profile.revenue.value}
            delta={profile.revenue.delta}
            tone="positive"
          />

          <StatCard
            label="Expenses"
            value={profile.expenses.value}
            delta={profile.expenses.delta}
            tone="warning"
          />

          <StatCard
            label="Profit"
            value={profile.profit.value}
            delta={profile.profit.delta}
            tone={profile.profit.value.startsWith("-") ? "warning" : "positive"}
          />

          <StatCard
            label="Cash on hand"
            value={profile.cash.value}
            delta={profile.cash.delta}
            tone="neutral"
          />
        </div>
      </section>

      <section
        className="alerts-card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div>
          <p className="section-title">Ask your AI finance team</p>
          <p className="section-hint">
            Ask about losses, expense control, cash runway, missing documents,
            business risk, or what decision to take next.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/chat"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              background: "var(--color-amber)",
              color: "var(--color-base)",
              borderRadius: 12,
              padding: "10px 14px",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 900,
              whiteSpace: "nowrap",
            }}
          >
            Ask Overall Team
          </Link>

          <Link
            href="/chat?agent=cfo"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--color-text-primary)",
              borderRadius: 12,
              padding: "10px 13px",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 850,
              whiteSpace: "nowrap",
            }}
          >
            Ask CFO
          </Link>

          <Link
            href="/chat?agent=risk"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--color-text-primary)",
              borderRadius: 12,
              padding: "10px 13px",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 850,
              whiteSpace: "nowrap",
            }}
          >
            Ask Risk Agent
          </Link>
        </div>
      </section>

      {session?.user?.id && <AiTeamSection userId={session.user.id} />}

      <section
        style={{
          marginTop: 24,
          marginBottom: 24,
        }}
      >
        <ExecutivePanel
          summary={profile.executiveSummary}
          recommendations={profile.recommendations}
        />
      </section>

      <section
        className="dashboard-bottom-grid"
        style={{
          marginBottom: 24,
        }}
      >
        {profile.cashFlowTrend.length >= 2 ? (
          <CashFlowChart
            points={profile.cashFlowTrend}
            caption={profile.cashFlowCaption}
          />
        ) : (
          <div className="cashflow-card">
            <div className="cashflow-header">
              <div>
                <p className="section-title">Cash flow trend</p>
                <p className="section-hint">{profile.cashFlowCaption}</p>
              </div>
            </div>

            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: 14,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Upload and approve documents across multiple months to generate a
              proper cash flow trend. Bank statements will make this section
              much stronger.
            </p>

            <Link
              href="/documents"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                justifySelf: "start",
                border: "1px solid var(--color-border)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--color-text-primary)",
                borderRadius: 12,
                padding: "10px 13px",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 850,
                marginTop: 16,
              }}
            >
              Upload bank statement
            </Link>
          </div>
        )}

        <AlertsPanel alerts={profile.alerts} />
      </section>

      <MetricsPanel metrics={profile.metrics} />

      <section
        className="alerts-card"
        style={{
          marginTop: 24,
          display: "grid",
          gap: 14,
        }}
      >
        <div>
          <p className="section-title">Suggested questions</p>
          <p className="section-hint">
            Use these questions to show that the dashboard connects with the AI
            finance team.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 12,
          }}
        >
          {[
            {
              href: "/chat",
              title: "Give me an overall summary of my business.",
              desc: "Overall finance team combines all agent views.",
            },
            {
              href: "/chat?agent=cfo",
              title: "Why is my profit margin low?",
              desc: "CFO-level explanation based on approved numbers.",
            },
            {
              href: "/chat?agent=analyst",
              title: "Which financial ratio needs attention?",
              desc: "Analyst view of margins, coverage, and risk.",
            },
            {
              href: "/chat?agent=cashflow",
              title: "Can I calculate cash runway?",
              desc: "Cash agent checks if enough bank data exists.",
            },
            {
              href: "/chat?agent=risk",
              title: "What is the biggest financial risk?",
              desc: "Risk agent surfaces warnings and missing data.",
            },
          ].map((question) => (
            <Link
              key={question.title}
              href={question.href}
              style={{
                border: "1px solid var(--color-border)",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 16,
                padding: 15,
                textDecoration: "none",
                display: "grid",
                gap: 7,
              }}
            >
              <span
                style={{
                  color: "var(--color-text-primary)",
                  fontSize: 14,
                  fontWeight: 850,
                  lineHeight: 1.35,
                }}
              >
                {question.title}
              </span>

              <span
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                {question.desc}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}