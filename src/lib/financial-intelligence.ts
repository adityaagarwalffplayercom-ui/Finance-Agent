import type { DocumentCategory } from "@prisma/client";
import type { ExtractedDocumentData } from "./gemini";

type MoneyUnit = "base" | "millions";

export type IntelligenceDocument = {
  id: string;
  fileName: string;
  category: DocumentCategory;
  extractedData: ExtractedDocumentData | null;
  uploadedAt: Date;
};

type IntelligenceExtractedData = ExtractedDocumentData & {
  revenue?: number;
  expenses?: number;
  netIncome?: number;
  profit?: number;
  assets?: number;
  liabilities?: number;
  equity?: number;
  totalAmount?: number;
  currency?: string;
  documentDate?: string;
  periodStart?: string;
  periodEnd?: string;
  vendorOrCounterparty?: string;
  transactions?: Array<{
    date: string;
    description?: string;
    amount: number;
    direction: "credit" | "debit" | string;
  }>;
};

export type MonthlyPoint = {
  month: string;
  revenue: number;
  expenses: number;
  net: number;
};

export type IntelligenceAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
};

export type Recommendation = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  action: string;
};

export type FinancialIntelligence = {
  currency: string;
  moneyUnit: MoneyUnit;

  totals: {
    revenue: number;
    expenses: number;
    profit: number;
    cash: number | null;
    assets: number | null;
    liabilities: number | null;
    equity: number | null;
  };

  ratios: {
    profitMarginPct: number | null;
    expenseRatioPct: number | null;
    debtToAssetPct: number | null;
  };

  trends: {
    monthly: MonthlyPoint[];
    revenueGrowthPct: number | null;
    expenseGrowthPct: number | null;
    latestMonthlyNet: number | null;
  };

  risk: {
    healthScore: number;
    riskScore: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    cashRunwayDays: number | null;
    monthlyBurnRate: number | null;
  };

  executiveSummary: string;
  alerts: IntelligenceAlert[];
  recommendations: Recommendation[];
};

const REVENUE_CATEGORIES: DocumentCategory[] = ["SALES_INVOICE"];
const EXPENSE_CATEGORIES: DocumentCategory[] = ["PURCHASE_INVOICE", "PAYROLL", "UTILITY_BILL"];

const CURRENCY_LOCALES: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  GBP: "en-GB",
  EUR: "en-IE",
  AED: "en-AE",
  SGD: "en-SG",
  AUD: "en-AU",
  CAD: "en-CA",
  JPY: "ja-JP",
};

function normalizeCurrency(currency?: string | null) {
  return currency?.trim().toUpperCase() || null;
}

function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function resolveDocDate(data: IntelligenceExtractedData | null, uploadedAt: Date): Date {
  const raw = data?.periodEnd || data?.documentDate || data?.periodStart;

  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return uploadedAt;
}

function addMonthlyValue(
  monthly: Map<string, MonthlyPoint>,
  date: Date,
  values: Partial<Pick<MonthlyPoint, "revenue" | "expenses" | "net">>,
) {
  if (Number.isNaN(date.getTime())) return;

  const key = monthKey(date);

  const existing = monthly.get(key) ?? {
    month: key,
    revenue: 0,
    expenses: 0,
    net: 0,
  };

  existing.revenue += values.revenue ?? 0;
  existing.expenses += values.expenses ?? 0;
  existing.net += values.net ?? 0;

  monthly.set(key, existing);
}

function normalizeAmountForCategory(amount: number, category: DocumentCategory) {
  if (!isValidNumber(amount)) return 0;

  // Financial statements often store values as "INR in millions".
  // Example: 75.18 means ₹75.18M, so we convert it to ₹75,180,000.
  if (category === "FINANCIAL_STATEMENT" && Math.abs(amount) < 1_000_000) {
    return amount * 1_000_000;
  }

  return amount;
}

