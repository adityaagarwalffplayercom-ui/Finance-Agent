import { prisma } from "@/lib/prisma";
import { getFinancialProfile } from "@/lib/financial-profile";

type CfoTone = "good" | "warning" | "danger" | "neutral";

export type CfoMetric = {
  label: string;
  value: string;
  hint: string;
  tone: CfoTone;
};

export type CfoScenario = {
  title: string;
  value: string;
  description: string;
  tone: CfoTone;
};

export type CfoAction = {
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  detail: string;
};

export type CfoDecisionPlan = {
  generatedAt: string;
  currency: string;
  summary: string;
  status: "PROFITABLE" | "LOSS_MAKING" | "INSUFFICIENT_DATA";
  metrics: {
    revenue: number | null;
    expenses: number | null;
    profit: number | null;
    cash: number | null;
    breakEvenGap: number | null;
    monthlyExpenseEstimate: number | null;
    cashRunwayMonths: number | null;
    profitMarginPercent: number | null;
    expenseRatioPercent: number | null;
  };
  cards: CfoMetric[];
  scenarios: CfoScenario[];
  actions: CfoAction[];
  topExpenseSignals: {
    label: string;
    amount: number;
    source: string;
  }[];
  hiringDecision: {
    canHire: boolean;
    message: string;
    safeMonthlyHiringBudget: number | null;
  };
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

  const clean = value.replace(/,/g, "").trim();
  const match = clean.match(/-?\d+(\.\d+)?/);

  if (!match) {
    return null;
  }

  const number = Number(match[0]);

  if (!Number.isFinite(number)) {
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

  return number * multiplier;
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

  if (clean === "INR" || clean === "₹") return "₹";
  if (clean === "USD" || clean === "$") return "$";
  if (clean === "GBP" || clean === "£") return "£";
  if (clean === "EUR" || clean === "€") return "€";

  return currency || "";
}

function formatMoney(value: number | null, currency: string) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  const symbol = currencySymbol(currency);
  const sign = value < 0 ? "-" : "";

  return `${sign}${symbol}${compactNumber(Math.abs(value))}`;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  return `${value.toFixed(2)}%`;
}

function readString(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return "";
}

function readAmount(record: JsonRecord) {
  const keys = [
    "amount",
    "total",
    "value",
    "expense",
    "expenses",
    "debit",
    "cost",
    "balance",
  ];

  for (const key of keys) {
    const number = toNumber(record[key]);

    if (number !== null) {
      return Math.abs(number);
    }
  }

  return null;
}

function collectLineItemsFromJson(
  value: unknown,
  source: string,
  output: { label: string; amount: number; source: string }[],
) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectLineItemsFromJson(item, source, output);
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const label = readString(value, [
    "description",
    "name",
    "label",
    "category",
    "particulars",
    "account",
    "item",
  ]);

  const amount = readAmount(value);

  if (label && amount !== null && amount > 0) {
    const lower = label.toLowerCase();

    const looksLikeExpense =
      lower.includes("expense") ||
      lower.includes("cost") ||
      lower.includes("salary") ||
      lower.includes("rent") ||
      lower.includes("purchase") ||
      lower.includes("payroll") ||
      lower.includes("utility") ||
      lower.includes("marketing") ||
      lower.includes("interest") ||
      lower.includes("depreciation") ||
      lower.includes("logistics") ||
      lower.includes("employee") ||
      lower.includes("admin");

    if (looksLikeExpense) {
      output.push({
        label,
        amount,
        source,
      });
    }
  }

  for (const nestedValue of Object.values(value)) {
    if (Array.isArray(nestedValue)) {
      collectLineItemsFromJson(nestedValue, source, output);
    }
  }
}

function makeSummary({
  revenue,
  expenses,
  profit,
  breakEvenGap,
  currency,
}: {
  revenue: number | null;
  expenses: number | null;
  profit: number | null;
  breakEvenGap: number | null;
  currency: string;
}) {
  if (revenue === null && expenses === null && profit === null) {
    return "CFO engine needs approved revenue and expense data before giving a reliable break-even decision.";
  }

  if (profit !== null && profit >= 0) {
    return `Business is currently showing profit of ${formatMoney(
      profit,
      currency,
    )}. CFO focus should move from survival to margin improvement, cash protection, and controlled growth.`;
  }

  return `Business is currently below break-even by about ${formatMoney(
    breakEvenGap,
    currency,
  )}. CFO priority should be reducing costs, improving revenue coverage, and avoiding new fixed commitments until profit stabilizes.`;
}

