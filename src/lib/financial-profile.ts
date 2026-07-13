import { prisma } from "./prisma";
import { getActiveWorkspaceDataScope } from "./active-workspace-data";
import type { ExtractedDocumentData } from "./gemini";
import {
  buildFinancialIntelligence,
  formatMoney,
  type IntelligenceDocument,
} from "./financial-intelligence";

export type Alert = {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
};

export type StatBlock = {
  value: string;
  delta: string;
};

export type ExecutiveRecommendation = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  action: string;
};

export type FinancialMetric = {
  id: string;
  label: string;
  value: string;
  description: string;
};

export type FinancialProfile = {
  hasData: boolean;
  processedCount: number;
  healthScore: number;
  healthLabel: string;
  revenue: StatBlock;
  expenses: StatBlock;
  profit: StatBlock;
  cash: StatBlock;
  cashFlowTrend: number[];
  cashFlowCaption: string;
  alerts: Alert[];
  executiveSummary: string;
  recommendations: ExecutiveRecommendation[];
  metrics: FinancialMetric[];
};

type FinancialIntelligence = ReturnType<typeof buildFinancialIntelligence>;

function emptyProfile(): FinancialProfile {
  return {
    hasData: false,
    processedCount: 0,
    healthScore: 50,
    healthLabel: "Not enough trusted data yet",
    revenue: {
      value: "-",
      delta: "No approved revenue documents yet",
    },
    expenses: {
      value: "-",
      delta: "No approved expense documents yet",
    },
    profit: {
      value: "-",
      delta: "Approve reviewed documents to see this",
    },
    cash: {
      value: "-",
      delta: "Approve a processed bank statement to see this",
    },
    cashFlowTrend: [],
    cashFlowCaption: "Not enough approved data yet",
    alerts: [
      {
        id: "empty",
        severity: "info",
        message:
          "Approve reviewed AI extractions to start building a trusted financial picture.",
      },
    ],
    executiveSummary:
      "Not enough approved financial data is available yet. Upload, process, and approve documents to generate executive-level insights.",
    recommendations: [
      {
        id: "approve-documents",
        priority: "high",
        title: "Approve reviewed financial documents",
        action:
          "Open processed documents, verify the AI extraction, and approve the documents that should be trusted for dashboard and AI analysis.",
      },
    ],
    metrics: [
      {
        id: "not-enough-data",
        label: "Trusted data status",
        value: "Pending approval",
        description:
          "Upload, process, and approve documents to calculate trusted financial metrics.",
      },
    ],
  };
}

function riskLabel(riskLevel: "low" | "medium" | "high" | "critical") {
  if (riskLevel === "low") return "Healthy";
  if (riskLevel === "medium") return "Needs monitoring";
  if (riskLevel === "high") return "High financial risk";

  return "Critical risk - act soon";
}

function formatPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";

  return `${value.toFixed(2)}%`;
}

function formatDays(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";

  return `${value} days`;
}

function growthDelta(label: string, growthPct: number | null) {
  if (growthPct === null) {
    return `From approved ${label} documents`;
  }

  if (growthPct > 0) {
    return `Up ${growthPct.toFixed(2)}% vs previous period`;
  }

  if (growthPct < 0) {
    return `Down ${Math.abs(growthPct).toFixed(2)}% vs previous period`;
  }

  return "No change vs previous period";
}

function buildDashboardAlerts(intelligence: FinancialIntelligence): Alert[] {
  const alerts: Alert[] = [];

  for (const alert of intelligence.alerts) {
    alerts.push({
      id: alert.id,
      severity: alert.severity,
      message: `${alert.title}: ${alert.message}`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "all-clear",
      severity: "info",
      message: "Everything looks steady based on approved documents so far.",
    });
  }

  const severityOrder = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts.slice(0, 5);
}

function buildExecutiveRecommendations(
  intelligence: FinancialIntelligence,
): ExecutiveRecommendation[] {
  return intelligence.recommendations.slice(0, 5).map((recommendation) => ({
    id: recommendation.id,
    priority: recommendation.priority,
    title: recommendation.title,
    action: recommendation.action,
  }));
}