function formatMoney(amount: number, currency = "INR") {
  const normalizedCurrency = normalizeCurrency(currency) ?? "INR";
  const locale = CURRENCY_LOCALES[normalizedCurrency] ?? "en-IN";

  const absAmount = Math.abs(amount);
  let displayAmount = amount;
  let suffix = "";

  if (absAmount >= 1_000_000_000) {
    displayAmount = amount / 1_000_000_000;
    suffix = "B";
  } else if (absAmount >= 1_000_000) {
    displayAmount = amount / 1_000_000;
    suffix = "M";
  }

  try {
    return (
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: normalizedCurrency,
        minimumFractionDigits: suffix ? 2 : 0,
        maximumFractionDigits: suffix ? 2 : 0,
      }).format(displayAmount) + suffix
    );
  } catch {
    return suffix
      ? `${displayAmount.toLocaleString(locale, { maximumFractionDigits: 2 })}${suffix}`
      : amount.toLocaleString(locale);
  }
}

function calculateGrowthPct(previous: number, current: number) {
  if (previous === 0) return null;
  return round(((current - previous) / Math.abs(previous)) * 100);
}

function calculateMonthlyBurnRate(monthly: MonthlyPoint[]) {
  const negativeMonths = monthly.filter((point) => point.net < 0).slice(-3);

  if (negativeMonths.length === 0) return null;

  const totalBurn = negativeMonths.reduce((sum, point) => sum + Math.abs(point.net), 0);
  return round(totalBurn / negativeMonths.length);
}

function calculateRisk(params: {
  revenue: number;
  expenses: number;
  profit: number;
  cash: number | null;
  monthlyBurnRate: number | null;
  profitMarginPct: number | null;
  expenseRatioPct: number | null;
}) {
  const { revenue, expenses, cash, monthlyBurnRate } = params;

  let healthScore = 50;

  // Actual revenue coverage formula:
  // Health Score = Revenue / Expenses * 100
  //
  // Example:
  // Revenue  = ₹15.15M
  // Expenses = ₹42.50M
  // Score    = 15.15 / 42.50 * 100 = 35.64 ≈ 36/100
  //
  // This is not a forced minimum. It tells how much of expenses are covered by revenue.
  if (expenses > 0) {
    healthScore = (revenue / expenses) * 100;
  } else if (revenue > 0 && expenses === 0) {
    healthScore = 100;
  } else {
    healthScore = 50;
  }

  let cashRunwayDays: number | null = null;

  if (cash !== null && monthlyBurnRate !== null && monthlyBurnRate > 0) {
    cashRunwayDays = Math.round(cash / (monthlyBurnRate / 30));
  }

  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  const riskScore = 100 - healthScore;

  const riskLevel =
    healthScore >= 70
      ? "low"
      : healthScore >= 45
        ? "medium"
        : healthScore >= 25
          ? "high"
          : "critical";

  return {
    healthScore,
    riskScore,
    riskLevel,
    cashRunwayDays,
  };
}

function buildExecutiveSummary(params: {
  revenue: number;
  expenses: number;
  profit: number;
  profitMarginPct: number | null;
  riskLevel: FinancialIntelligence["risk"]["riskLevel"];
  currency: string;
}) {
  const { revenue, expenses, profit, profitMarginPct, riskLevel, currency } = params;

  if (revenue === 0 && expenses === 0) {
    return "Not enough financial data is available yet. Upload more documents to generate executive-level insights.";
  }

  const profitText =
    profit >= 0
      ? `The business is currently profitable with estimated profit of ${formatMoney(profit, currency)}.`
      : `The business is currently running a loss of ${formatMoney(Math.abs(profit), currency)}.`;

  const marginText =
    profitMarginPct !== null ? ` Profit margin is approximately ${profitMarginPct.toFixed(2)}%.` : "";

  const riskText =
    riskLevel === "critical"
      ? " Immediate attention is required because the financial risk level is critical."
      : riskLevel === "high"
        ? " The business shows high financial risk and should control expenses carefully."
        : riskLevel === "medium"
          ? " The business is stable but needs monitoring."
          : " The business appears financially stable based on the processed documents.";

  return `Based on processed documents, revenue is ${formatMoney(
    revenue,
    currency,
  )}, expenses are ${formatMoney(expenses, currency)}. ${profitText}${marginText}${riskText}`;
}

