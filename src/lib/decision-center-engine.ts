import { prisma } from "@/lib/prisma";
import { getFinancialProfile } from "@/lib/financial-profile";

export type DecisionPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type DecisionCategory =
  | "CASH_FLOW"
  | "PROFIT"
  | "RISK"
  | "DOCUMENTS"
  | "TAX"
  | "ANOMALY"
  | "GROWTH";

export type DecisionAction = {
  id: string;
  priority: DecisionPriority;
  category: DecisionCategory;
  title: string;
  problem: string;
  action: string;
  expectedImpact: string;
  timeframe: "TODAY" | "THIS_WEEK" | "THIS_MONTH";
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

export type DecisionCenterReport = {
  generatedAt: string;
  currency: string;
  executiveSummary: string;
  ownerFocus: string;
  overallStatus: "STABLE" | "WATCH" | "URGENT" | "INSUFFICIENT_DATA";
  score: number;
  metrics: {
    revenue: number | null;
    expenses: number | null;
    profit: number | null;
    cash: number | null;
    profitMarginPercent: number | null;
    expenseRatioPercent: number | null;
    estimatedMonthlyBurn: number | null;
    estimatedRunwayMonths: number | null;
    approvedDocuments: number;
    processedDocuments: number;
    rejectedDocuments: number;
    failedDocuments: number;
    totalLineItems: number;
    suspiciousLineItems: number;
  };
  topActions: DecisionAction[];
  todayActions: DecisionAction[];
  weekActions: DecisionAction[];
  monthActions: DecisionAction[];
  decisionWarnings: string[];
  missingData: string[];
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const clean = value
    .replace(/,/g, "")
    .replace(/[₹$€£]/g, "")
    .replace(/Rs\./gi, "")
    .trim();

  if (!clean || clean === "—") {
    return null;
  }

  const isParenthesesNegative = /^\(.*\)$/.test(clean);
  const match = clean.match(/-?\d+(\.\d+)?/);

  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const lower = clean.toLowerCase();
  let multiplier = 1;

  if (lower.includes("crore") || lower.includes(" cr")) {
    multiplier = 10_000_000;
  } else if (lower.includes("lakh") || lower.includes(" lac")) {
    multiplier = 100_000;
  } else if (lower.includes("b")) {
    multiplier = 1_000_000_000;
  } else if (lower.includes("m")) {
    multiplier = 1_000_000;
  } else if (lower.includes("k")) {
    multiplier = 1_000;
  }

  const signed = isParenthesesNegative ? -Math.abs(parsed) : parsed;

  return signed * multiplier;
}

function parseMetricValue(value: string) {
  if (!value || value === "—" || value === "Not available") {
    return null;
  }

  return toNumber(value);
}

function compactNumber(value: number) {
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (absolute >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (absolute >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }

  return `${Math.round(value)}`;
}

function currencySymbol(currency: string) {
  const clean = currency.trim().toUpperCase();

  if (clean === "INR") return "Rs. ";
  if (clean === "USD" || currency.trim() === "$") return "$";
  if (clean === "GBP") return "GBP ";
  if (clean === "EUR") return "EUR ";

  return currency ? `${currency} ` : "";
}

function formatMoney(value: number | null, currency: string) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  const sign = value < 0 ? "-" : "";

  return `${sign}${currencySymbol(currency)}${compactNumber(Math.abs(value))}`;
}

function collectLineItemStats(value: unknown): {
  totalLineItems: number;
  suspiciousLineItems: number;
} {
  let totalLineItems = 0;
  let suspiciousLineItems = 0;

  function walk(input: unknown, depth = 0) {
    if (depth > 9) {
      return;
    }

    if (Array.isArray(input)) {
      for (const item of input) {
        walk(item, depth + 1);
      }

      return;
    }

    if (!isRecord(input)) {
      return;
    }

    const label = [
      input.description,
      input.particulars,
      input.name,
      input.label,
      input.item,
      input.account,
      input.category,
      input.vendor,
      input.customer,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const amount =
      toNumber(input.amount) ??
      toNumber(input.value) ??
      toNumber(input.total) ??
      toNumber(input.debit) ??
      toNumber(input.credit) ??
      toNumber(input.expense) ??
      toNumber(input.revenue);

    if (label && amount !== null && Math.abs(amount) > 0) {
      totalLineItems += 1;

      if (
        amount < 0 ||
        label.includes("loss") ||
        label.includes("penalty") ||
        label.includes("fine") ||
        label.includes("interest") ||
        label.includes("overdue") ||
        label.includes("write off") ||
        label.includes("bad debt") ||
        label.includes("impairment")
      ) {
        suspiciousLineItems += 1;
      }
    }

    for (const nestedValue of Object.values(input)) {
      if (Array.isArray(nestedValue) || isRecord(nestedValue)) {
        walk(nestedValue, depth + 1);
      }
    }
  }

  walk(value);

  return {
    totalLineItems,
    suspiciousLineItems,
  };
}

function priorityWeight(priority: DecisionPriority) {
  if (priority === "CRITICAL") return 4;
  if (priority === "HIGH") return 3;
  if (priority === "MEDIUM") return 2;
  return 1;
}

function uniqueActions(actions: DecisionAction[]) {
  const seen = new Set<string>();

  return actions.filter((action) => {
    const key = `${action.category}-${action.title}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function getDecisionCenterReport(
  userId: string,
): Promise<DecisionCenterReport> {
  const [profile, business, documents] = await Promise.all([
    getFinancialProfile(userId),
    prisma.business.findUnique({
      where: {
        userId,
      },
      select: {
        currency: true,
      },
    }),
    prisma.document.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        fileName: true,
        status: true,
        reviewStatus: true,
        category: true,
        extractedData: true,
      },
      orderBy: {
        uploadedAt: "desc",
      },
      take: 120,
    }),
  ]);

  const currency = business?.currency || "INR";

  const revenue = parseMetricValue(profile.revenue.value);
  const expenses = parseMetricValue(profile.expenses.value);
  let profit = parseMetricValue(profile.profit.value);
  const cash = parseMetricValue(profile.cash.value);

  if (profit === null && revenue !== null && expenses !== null) {
    profit = revenue - expenses;
  }

  const profitMarginPercent =
    revenue !== null && revenue > 0 && profit !== null
      ? (profit / revenue) * 100
      : null;

  const expenseRatioPercent =
    revenue !== null && revenue > 0 && expenses !== null
      ? (expenses / revenue) * 100
      : null;

  const monthlyProfit = profit !== null ? profit / 12 : null;
  const estimatedMonthlyBurn =
    monthlyProfit !== null && monthlyProfit < 0
      ? Math.abs(monthlyProfit)
      : expenses !== null
        ? expenses / 12
        : null;

  const estimatedRunwayMonths =
    cash !== null && estimatedMonthlyBurn !== null && estimatedMonthlyBurn > 0
      ? cash / estimatedMonthlyBurn
      : null;

  const approvedDocuments = documents.filter(
    (document) => String(document.reviewStatus) === "APPROVED",
  ).length;

  const rejectedDocuments = documents.filter(
    (document) => String(document.reviewStatus) === "REJECTED",
  ).length;

  const processedDocuments = documents.filter(
    (document) => String(document.status) === "PROCESSED",
  ).length;

  const failedDocuments = documents.filter(
    (document) => String(document.status) === "FAILED",
  ).length;

  const lineItemStats = documents.reduce(
    (total, document) => {
      const stats = collectLineItemStats(document.extractedData);

      return {
        totalLineItems: total.totalLineItems + stats.totalLineItems,
        suspiciousLineItems:
          total.suspiciousLineItems + stats.suspiciousLineItems,
      };
    },
    {
      totalLineItems: 0,
      suspiciousLineItems: 0,
    },
  );

  const missingData: string[] = [];

  if (revenue === null) {
    missingData.push("Revenue data is missing or not trusted yet.");
  }

  if (expenses === null) {
    missingData.push("Expense data is missing or not trusted yet.");
  }

  if (cash === null) {
    missingData.push("Cash or bank balance data is missing.");
  }

  if (approvedDocuments === 0) {
    missingData.push("No approved documents found.");
  }

  if (lineItemStats.totalLineItems < 10) {
    missingData.push("Line-item depth is weak. Upload clearer statements.");
  }

  const actions: DecisionAction[] = [];

  if (approvedDocuments === 0 || revenue === null || expenses === null) {
    actions.push({
      id: "documents-first",
      priority: "CRITICAL",
      category: "DOCUMENTS",
      title: "Approve core financial documents first",
      problem:
        "Aureli cannot safely make CFO decisions without approved revenue and expense records.",
      action:
        "Upload and approve bank statements, sales invoices, purchase invoices, payroll, and financial statements.",
      expectedImpact:
        "Improves reliability of every agent: CFO, Risk, Forecast, Tax, Cash Flow, and Analyst.",
      timeframe: "TODAY",
      confidence: "HIGH",
    });
  }

  if (profit !== null && profit < 0) {
    actions.push({
      id: "fix-loss",
      priority: "CRITICAL",
      category: "PROFIT",
      title: "Stop the loss before scaling",
      problem: `The business is showing a loss of ${formatMoney(
        profit,
        currency,
      )}.`,
      action:
        "Reduce recurring expenses, improve collections, and identify the fastest revenue improvement path before hiring or expansion.",
      expectedImpact:
        "Directly improves break-even position and reduces owner-level financial risk.",
      timeframe: "TODAY",
      confidence: revenue !== null && expenses !== null ? "HIGH" : "MEDIUM",
    });
  }

  if (estimatedRunwayMonths !== null && estimatedRunwayMonths < 3) {
    actions.push({
      id: "cash-runway-critical",
      priority: "CRITICAL",
      category: "CASH_FLOW",
      title: "Protect cash runway immediately",
      problem: `Estimated runway is only ${estimatedRunwayMonths.toFixed(
        1,
      )} months.`,
      action:
        "Pause non-essential spending, speed up receivables, delay optional purchases, and review the largest cash outflows.",
      expectedImpact:
        "Improves survival time and reduces short-term liquidity risk.",
      timeframe: "TODAY",
      confidence: cash !== null ? "MEDIUM" : "LOW",
    });
  } else if (
    estimatedRunwayMonths !== null &&
    estimatedRunwayMonths >= 3 &&
    estimatedRunwayMonths < 6
  ) {
    actions.push({
      id: "cash-runway-watch",
      priority: "HIGH",
      category: "CASH_FLOW",
      title: "Build a stronger cash buffer",
      problem: `Estimated runway is ${estimatedRunwayMonths.toFixed(
        1,
      )} months, which is not very comfortable.`,
      action:
        "Create a 6-month cash safety target and reduce monthly burn until runway improves.",
      expectedImpact:
        "Reduces the chance of a cash crisis if sales slow down.",
      timeframe: "THIS_WEEK",
      confidence: "MEDIUM",
    });
  }

  if (
    expenseRatioPercent !== null &&
    expenseRatioPercent > 100 &&
    revenue !== null &&
    expenses !== null
  ) {
    actions.push({
      id: "expense-ratio-high",
      priority: "HIGH",
      category: "PROFIT",
      title: "Reduce expense ratio below revenue",
      problem: `Expenses are ${expenseRatioPercent.toFixed(
        1,
      )}% of revenue.`,
      action:
        "Cut or renegotiate the top recurring costs and set a target to bring expenses below revenue.",
      expectedImpact:
        "Moves the business closer to break-even and protects margins.",
      timeframe: "THIS_WEEK",
      confidence: "HIGH",
    });
  }

  if (lineItemStats.suspiciousLineItems > 0) {
    actions.push({
      id: "review-anomalies",
      priority: "HIGH",
      category: "ANOMALY",
      title: "Review suspicious line items",
      problem: `${lineItemStats.suspiciousLineItems} suspicious or risky line-item signal(s) were detected.`,
      action:
        "Open Anomaly Insights and review negative, penalty, interest, overdue, bad debt, or impairment-like entries.",
      expectedImpact:
        "Finds leakage, unusual costs, and possible accounting problems early.",
      timeframe: "THIS_WEEK",
      confidence: lineItemStats.totalLineItems > 20 ? "MEDIUM" : "LOW",
    });
  }

  if (failedDocuments > 0 || rejectedDocuments > 0) {
    actions.push({
      id: "fix-document-errors",
      priority: "HIGH",
      category: "DOCUMENTS",
      title: "Fix failed or rejected documents",
      problem: `${failedDocuments} failed document(s) and ${rejectedDocuments} rejected document(s) may be weakening analysis.`,
      action:
        "Re-upload clearer files, approve correct extractions, and reject only unusable data.",
      expectedImpact:
        "Improves dashboard, forecast, tax readiness, and anomaly accuracy.",
      timeframe: "THIS_WEEK",
      confidence: "HIGH",
    });
  }

  if (profitMarginPercent !== null && profitMarginPercent >= 0 && profitMarginPercent < 5) {
    actions.push({
      id: "thin-margin",
      priority: "MEDIUM",
      category: "GROWTH",
      title: "Improve thin profit margin",
      problem: `Current margin is only ${profitMarginPercent.toFixed(1)}%.`,
      action:
        "Increase pricing, reduce low-value costs, and focus on higher-margin revenue streams.",
      expectedImpact:
        "Improves profit without requiring major sales growth.",
      timeframe: "THIS_MONTH",
      confidence: "MEDIUM",
    });
  }

  actions.push({
    id: "ask-agent",
    priority: actions.length > 0 ? "MEDIUM" : "LOW",
    category: "RISK",
    title: "Ask the AI Finance Team for the next move",
    problem:
      "The best decision depends on your current cash, profit, document quality, and forecast confidence.",
    action:
      "Use AI Chat with CFO, Risk, Cash Flow, and Analyst agents to test the top decision before taking action.",
    expectedImpact:
      "Turns dashboard data into a practical owner-level decision.",
    timeframe: "THIS_MONTH",
    confidence: "MEDIUM",
  });

  const topActions = uniqueActions(actions).sort(
    (a, b) => priorityWeight(b.priority) - priorityWeight(a.priority),
  );

  const todayActions = topActions.filter((action) => action.timeframe === "TODAY");
  const weekActions = topActions.filter(
    (action) => action.timeframe === "THIS_WEEK",
  );
  const monthActions = topActions.filter(
    (action) => action.timeframe === "THIS_MONTH",
  );

  const decisionWarnings: string[] = [];

  if (approvedDocuments < 2) {
    decisionWarnings.push(
      "Decision confidence is weak because approved document coverage is low.",
    );
  }

  if (cash === null) {
    decisionWarnings.push(
      "Cash runway cannot be trusted until bank/cash data is uploaded.",
    );
  }

  if (profit !== null && profit < 0) {
    decisionWarnings.push(
      "Avoid hiring or expansion until loss and burn are controlled.",
    );
  }

  if (lineItemStats.totalLineItems < 10) {
    decisionWarnings.push(
      "Anomaly and cost-control decisions are weaker because line-item depth is low.",
    );
  }

  const riskPenalty =
    (profit !== null && profit < 0 ? 25 : 0) +
    (estimatedRunwayMonths !== null && estimatedRunwayMonths < 3 ? 25 : 0) +
    (approvedDocuments < 2 ? 20 : 0) +
    (failedDocuments > 0 ? 10 : 0) +
    (lineItemStats.suspiciousLineItems > 0 ? 10 : 0);

  const score = Math.max(0, Math.min(100, 100 - riskPenalty));

  const overallStatus: DecisionCenterReport["overallStatus"] =
    revenue === null || expenses === null || approvedDocuments === 0
      ? "INSUFFICIENT_DATA"
      : score < 45
        ? "URGENT"
        : score < 70
          ? "WATCH"
          : "STABLE";

  const ownerFocus =
    topActions[0]?.title ??
    "Keep documents updated and monitor finance health weekly.";

  const executiveSummary =
    overallStatus === "INSUFFICIENT_DATA"
      ? "Decision Center needs stronger approved financial data before it can safely prioritize actions."
      : overallStatus === "URGENT"
        ? "Decision Center found urgent owner-level issues. Fix cash, losses, or document reliability before growth."
        : overallStatus === "WATCH"
          ? "Decision Center found areas that need attention. Focus on the highest-priority actions this week."
          : "Decision Center shows a stable position. Continue monitoring risks and improve margins.";

  return {
    generatedAt: new Date().toISOString(),
    currency,
    executiveSummary,
    ownerFocus,
    overallStatus,
    score,
    metrics: {
      revenue,
      expenses,
      profit,
      cash,
      profitMarginPercent,
      expenseRatioPercent,
      estimatedMonthlyBurn,
      estimatedRunwayMonths,
      approvedDocuments,
      processedDocuments,
      rejectedDocuments,
      failedDocuments,
      totalLineItems: lineItemStats.totalLineItems,
      suspiciousLineItems: lineItemStats.suspiciousLineItems,
    },
    topActions,
    todayActions,
    weekActions,
    monthActions,
    decisionWarnings,
    missingData,
  };
}

export function formatDecisionMoney(value: number | null, currency: string) {
  return formatMoney(value, currency);
}