function buildFinancialMetrics(intelligence: FinancialIntelligence) {
  const revenue = intelligence.totals.revenue;
  const expenses = intelligence.totals.expenses;
  const currency = intelligence.currency;

  const revenueCoveragePct =
    expenses > 0 ? Number(((revenue / expenses) * 100).toFixed(2)) : null;

  return [
    {
      id: "profit-margin",
      label: "Profit margin",
      value: formatPct(intelligence.ratios.profitMarginPct),
      description: "How much profit remains after expenses compared with revenue.",
    },
    {
      id: "expense-ratio",
      label: "Expense ratio",
      value: formatPct(intelligence.ratios.expenseRatioPct),
      description: "How much of revenue is consumed by expenses.",
    },
    {
      id: "revenue-coverage",
      label: "Revenue coverage",
      value: formatPct(revenueCoveragePct),
      description: "How much of your expenses are covered by revenue.",
    },
    {
      id: "risk-level",
      label: "Risk level",
      value: intelligence.risk.riskLevel.toUpperCase(),
      description:
        "Overall financial risk based on revenue, expenses, and cash signals.",
    },
    {
      id: "monthly-burn-rate",
      label: "Monthly burn",
      value:
        intelligence.risk.monthlyBurnRate !== null
          ? formatMoney(intelligence.risk.monthlyBurnRate, currency)
          : "-",
      description: "Average monthly negative cash movement from recent months.",
    },
    {
      id: "cash-runway",
      label: "Cash runway",
      value: formatDays(intelligence.risk.cashRunwayDays),
      description: "Estimated days before cash runs out at the current burn rate.",
    },
  ];
}

export async function getFinancialProfile(
  userId: string,
): Promise<FinancialProfile> {
  const { documentWhere, businessWhere } = await getActiveWorkspaceDataScope(userId);
  const business = await prisma.business.findFirst({
    where: businessWhere,
    select: {
      currency: true,
    },
  });

  const rawDocuments = await prisma.document.findMany({
    where: { AND: [documentWhere, { status: "PROCESSED", reviewStatus: "APPROVED" }] },
    select: {
      id: true,
      fileName: true,
      category: true,
      extractedData: true,
      uploadedAt: true,
    },
    orderBy: {
      uploadedAt: "asc",
    },
  });

  if (rawDocuments.length === 0) {
    return emptyProfile();
  }

  const documents: IntelligenceDocument[] = rawDocuments.map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    category: doc.category,
    extractedData: doc.extractedData as ExtractedDocumentData | null,
    uploadedAt: doc.uploadedAt,
  }));

  const intelligence = buildFinancialIntelligence(
    documents,
    business?.currency ?? "INR",
  );

  const currency = intelligence.currency;

  const cashFlowTrend = intelligence.trends.monthly.map((point) => {
    const value = point.net;

    if (Math.abs(value) >= 1_000_000) {
      return Math.round(value / 1_000_000);
    }

    return Math.round(value);
  });

  return {
    hasData: true,
    processedCount: documents.length,
    healthScore: intelligence.risk.healthScore,
    healthLabel: riskLabel(intelligence.risk.riskLevel),
    revenue: {
      value: formatMoney(intelligence.totals.revenue, currency),
      delta: growthDelta("revenue", intelligence.trends.revenueGrowthPct),
    },
    expenses: {
      value: formatMoney(intelligence.totals.expenses, currency),
      delta: growthDelta("expense", intelligence.trends.expenseGrowthPct),
    },
    profit: {
      value: formatMoney(intelligence.totals.profit, currency),
      delta:
        intelligence.totals.profit >= 0
          ? `Margin ${intelligence.ratios.profitMarginPct?.toFixed(2) ?? "0.00"}%`
          : "Running a loss so far",
    },
    cash: {
      value:
        intelligence.totals.cash !== null
          ? formatMoney(intelligence.totals.cash, currency)
          : "-",
      delta:
        intelligence.risk.cashRunwayDays !== null
          ? `Runway about ${intelligence.risk.cashRunwayDays} days`
          : "Approve a bank statement to see this",
    },
    cashFlowTrend,
    cashFlowCaption:
      intelligence.trends.monthly.length >= 2
        ? "Net monthly activity from approved documents"
        : "Approve documents across more than one month to see a trend",
    alerts: buildDashboardAlerts(intelligence),
    executiveSummary: intelligence.executiveSummary,
    recommendations: buildExecutiveRecommendations(intelligence),
    metrics: buildFinancialMetrics(intelligence),
  };
}