function buildAlerts(params: {
  revenue: number;
  expenses: number;
  profit: number;
  cash: number | null;
  profitMarginPct: number | null;
  expenseRatioPct: number | null;
  revenueGrowthPct: number | null;
  expenseGrowthPct: number | null;
  cashRunwayDays: number | null;
  monthlyBurnRate: number | null;
  currency: string;
}) {
  const {
    revenue,
    expenses,
    profit,
    cash,
    profitMarginPct,
    expenseRatioPct,
    revenueGrowthPct,
    expenseGrowthPct,
    cashRunwayDays,
    monthlyBurnRate,
    currency,
  } = params;

  const alerts: IntelligenceAlert[] = [];

  if (revenue === 0) {
    alerts.push({
      id: "no-revenue",
      severity: "info",
      title: "Revenue data missing",
      message: "No revenue was found in the processed documents yet.",
    });
  }

  if (expenses > revenue && revenue > 0) {
    alerts.push({
      id: "expenses-above-revenue",
      severity: "warning",
      title: "Expenses exceed revenue",
      message: `Expenses are ${formatMoney(expenses, currency)}, which is higher than revenue of ${formatMoney(
        revenue,
        currency,
      )}.`,
    });
  }

  if (profit < 0) {
    alerts.push({
      id: "loss-detected",
      severity: "warning",
      title: "Business is running at a loss",
      message: `Current estimated loss is ${formatMoney(Math.abs(profit), currency)} based on processed documents.`,
    });
  }

  if (profitMarginPct !== null && profitMarginPct < 10 && profitMarginPct >= 0) {
    alerts.push({
      id: "low-margin",
      severity: "warning",
      title: "Low profit margin",
      message: `Profit margin is only ${profitMarginPct.toFixed(2)}%. The business may need cost control or better pricing.`,
    });
  }

  if (expenseRatioPct !== null && expenseRatioPct > 80 && expenseRatioPct <= 100) {
    alerts.push({
      id: "high-expense-ratio",
      severity: "warning",
      title: "High expense ratio",
      message: `Expenses consume ${expenseRatioPct.toFixed(2)}% of revenue.`,
    });
  }

  if (cash !== null && cash < 0) {
    alerts.push({
      id: "negative-cash",
      severity: "critical",
      title: "Negative cash balance",
      message: "The latest processed bank statement shows negative cash.",
    });
  }

  if (cashRunwayDays !== null && monthlyBurnRate !== null) {
    if (cashRunwayDays < 30) {
      alerts.push({
        id: "critical-runway",
        severity: "critical",
        title: "Cash runway is critical",
        message: `At the current burn rate of ${formatMoney(
          monthlyBurnRate,
          currency,
        )}/month, cash may last only about ${cashRunwayDays} days.`,
      });
    } else if (cashRunwayDays < 90) {
      alerts.push({
        id: "warning-runway",
        severity: "warning",
        title: "Cash runway needs attention",
        message: `At the current burn rate of ${formatMoney(
          monthlyBurnRate,
          currency,
        )}/month, cash may last about ${cashRunwayDays} days.`,
      });
    }
  }

  if (revenueGrowthPct !== null && revenueGrowthPct < 0) {
    alerts.push({
      id: "revenue-decline",
      severity: "warning",
      title: "Revenue declined",
      message: `Revenue decreased by ${Math.abs(revenueGrowthPct).toFixed(2)}% compared with the previous period.`,
    });
  }

  if (expenseGrowthPct !== null && expenseGrowthPct > 20) {
    alerts.push({
      id: "expense-spike",
      severity: "warning",
      title: "Expenses increased sharply",
      message: `Expenses increased by ${expenseGrowthPct.toFixed(2)}% compared with the previous period.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "stable",
      severity: "info",
      title: "Business looks stable",
      message: "No major financial risk was detected from the processed documents.",
    });
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

function buildRecommendations(params: {
  revenue: number;
  expenses: number;
  profit: number;
  profitMarginPct: number | null;
  expenseRatioPct: number | null;
  cashRunwayDays: number | null;
  revenueGrowthPct: number | null;
  expenseGrowthPct: number | null;
}) {
  const {
    revenue,
    expenses,
    profit,
    profitMarginPct,
    expenseRatioPct,
    cashRunwayDays,
    revenueGrowthPct,
    expenseGrowthPct,
  } = params;

  const recommendations: Recommendation[] = [];

  if (profit < 0) {
    recommendations.push({
      id: "reduce-loss",
      priority: "high",
      title: "Reduce losses first",
      action: "Review the top expense categories and pause non-essential spending until profit becomes positive.",
    });
  }

  if (cashRunwayDays !== null && cashRunwayDays < 90) {
    recommendations.push({
      id: "protect-cash",
      priority: cashRunwayDays < 30 ? "high" : "medium",
      title: "Protect cash runway",
      action: "Delay large purchases, collect pending receivables faster, and reduce recurring expenses to extend cash runway.",
    });
  }

  if (expenseRatioPct !== null && expenseRatioPct > 80) {
    recommendations.push({
      id: "expense-control",
      priority: "medium",
      title: "Control expense ratio",
      action: "Set a monthly expense ceiling and compare each vendor's cost against previous months.",
    });
  }

  if (profitMarginPct !== null && profitMarginPct < 10 && revenue > 0) {
    recommendations.push({
      id: "improve-margin",
      priority: "medium",
      title: "Improve profit margin",
      action: "Increase pricing, reduce low-value costs, or focus on higher-margin customers and products.",
    });
  }

  if (revenueGrowthPct !== null && revenueGrowthPct < 0) {
    recommendations.push({
      id: "restore-revenue",
      priority: "medium",
      title: "Recover revenue trend",
      action: "Identify which customers or revenue sources declined and create a follow-up plan for them.",
    });
  }

  if (expenseGrowthPct !== null && expenseGrowthPct > 20 && expenses > 0) {
    recommendations.push({
      id: "check-expense-spike",
      priority: "medium",
      title: "Investigate expense spike",
      action: "Check whether the expense increase is one-time or recurring. If recurring, renegotiate vendor terms.",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "keep-monitoring",
      priority: "low",
      title: "Keep monitoring",
      action: "Continue uploading new documents so the system can detect risks earlier and improve recommendations.",
    });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

export function buildFinancialIntelligence(
  documents: IntelligenceDocument[],
  businessCurrency = "INR",
): FinancialIntelligence {
  const currenciesSeen = new Set<string>();

  for (const doc of documents) {
    const data = doc.extractedData as IntelligenceExtractedData | null;
    const currency = normalizeCurrency(data?.currency);
    if (currency) currenciesSeen.add(currency);
  }

  const currency = [...currenciesSeen][0] ?? normalizeCurrency(businessCurrency) ?? "INR";

  let revenue = 0;
  let expenses = 0;
  let latestCash: number | null = null;
  let latestCashDate: Date | null = null;

  let assets: number | null = null;
  let liabilities: number | null = null;
  let equity: number | null = null;

  const monthly = new Map<string, MonthlyPoint>();

  for (const doc of documents) {
    const data = doc.extractedData as IntelligenceExtractedData | null;
    if (!data) continue;

    const docDate = resolveDocDate(data, doc.uploadedAt);

    if (doc.category === "FINANCIAL_STATEMENT") {
      const statementRevenue = isValidNumber(data.revenue)
        ? normalizeAmountForCategory(data.revenue, doc.category)
        : 0;

      const statementExpenses = isValidNumber(data.expenses)
        ? normalizeAmountForCategory(data.expenses, doc.category)
        : 0;

      revenue += statementRevenue;
      expenses += statementExpenses;

      addMonthlyValue(monthly, docDate, {
        revenue: statementRevenue,
        expenses: statementExpenses,
        net: statementRevenue - statementExpenses,
      });

      if (isValidNumber(data.assets)) {
        assets = normalizeAmountForCategory(data.assets, doc.category);
      }

      if (isValidNumber(data.liabilities)) {
        liabilities = normalizeAmountForCategory(data.liabilities, doc.category);
      }

      if (isValidNumber(data.equity)) {
        equity = normalizeAmountForCategory(data.equity, doc.category);
      }

      continue;
    }

    if (REVENUE_CATEGORIES.includes(doc.category) && isValidNumber(data.totalAmount)) {
      const amount = normalizeAmountForCategory(data.totalAmount, doc.category);
      revenue += amount;

      addMonthlyValue(monthly, docDate, {
        revenue: amount,
        net: amount,
      });
    }

    if (EXPENSE_CATEGORIES.includes(doc.category) && isValidNumber(data.totalAmount)) {
      const amount = normalizeAmountForCategory(data.totalAmount, doc.category);
      expenses += amount;

      addMonthlyValue(monthly, docDate, {
        expenses: amount,
        net: -amount,
      });
    }

    if (doc.category === "BANK_STATEMENT") {
      if (isValidNumber(data.totalAmount) && (!latestCashDate || doc.uploadedAt > latestCashDate)) {
        latestCash = data.totalAmount;
        latestCashDate = doc.uploadedAt;
      }

      for (const txn of data.transactions ?? []) {
        if (!isValidNumber(txn.amount)) continue;

        const txnDate = new Date(txn.date);
        const signedAmount = txn.direction === "credit" ? txn.amount : -txn.amount;

        addMonthlyValue(monthly, txnDate, {
          net: signedAmount,
        });
      }
    }
  }

  const profit = revenue - expenses;

  const monthlyPoints = [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month));

  const latestMonth = monthlyPoints[monthlyPoints.length - 1] ?? null;
  const previousMonth = monthlyPoints[monthlyPoints.length - 2] ?? null;

  const revenueGrowthPct =
    latestMonth && previousMonth ? calculateGrowthPct(previousMonth.revenue, latestMonth.revenue) : null;

  const expenseGrowthPct =
    latestMonth && previousMonth ? calculateGrowthPct(previousMonth.expenses, latestMonth.expenses) : null;

  const latestMonthlyNet = latestMonth ? latestMonth.net : null;

  const profitMarginPct = revenue > 0 ? round((profit / revenue) * 100) : null;
  const expenseRatioPct = revenue > 0 ? round((expenses / revenue) * 100) : null;

  const debtToAssetPct =
    assets !== null && assets > 0 && liabilities !== null ? round((liabilities / assets) * 100) : null;

  const monthlyBurnRate = calculateMonthlyBurnRate(monthlyPoints);

  const risk = calculateRisk({
    revenue,
    expenses,
    profit,
    cash: latestCash,
    monthlyBurnRate,
    profitMarginPct,
    expenseRatioPct,
  });

  const alerts = buildAlerts({
    revenue,
    expenses,
    profit,
    cash: latestCash,
    profitMarginPct,
    expenseRatioPct,
    revenueGrowthPct,
    expenseGrowthPct,
    cashRunwayDays: risk.cashRunwayDays,
    monthlyBurnRate,
    currency,
  });

  const recommendations = buildRecommendations({
    revenue,
    expenses,
    profit,
    profitMarginPct,
    expenseRatioPct,
    cashRunwayDays: risk.cashRunwayDays,
    revenueGrowthPct,
    expenseGrowthPct,
  });

  const executiveSummary = buildExecutiveSummary({
    revenue,
    expenses,
    profit,
    profitMarginPct,
    riskLevel: risk.riskLevel,
    currency,
  });

  return {
    currency,
    moneyUnit: "base",

    totals: {
      revenue: round(revenue),
      expenses: round(expenses),
      profit: round(profit),
      cash: latestCash,
      assets,
      liabilities,
      equity,
    },

    ratios: {
      profitMarginPct,
      expenseRatioPct,
      debtToAssetPct,
    },

    trends: {
      monthly: monthlyPoints.map((point) => ({
        month: point.month,
        revenue: round(point.revenue),
        expenses: round(point.expenses),
        net: round(point.net),
      })),
      revenueGrowthPct,
      expenseGrowthPct,
      latestMonthlyNet: latestMonthlyNet !== null ? round(latestMonthlyNet) : null,
    },

    risk: {
      healthScore: risk.healthScore,
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      cashRunwayDays: risk.cashRunwayDays,
      monthlyBurnRate,
    },

    executiveSummary,
    alerts,
    recommendations,
  };
}

export { formatMoney };