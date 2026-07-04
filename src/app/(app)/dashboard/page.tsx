import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getFinancialProfile } from "@/lib/financial-profile";
import { HealthGauge } from "./components/HealthGauge";
import { StatCard } from "./components/StatCard";
import { CashFlowChart } from "./components/CashFlowChart";
import { AlertsPanel } from "./components/AlertsPanel";
import { ExecutivePanel } from "./components/ExecutivePanel";
import { MetricsPanel } from "./components/MetricsPanel";
import { AiTeamSection } from "./components/AiTeamSection";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  const profile = session?.user
    ? await getFinancialProfile(session.user.id)
    : {
        hasData: false,
        processedCount: 0,
        healthScore: 50,
        healthLabel: "Not enough trusted data yet",
        revenue: {
          value: "-",
          delta: "",
        },
        expenses: {
          value: "-",
          delta: "",
        },
        profit: {
          value: "-",
          delta: "",
        },
        cash: {
          value: "-",
          delta: "",
        },
        cashFlowTrend: [] as number[],
        cashFlowCaption: "Not enough trusted data yet",
        alerts: [],
        executiveSummary:
          "Not enough approved financial data is available yet. Upload, process, and approve documents to generate executive-level insights.",
        recommendations: [],
        metrics: [],
      };

  const profitTone =
    profile.profit.value.trim().startsWith("-") ||
    profile.profit.delta.toLowerCase().includes("loss")
      ? "warning"
      : "positive";

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Business overview</p>
          <h1>Good to see you, {firstName}.</h1>
        </div>

        <span className="badge-sample">
          {profile.hasData
            ? `Trusted data · ${profile.processedCount} approved document${
                profile.processedCount === 1 ? "" : "s"
              }`
            : "No trusted documents yet"}
        </span>
      </header>

      <p className="page-intro">
        {profile.hasData
          ? "Your dashboard is based only on approved AI extractions. Pending and rejected documents are excluded from financial analysis."
          : "Upload documents, process them with AI, then approve the extraction to build a trusted financial dashboard."}
      </p>

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
            Turn trusted numbers into decisions. Ask about losses, expenses,
            cash flow, risks, hiring, or missing documents.
          </p>
        </div>

        <Link
          href="/chat"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "var(--color-amber)",
            color: "var(--color-base)",
            borderRadius: 8,
            padding: "11px 16px",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          Ask AI
        </Link>
      </section>

      {session?.user?.id && <AiTeamSection userId={session.user.id} />}

      <section className="dashboard-top-grid">
        <HealthGauge score={profile.healthScore} label={profile.healthLabel} />

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
            tone={profitTone}
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
        style={{
          marginBottom: 24,
        }}
      >
        <ExecutivePanel
          summary={profile.executiveSummary}
          recommendations={profile.recommendations}
        />
      </section>

      <section className="dashboard-bottom-grid">
        {profile.cashFlowTrend.length >= 2 ? (
          <CashFlowChart
            points={profile.cashFlowTrend}
            caption={profile.cashFlowCaption}
          />
        ) : (
          <div className="cashflow-card">
            <div className="cashflow-header">
              <p className="section-title">Cash flow trend</p>
              <p className="section-hint">{profile.cashFlowCaption}</p>
            </div>

            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: 14,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Approve documents across multiple months to generate a proper cash
              flow trend.
            </p>
          </div>
        )}

        <AlertsPanel alerts={profile.alerts} />
      </section>

      <section
        style={{
          marginTop: 24,
        }}
      >
        <MetricsPanel metrics={profile.metrics} />
      </section>
    </>
  );
}