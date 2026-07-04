import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getFinancialProfile } from "@/lib/financial-profile";
import { HealthGauge } from "./components/HealthGauge";
import { StatCard } from "./components/StatCard";
import { CashFlowChart } from "./components/CashFlowChart";
import { AlertsPanel } from "./components/AlertsPanel";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const profile = session?.user
    ? await getFinancialProfile(session.user.id)
    : {
        hasData: false,
        processedCount: 0,
        healthScore: 50,
        healthLabel: "Not enough data yet",
        revenue: { value: "—", delta: "" },
        expenses: { value: "—", delta: "" },
        profit: { value: "—", delta: "" },
        cash: { value: "—", delta: "" },
        cashFlowTrend: [] as number[],
        cashFlowCaption: "Not enough data yet",
        alerts: [],
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
            ? `Live data — based on ${profile.processedCount} processed document${
                profile.processedCount === 1 ? "" : "s"
              }`
            : "No documents processed yet — process an uploaded document to see your real numbers"}
        </span>
      </header>
      <section className="dashboard-top-grid">
        <HealthGauge score={profile.healthScore} label={profile.healthLabel} />
        <div className="stat-grid">
          <StatCard label="Revenue" value={profile.revenue.value} delta={profile.revenue.delta} tone="positive" />
          <StatCard label="Expenses" value={profile.expenses.value} delta={profile.expenses.delta} tone="warning" />
          <StatCard label="Profit" value={profile.profit.value} delta={profile.profit.delta} tone="warning" />
          <StatCard label="Cash on hand" value={profile.cash.value} delta={profile.cash.delta} tone="warning" />
        </div>
      </section>
      <section className="dashboard-bottom-grid">
        {profile.cashFlowTrend.length >= 2 ? (
          <CashFlowChart points={profile.cashFlowTrend} caption={profile.cashFlowCaption} />
        ) : (
          <div className="cashflow-card">
            <p className="section-title">Cash flow trend</p>
            <p className="section-hint">{profile.cashFlowCaption}</p>
          </div>
        )}
        <AlertsPanel alerts={profile.alerts} />
      </section>
    </>
  );
}
