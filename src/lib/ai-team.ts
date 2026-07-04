import { prisma } from "./prisma";
import type { ExtractedDocumentData } from "./gemini";
import {
  buildFinancialIntelligence,
  formatMoney,
  type IntelligenceDocument,
} from "./financial-intelligence";

export type AiAgentStatus = "active" | "waiting" | "warning" | "critical";

export type AiAgent = {
  id: string;
  name: string;
  title: string;
  status: AiAgentStatus;
  statusLabel: string;
  summary: string;
  focusAreas: string[];
  currentFindings: string[];
  recommendedActions: string[];
  confidenceLabel: string;
};

export type AiTeamOverview = {
  businessName: string;
  trustedDocuments: number;
  pendingReview: number;
  rejectedDocuments: number;
  processedDocuments: number;
  totalDocuments: number;
  agents: AiAgent[];
};

function formatPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  return `${value.toFixed(2)}%`;
}

function cleanActions(actions: string[]) {
  return actions.filter(Boolean).slice(0, 4);
}

function waitingAgent(params: {
  id: string;
  name: string;
  title: string;
  summary: string;
  focusAreas: string[];
}): AiAgent {
  return {
    id: params.id,
    name: params.name,
    title: params.title,
    status: "waiting",
    statusLabel: "Waiting for trusted data",
    summary: params.summary,
    focusAreas: params.focusAreas,
    currentFindings: [
      "No approved financial documents are available for this agent yet.",
      "Upload documents, process them with AI, then approve the extraction.",
    ],
    recommendedActions: [
      "Upload a financial statement, bank statement, invoices, bills, or payroll file.",
      "Open the document details page and approve the AI extraction after review.",
    ],
    confidenceLabel: "Low confidence until approved data is available",
  };
}

function buildWaitingAgents(): AiAgent[] {
  return [
    waitingAgent({
      id: "cfo",
      name: "CFO Agent",
      title: "Executive finance decision maker",
      summary:
        "Monitors overall financial health, business risk, profitability, and strategic priorities.",
      focusAreas: [
        "Health score",
        "Profitability",
        "Financial risk",
        "Decision support",
      ],
    }),
    waitingAgent({
      id: "accountant",
      name: "Accountant Agent",
      title: "Books and document control",
      summary:
        "Checks whether financial documents are processed, reviewed, and reliable enough for reporting.",
      focusAreas: [
        "Document review",
        "Data completeness",
        "Transaction quality",
        "Record hygiene",
      ],
    }),
    waitingAgent({
      id: "analyst",
      name: "Financial Analyst Agent",
      title: "Margins, ratios, and trend analysis",
      summary:
        "Analyzes revenue, expenses, margins, ratios, and financial trends from trusted data.",
      focusAreas: [
        "Profit margin",
        "Expense ratio",
        "Revenue coverage",
        "Trend analysis",
      ],
    }),
    waitingAgent({
      id: "cashflow",
      name: "Cash Flow Agent",
      title: "Cash runway and liquidity monitor",
      summary:
        "Tracks cash position, burn rate, runway, and short-term liquidity risks.",
      focusAreas: ["Cash balance", "Burn rate", "Runway", "Liquidity risk"],
    }),
    waitingAgent({
      id: "consultant",
      name: "Business Consultant Agent",
      title: "Growth and cost-control advisor",
      summary:
        "Suggests practical business actions for growth, cost control, and operating improvement.",
      focusAreas: [
        "Cost reduction",
        "Revenue improvement",
        "Pricing decisions",
        "Operational actions",
      ],
    }),
    waitingAgent({
      id: "risk",
      name: "Risk & Compliance Agent",
      title: "Financial risk guardrail",
      summary:
        "Flags missing data, rejected extractions, high-risk signals, and areas that need human verification.",
      focusAreas: [
        "Rejected documents",
        "Pending reviews",
        "Risk warnings",
        "Verification needs",
      ],
    }),
  ];
}

