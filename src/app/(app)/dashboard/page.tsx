import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getFinancialProfile } from "@/lib/financial-profile";
import { HealthGauge } from "./components/HealthGauge";
import { StatCard } from "./components/StatCard";
import { CashFlowChart } from "./components/CashFlowChart";
import { AlertsPanel } from "./components/AlertsPanel";
import { ExecutivePanel } from "./components/ExecutivePanel";
import { MetricsPanel } from "./components/MetricsPanel";

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
        healthLabel: "Not enough data yet",
        revenue: { value: "-", delta: "" },
        expenses: { value: "-", delta: "" },
        profit: { value: "-", delta: "" },
        cash: { value: "-", delta: "" },
        cashFlowTrend: [] as number[],
        cashFlowCaption: "Not enough data yet",
        alerts: [],
        executiveSummary:
          "Not enough financial data is available yet. Upload and process documents to generate executive-level insights.",
        recommendations: [],
        metrics: [],
      };

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Business overview</p>
          <h1>Good to see you, {firstName}.</h1>
        </div>

        <span className="badge-sample">
          {profile.hasData
            ? `Live data - based on ${profile.processedCount} processed document${
                profile.processedCount === 1 ? "" : "s"
              }`
            : "No documents processed yet - process an uploaded document to see your real numbers"}
        </span>
      </header>

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
            tone={profile.profit.value.includes("-") ? "warning" : "positive"}
          />

          <StatCard
            label="Cash on hand"
            value={profile.cash.value}
            delta={profile.cash.delta}
            tone="neutral"
          />
        </div>
      </section>

      <MetricsPanel metrics={profile.metrics} />

      <section
        className="dashboard-bottom-grid"
        style={{
          marginTop: 28,
          marginBottom: 28,
          gap: 24,
          alignItems: "stretch",
        }}
      >
        {profile.cashFlowTrend.length >= 2 ? (
          <CashFlowChart
            points={profile.cashFlowTrend}
            caption={profile.cashFlowCaption}
          />
        ) : (
          <section className="cashflow-card">
            <div className="cashflow-header">
              <p className="section-title">Cash flow trend</p>
              <p className="section-hint">{profile.cashFlowCaption}</p>
            </div>

            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Upload documents across multiple months to generate a proper cash flow trend.
            </p>
          </section>
        )}

        <AlertsPanel alerts={profile.alerts} />
      </section>

      <div style={{ marginTop: 28 }}>
        <ExecutivePanel
          summary={profile.executiveSummary}
          recommendations={profile.recommendations}
        />
      </div>
    </>
  );
}