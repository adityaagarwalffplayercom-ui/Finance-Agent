import { prisma } from "./prisma";
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
};

function emptyProfile(): FinancialProfile {
  return {
    hasData: false,
    processedCount: 0,
    healthScore: 50,
    healthLabel: "Not enough data yet",
    revenue: { value: "-", delta: "No revenue documents processed yet" },
    expenses: { value: "-", delta: "No expense documents processed yet" },
    profit: { value: "-", delta: "Upload and process documents to see this" },
    cash: { value: "-", delta: "Upload a bank statement to see this" },
    cashFlowTrend: [],
    cashFlowCaption: "Not enough data yet",
    alerts: [
      {
        id: "empty",
        severity: "info",
        message: "Process your uploaded documents to start building a real financial picture.",
      },
    ],
    executiveSummary:
      "Not enough financial data is available yet. Upload and process documents to generate executive-level insights.",
    recommendations: [
      {
        id: "upload-documents",
        priority: "high",
        title: "Upload financial documents",
        action:
          "Upload bank statements, invoices, bills, payroll, or financial statements so the AI can build your financial profile.",
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

function growthDelta(label: string, growthPct: number | null) {
  if (growthPct === null) return `From processed ${label} documents`;

  if (growthPct > 0) {
    return `Up ${growthPct.toFixed(2)}% vs previous period`;
  }

  if (growthPct < 0) {
    return `Down ${Math.abs(growthPct).toFixed(2)}% vs previous period`;
  }

  return "No change vs previous period";
}

function buildDashboardAlerts(
  intelligence: ReturnType<typeof buildFinancialIntelligence>,
): Alert[] {
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
      message: "Everything looks steady based on what's been processed so far.",
    });
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts.slice(0, 5);
}

function buildExecutiveRecommendations(
  intelligence: ReturnType<typeof buildFinancialIntelligence>,
): ExecutiveRecommendation[] {
  return intelligence.recommendations.slice(0, 5).map((recommendation) => ({
    id: recommendation.id,
    priority: recommendation.priority,
    title: recommendation.title,
    action: recommendation.action,
  }));
}

export async function getFinancialProfile(userId: string): Promise<FinancialProfile> {
  const business = await prisma.business.findUnique({
    where: { userId },
    select: { currency: true },
  });

  const rawDocuments = await prisma.document.findMany({
    where: {
      userId,
      status: "PROCESSED",
    },
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
          : "Upload a bank statement to see this",
    },

    cashFlowTrend,

    cashFlowCaption:
      intelligence.trends.monthly.length >= 2
        ? "Net monthly activity from your processed documents"
        : "Process documents across more than one month to see a trend",

    alerts: buildDashboardAlerts(intelligence),

    executiveSummary: intelligence.executiveSummary,

    recommendations: buildExecutiveRecommendations(intelligence),
  };
}