export async function getAiTeam(userId: string): Promise<AiTeamOverview> {
  const [business, allDocuments, trustedRawDocuments] = await Promise.all([
    prisma.business.findUnique({
      where: {
        userId,
      },
      select: {
        name: true,
        currency: true,
      },
    }),

    prisma.document.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        status: true,
        reviewStatus: true,
      },
    }),

    prisma.document.findMany({
      where: {
        userId,
        status: "PROCESSED",
        reviewStatus: "APPROVED",
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
    }),
  ]);

  const trustedDocuments: IntelligenceDocument[] = trustedRawDocuments.map(
    (doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      category: doc.category,
      extractedData: doc.extractedData as ExtractedDocumentData | null,
      uploadedAt: doc.uploadedAt,
    }),
  );

  const totalDocuments = allDocuments.length;
  const processedDocuments = allDocuments.filter(
    (doc) => doc.status === "PROCESSED",
  ).length;
  const pendingReview = allDocuments.filter(
    (doc) => doc.reviewStatus === "NEEDS_REVIEW",
  ).length;
  const rejectedDocuments = allDocuments.filter(
    (doc) => doc.reviewStatus === "REJECTED",
  ).length;

  if (trustedDocuments.length === 0) {
    return {
      businessName: business?.name ?? "Your business",
      trustedDocuments: 0,
      pendingReview,
      rejectedDocuments,
      processedDocuments,
      totalDocuments,
      agents: buildWaitingAgents(),
    };
  }

  const intelligence = buildFinancialIntelligence(
    trustedDocuments,
    business?.currency ?? "INR",
  );

  const currency = intelligence.currency;
  const revenue = intelligence.totals.revenue;
  const expenses = intelligence.totals.expenses;
  const profit = intelligence.totals.profit;
  const cash = intelligence.totals.cash;
  const riskLevel = intelligence.risk.riskLevel;
  const healthScore = intelligence.risk.healthScore;

  const revenueCoverage =
    expenses > 0 ? Number(((revenue / expenses) * 100).toFixed(2)) : null;

  const cfoStatus: AiAgentStatus =
    riskLevel === "critical"
      ? "critical"
      : riskLevel === "high"
        ? "warning"
        : "active";

  const analystStatus: AiAgentStatus =
    profit < 0 || revenueCoverage !== null && revenueCoverage < 70
      ? "warning"
      : "active";

  const cashStatus: AiAgentStatus =
    intelligence.risk.cashRunwayDays !== null &&
    intelligence.risk.cashRunwayDays < 30
      ? "critical"
      : intelligence.risk.cashRunwayDays !== null &&
          intelligence.risk.cashRunwayDays < 90
        ? "warning"
        : "active";

  const riskStatus: AiAgentStatus =
    rejectedDocuments > 0 || pendingReview > 0 ? "warning" : "active";

  const topRecommendations = intelligence.recommendations.map(
    (item) => `${item.title}: ${item.action}`,
  );

  const topAlerts = intelligence.alerts.map(
    (item) => `${item.title}: ${item.message}`,
  );

  const agents: AiAgent[] = [
    {
      id: "cfo",
      name: "CFO Agent",
      title: "Executive finance decision maker",
      status: cfoStatus,
      statusLabel:
        cfoStatus === "active"
          ? "Monitoring business health"
          : cfoStatus === "warning"
            ? "Needs management attention"
            : "Critical action needed",
      summary:
        "Tracks overall financial health, profit position, and the most important executive decisions.",
      focusAreas: [
        "Health score",
        "Profitability",
        "Financial risk",
        "Executive priorities",
      ],
      currentFindings: [
        `Health score is ${healthScore}/100.`,
        `Current risk level is ${riskLevel.toUpperCase()}.`,
        `Revenue is ${formatMoney(revenue, currency)} and expenses are ${formatMoney(
          expenses,
          currency,
        )}.`,
        profit >= 0
          ? `The business is profitable by ${formatMoney(profit, currency)}.`
          : `The business is running a loss of ${formatMoney(
              Math.abs(profit),
              currency,
            )}.`,
      ],
      recommendedActions: cleanActions(topRecommendations),
      confidenceLabel: `Based on ${trustedDocuments.length} approved document${
        trustedDocuments.length === 1 ? "" : "s"
      }`,
    },
    {
      id: "accountant",
      name: "Accountant Agent",
      title: "Books and document control",
      status: pendingReview > 0 ? "warning" : "active",
      statusLabel:
        pendingReview > 0
          ? "Documents need review"
          : "Trusted document set is clean",
      summary:
        "Checks whether the financial data used by the product is reviewed, approved, and reliable.",
      focusAreas: [
        "Document review",
        "Approval status",
        "Rejected extractions",
        "Data completeness",
      ],
      currentFindings: [
        `${trustedDocuments.length} approved document${
          trustedDocuments.length === 1 ? "" : "s"
        } are being used as trusted data.`,
        `${pendingReview} document${pendingReview === 1 ? "" : "s"} still need review.`,
        `${rejectedDocuments} document${
          rejectedDocuments === 1 ? "" : "s"
        } have been rejected.`,
        `${processedDocuments} document${
          processedDocuments === 1 ? "" : "s"
        } have been processed by AI.`,
      ],
      recommendedActions: cleanActions([
        pendingReview > 0
          ? "Review pending AI extractions and approve only the correct ones."
          : "Continue reviewing every new AI extraction before trusting it.",
        rejectedDocuments > 0
          ? "Re-upload clearer files for rejected documents or correct the extraction later."
          : "Keep rejected documents at zero by reviewing extraction quality carefully.",
        "Upload missing bank statements, invoices, payroll, and bills to improve completeness.",
      ]),
      confidenceLabel: "High confidence only for approved documents",
    },
    {
      id: "analyst",
      name: "Financial Analyst Agent",
      title: "Margins, ratios, and trend analysis",
      status: analystStatus,
      statusLabel:
        analystStatus === "active"
          ? "Analyzing performance"
          : "Performance needs attention",
      summary:
        "Analyzes margins, expense ratios, revenue coverage, and monthly financial movement.",
      focusAreas: [
        "Profit margin",
        "Expense ratio",
        "Revenue coverage",
        "Monthly trends",
      ],
      currentFindings: [
        `Profit margin is ${formatPct(intelligence.ratios.profitMarginPct)}.`,
        `Expense ratio is ${formatPct(intelligence.ratios.expenseRatioPct)}.`,
        `Revenue coverage is ${formatPct(revenueCoverage)}.`,
        intelligence.trends.latestMonthlyNet !== null
          ? `Latest monthly net movement is ${formatMoney(
              intelligence.trends.latestMonthlyNet,
              currency,
            )}.`
          : "More monthly data is needed for trend analysis.",
      ],
      recommendedActions: cleanActions([
        profit < 0
          ? "Find the biggest expense categories and reduce non-essential costs first."
          : "Protect margins by tracking expenses every month.",
        revenueCoverage !== null && revenueCoverage < 100
          ? "Increase revenue or reduce expenses until revenue fully covers monthly costs."
          : "Maintain revenue coverage above expenses.",
        "Upload documents across multiple months to improve trend accuracy.",
      ]),
      confidenceLabel: `Calculated from ${trustedDocuments.length} approved document${
        trustedDocuments.length === 1 ? "" : "s"
      }`,
    },
    {
      id: "cashflow",
      name: "Cash Flow Agent",
      title: "Cash runway and liquidity monitor",
      status: cashStatus,
      statusLabel:
        cashStatus === "critical"
          ? "Cash runway critical"
          : cashStatus === "warning"
            ? "Cash runway needs attention"
            : "Monitoring liquidity",
      summary:
        "Tracks cash position, burn rate, runway, and whether the business can survive short-term pressure.",
      focusAreas: ["Cash balance", "Burn rate", "Runway", "Liquidity risk"],
      currentFindings: [
        cash !== null
          ? `Latest cash signal is ${formatMoney(cash, currency)}.`
          : "No approved bank statement is available for exact cash balance.",
        intelligence.risk.monthlyBurnRate !== null
          ? `Monthly burn rate is around ${formatMoney(
              intelligence.risk.monthlyBurnRate,
              currency,
            )}.`
          : "Monthly burn rate is not available yet.",
        intelligence.risk.cashRunwayDays !== null
          ? `Estimated cash runway is ${intelligence.risk.cashRunwayDays} days.`
          : "Cash runway cannot be calculated without cash and burn data.",
      ],
      recommendedActions: cleanActions([
        cash === null
          ? "Approve a processed bank statement to calculate cash runway."
          : "Monitor bank statement uploads regularly.",
        intelligence.risk.cashRunwayDays !== null &&
        intelligence.risk.cashRunwayDays < 90
          ? "Delay large expenses and collect receivables faster to extend runway."
          : "Keep cash runway above 90 days.",
        "Upload monthly bank statements for better liquidity forecasting.",
      ]),
      confidenceLabel:
        cash !== null
          ? "Cash analysis available from approved data"
          : "Cash analysis limited until bank data is approved",
    },
    {
      id: "consultant",
      name: "Business Consultant Agent",
      title: "Growth and cost-control advisor",
      status: profit < 0 ? "warning" : "active",
      statusLabel:
        profit < 0 ? "Cost control recommended" : "Growth opportunities active",
      summary:
        "Turns financial signals into practical business actions around pricing, cost control, and growth.",
      focusAreas: [
        "Cost reduction",
        "Revenue improvement",
        "Pricing",
        "Operating actions",
      ],
      currentFindings: [
        profit < 0
          ? "The first priority should be reducing losses before aggressive growth."
          : "The business has room to plan growth actions based on current profitability.",
        expenses > revenue
          ? "Expenses are currently higher than revenue."
          : "Revenue currently covers expenses.",
        intelligence.recommendations[0]?.title ??
          "More data will improve business recommendations.",
      ],
      recommendedActions: cleanActions([
        ...topRecommendations,
        "Use the AI chat to ask scenario questions before making major decisions.",
      ]),
      confidenceLabel: "Recommendations improve as more documents are approved",
    },
    {
      id: "risk",
      name: "Risk & Compliance Agent",
      title: "Financial risk guardrail",
      status: riskStatus,
      statusLabel:
        riskStatus === "active"
          ? "No major trust issues"
          : "Review and verification needed",
      summary:
        "Flags trust gaps, missing approvals, rejected documents, and financial warning signals.",
      focusAreas: [
        "Pending reviews",
        "Rejected documents",
        "Financial alerts",
        "Human verification",
      ],
      currentFindings: cleanActions([
        ...topAlerts,
        pendingReview > 0
          ? `${pendingReview} document${
              pendingReview === 1 ? "" : "s"
            } still need human review.`
          : "No pending review documents are currently blocking trusted analysis.",
        rejectedDocuments > 0
          ? `${rejectedDocuments} rejected document${
              rejectedDocuments === 1 ? "" : "s"
            } are excluded from dashboard and chat.`
          : "No rejected documents are currently affecting the trust workflow.",
      ]),
      recommendedActions: cleanActions([
        pendingReview > 0
          ? "Review pending documents before relying on the dashboard."
          : "Keep reviewing new documents as soon as they are processed.",
        rejectedDocuments > 0
          ? "Replace rejected documents with clearer uploads."
          : "Continue using approval workflow before trusting AI extraction.",
        "Do not use AI output as final legal, tax, or audit advice without professional review.",
      ]),
      confidenceLabel: "Trust score depends on approval quality",
    },
  ];

  return {
    businessName: business?.name ?? "Your business",
    trustedDocuments: trustedDocuments.length,
    pendingReview,
    rejectedDocuments,
    processedDocuments,
    totalDocuments,
    agents,
  };
}