export async function getCfoDecisionPlan(
  userId: string,
): Promise<CfoDecisionPlan> {
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
        status: "PROCESSED",
        reviewStatus: "APPROVED",
      },
      select: {
        fileName: true,
        extractedData: true,
      },
      orderBy: {
        uploadedAt: "desc",
      },
      take: 50,
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

  const breakEvenGap = profit !== null && profit < 0 ? Math.abs(profit) : 0;

  const monthlyExpenseEstimate =
    expenses !== null && expenses > 0 ? expenses / 12 : null;

  const cashRunwayMonths =
    cash !== null && monthlyExpenseEstimate !== null && monthlyExpenseEstimate > 0
      ? cash / monthlyExpenseEstimate
      : null;

  const profitMarginPercent =
    revenue !== null && revenue > 0 && profit !== null
      ? (profit / revenue) * 100
      : null;

  const expenseRatioPercent =
    revenue !== null && revenue > 0 && expenses !== null
      ? (expenses / revenue) * 100
      : null;

  const status =
    revenue === null && expenses === null && profit === null
      ? "INSUFFICIENT_DATA"
      : profit !== null && profit >= 0
        ? "PROFITABLE"
        : "LOSS_MAKING";

  const expenseReductionNeededPercent =
    expenses !== null && expenses > 0 && breakEvenGap !== null
      ? (breakEvenGap / expenses) * 100
      : null;

  const revenueIncreaseNeededPercent =
    revenue !== null && revenue > 0 && breakEvenGap !== null
      ? (breakEvenGap / revenue) * 100
      : null;

  const targetProfit =
    revenue !== null && revenue > 0 ? revenue * 0.1 : null;

  const targetProfitGap =
    targetProfit !== null && profit !== null
      ? Math.max(0, targetProfit - profit)
      : null;

  const topExpenseSignals: {
    label: string;
    amount: number;
    source: string;
  }[] = [];

  for (const document of documents) {
    collectLineItemsFromJson(
      document.extractedData,
      document.fileName,
      topExpenseSignals,
    );
  }

  const topExpenses = topExpenseSignals
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  const safeMonthlyHiringBudget =
    profit !== null && profit > 0 ? Math.max(0, profit / 12 / 3) : null;

  const canHire =
    profit !== null &&
    profit > 0 &&
    cashRunwayMonths !== null &&
    cashRunwayMonths >= 3;

  const cards: CfoMetric[] = [
    {
      label: "Break-even gap",
      value: formatMoney(breakEvenGap, currency),
      hint:
        breakEvenGap && breakEvenGap > 0
          ? "Amount needed to reach zero profit/loss"
          : "Already at or above break-even",
      tone: breakEvenGap && breakEvenGap > 0 ? "danger" : "good",
    },
    {
      label: "Profit margin",
      value: formatPercent(profitMarginPercent),
      hint: "Profit as percentage of revenue",
      tone:
        profitMarginPercent === null
          ? "neutral"
          : profitMarginPercent >= 10
            ? "good"
            : profitMarginPercent >= 0
              ? "warning"
              : "danger",
    },
    {
      label: "Expense ratio",
      value: formatPercent(expenseRatioPercent),
      hint: "Expenses compared to revenue",
      tone:
        expenseRatioPercent === null
          ? "neutral"
          : expenseRatioPercent <= 80
            ? "good"
            : expenseRatioPercent <= 100
              ? "warning"
              : "danger",
    },
    {
      label: "Cash runway",
      value:
        cashRunwayMonths === null
          ? "Not available"
          : `${cashRunwayMonths.toFixed(1)} months`,
      hint: "Estimated months cash can cover expenses",
      tone:
        cashRunwayMonths === null
          ? "neutral"
          : cashRunwayMonths >= 6
            ? "good"
            : cashRunwayMonths >= 3
              ? "warning"
              : "danger",
    },
  ];

  const scenarios: CfoScenario[] = [
    {
      title: "Break even by reducing expenses",
      value:
        expenseReductionNeededPercent === null
          ? "Not available"
          : `${expenseReductionNeededPercent.toFixed(2)}% cut`,
      description:
        breakEvenGap && breakEvenGap > 0
          ? `Reduce annual expenses by ${formatMoney(
              breakEvenGap,
              currency,
            )} to reach break-even if revenue stays the same.`
          : "No expense reduction is required for break-even based on current profit signal.",
      tone: breakEvenGap && breakEvenGap > 0 ? "warning" : "good",
    },
    {
      title: "Break even by increasing revenue",
      value:
        revenueIncreaseNeededPercent === null
          ? "Not available"
          : `${revenueIncreaseNeededPercent.toFixed(2)}% growth`,
      description:
        breakEvenGap && breakEvenGap > 0
          ? `Increase revenue by ${formatMoney(
              breakEvenGap,
              currency,
            )} to reach break-even if expenses stay the same.`
          : "Current numbers already show break-even or profit.",
      tone: breakEvenGap && breakEvenGap > 0 ? "warning" : "good",
    },
    {
      title: "Balanced CFO plan",
      value:
        breakEvenGap && breakEvenGap > 0
          ? `${formatMoney(breakEvenGap / 2, currency)} + ${formatMoney(
              breakEvenGap / 2,
              currency,
            )}`
          : "Protect margin",
      description:
        breakEvenGap && breakEvenGap > 0
          ? "A balanced plan means half the gap is solved by cost control and half by revenue growth."
          : "Since break-even is achieved, focus on improving margin and protecting cash.",
      tone: breakEvenGap && breakEvenGap > 0 ? "warning" : "good",
    },
    {
      title: "Target 10% profit margin",
      value: formatMoney(targetProfitGap, currency),
      description:
        targetProfitGap !== null
          ? "Extra improvement required to reach an estimated 10% profit margin."
          : "Revenue and profit data are required to calculate target profit margin.",
      tone:
        targetProfitGap === null
          ? "neutral"
          : targetProfitGap > 0
            ? "warning"
            : "good",
    },
  ];

  const actions: CfoAction[] = [];

  if (status === "INSUFFICIENT_DATA") {
    actions.push({
      priority: "HIGH",
      title: "Approve core finance documents",
      detail:
        "Upload and approve revenue, expense, bank, and financial statement documents so CFO engine can calculate break-even properly.",
    });
  }

  if (breakEvenGap && breakEvenGap > 0) {
    actions.push({
      priority: "HIGH",
      title: "Close the break-even gap first",
      detail: `Your estimated gap is ${formatMoney(
        breakEvenGap,
        currency,
      )}. Avoid expansion decisions until this gap has a clear plan.`,
    });
  }

  if (
    expenseRatioPercent !== null &&
    Number.isFinite(expenseRatioPercent) &&
    expenseRatioPercent > 100
  ) {
    actions.push({
      priority: "HIGH",
      title: "Expenses are higher than revenue",
      detail:
        "Start with fixed and recurring costs because they keep the business in loss even when sales improve.",
    });
  }

  if (
    cashRunwayMonths !== null &&
    Number.isFinite(cashRunwayMonths) &&
    cashRunwayMonths < 3
  ) {
    actions.push({
      priority: "HIGH",
      title: "Protect cash runway",
      detail:
        "Cash runway appears below 3 months. Delay hiring, reduce discretionary spend, and improve collections.",
    });
  }

  if (topExpenses.length > 0) {
    actions.push({
      priority: "MEDIUM",
      title: "Review largest expense signals",
      detail: `Start review with: ${topExpenses
        .slice(0, 3)
        .map((item) => item.label)
        .join(", ")}.`,
    });
  }

  actions.push({
    priority: "MEDIUM",
    title: "Use monthly tracking",
    detail:
      "Review break-even monthly so one-time gains do not hide recurring losses.",
  });

  return {
    generatedAt: new Date().toISOString(),
    currency,
    summary: makeSummary({
      revenue,
      expenses,
      profit,
      breakEvenGap,
      currency,
    }),
    status,
    metrics: {
      revenue,
      expenses,
      profit,
      cash,
      breakEvenGap,
      monthlyExpenseEstimate,
      cashRunwayMonths,
      profitMarginPercent,
      expenseRatioPercent,
    },
    cards,
    scenarios,
    actions,
    topExpenseSignals: topExpenses,
    hiringDecision: {
      canHire,
      safeMonthlyHiringBudget,
      message: canHire
        ? `Hiring may be possible, but keep new monthly fixed cost below about ${formatMoney(
            safeMonthlyHiringBudget,
            currency,
          )} unless revenue is stable.`
        : "Hiring is not recommended yet. First improve profit, cash runway, and break-even coverage.",
    },
  };
}