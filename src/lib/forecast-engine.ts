import { prisma } from "@/lib/prisma";
import { getFinancialProfile } from "@/lib/financial-profile";

export type ForecastStatus = "POSITIVE" | "WATCH" | "RISK" | "INSUFFICIENT_DATA";

export type ForecastScenarioId =
  | "baseline"
  | "revenue_up_10"
  | "expense_down_15"
  | "sales_drop_20"
  | "hire_employee";

export type ForecastPeriod = {
  months: number;
  projectedRevenue: number | null;
  projectedExpenses: number | null;
  projectedProfit: number | null;
  projectedCash: number | null;
  marginPercent: number | null;
  status: ForecastStatus;
  summary: string;
};

export type ForecastScenario = {
  id: ForecastScenarioId;
  title: string;
  description: string;
  assumption: string;
  periods: ForecastPeriod[];
  recommendation: string;
};

export type ForecastReport = {
  generatedAt: string;
  currency: string;
  status: ForecastStatus;
  summary: string;
  baseMetrics: {
    revenue: number | null;
    expenses: number | null;
    profit: number | null;
    cash: number | null;
    monthlyRevenue: number | null;
    monthlyExpenses: number | null;
    monthlyProfit: number | null;
    currentMarginPercent: number | null;
  };
  assumptions: {
    monthlyRevenueGrowthPercent: number;
    monthlyExpenseGrowthPercent: number;
    estimatedMonthlyEmployeeCost: number | null;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    confidenceReason: string;
  };
  periods: ForecastPeriod[];
  scenarios: ForecastScenario[];
  dataCoverage: {
    processedDocuments: number;
    approvedDocuments: number;
    pendingDocuments: number;
    failedDocuments: number;
  };
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const clean = value
    .replace(/,/g, "")
    .replace(/[Rs. $â‚¬£]/g, "")
    .replace(/Rs\./gi, "")
    .trim();

  if (!clean || clean === "â€”") {
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
  if (!value || value === "â€”" || value === "Not available") {
    return null;
  }

  return toNumber(value);
}

function calculateMargin(revenue: number | null, profit: number | null) {
  if (revenue === null || profit === null || revenue <= 0) {
    return null;
  }

  return (profit / revenue) * 100;
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

function statusFromForecast({
  projectedProfit,
  projectedCash,
  marginPercent,
}: {
  projectedProfit: number | null;
  projectedCash: number | null;
  marginPercent: number | null;
}): ForecastStatus {
  if (projectedProfit === null && projectedCash === null) {
    return "INSUFFICIENT_DATA";
  }

  if (
    projectedCash !== null &&
    projectedCash < 0
  ) {
    return "RISK";
  }

  if (
    projectedProfit !== null &&
    projectedProfit < 0
  ) {
    return "RISK";
  }

  if (
    marginPercent !== null &&
    marginPercent < 5
  ) {
    return "WATCH";
  }

  return "POSITIVE";
}

function buildPeriodSummary({
  months,
  projectedProfit,
  projectedCash,
  marginPercent,
  currency,
}: {
  months: number;
  projectedProfit: number | null;
  projectedCash: number | null;
  marginPercent: number | null;
  currency: string;
}) {
  if (projectedProfit === null) {
    return "Not enough approved financial data to forecast this period reliably.";
  }

  if (projectedProfit < 0) {
    return `In ${months} months, projected loss is ${formatMoney(
      projectedProfit,
      currency,
    )}. Fix burn before growth.`;
  }

  if (projectedCash !== null && projectedCash < 0) {
    return `In ${months} months, cash may turn negative even if profit improves. Watch liquidity.`;
  }

  if (marginPercent !== null && marginPercent < 5) {
    return `In ${months} months, profit is positive but margin is thin at ${marginPercent.toFixed(
      1,
    )}%.`;
  }

  return `In ${months} months, projected profit is ${formatMoney(
    projectedProfit,
    currency,
  )}.`;
}

function buildForecastPeriods({
  monthlyRevenue,
  monthlyExpenses,
  cash,
  revenueGrowthRate,
  expenseGrowthRate,
  revenueMultiplier = 1,
  expenseMultiplier = 1,
  extraMonthlyExpense = 0,
  currency,
}: {
  monthlyRevenue: number | null;
  monthlyExpenses: number | null;
  cash: number | null;
  revenueGrowthRate: number;
  expenseGrowthRate: number;
  revenueMultiplier?: number;
  expenseMultiplier?: number;
  extraMonthlyExpense?: number;
  currency: string;
}): ForecastPeriod[] {
  const monthsList = [3, 6, 12];

  return monthsList.map((months) => {
    if (monthlyRevenue === null || monthlyExpenses === null) {
      return {
        months,
        projectedRevenue: null,
        projectedExpenses: null,
        projectedProfit: null,
        projectedCash: null,
        marginPercent: null,
        status: "INSUFFICIENT_DATA",
        summary: "Upload approved revenue and expense documents to create a forecast.",
      };
    }

    let projectedRevenue = 0;
    let projectedExpenses = 0;

    for (let month = 1; month <= months; month += 1) {
      const monthRevenue =
        monthlyRevenue *
        revenueMultiplier *
        Math.pow(1 + revenueGrowthRate, month - 1);

      const monthExpenses =
        monthlyExpenses *
          expenseMultiplier *
          Math.pow(1 + expenseGrowthRate, month - 1) +
        extraMonthlyExpense;

      projectedRevenue += monthRevenue;
      projectedExpenses += monthExpenses;
    }

    const projectedProfit = projectedRevenue - projectedExpenses;
    const projectedCash = cash !== null ? cash + projectedProfit : null;
    const marginPercent = calculateMargin(projectedRevenue, projectedProfit);

    const status = statusFromForecast({
      projectedProfit,
      projectedCash,
      marginPercent,
    });

    return {
      months,
      projectedRevenue,
      projectedExpenses,
      projectedProfit,
      projectedCash,
      marginPercent,
      status,
      summary: buildPeriodSummary({
        months,
        projectedProfit,
        projectedCash,
        marginPercent,
        currency,
      }),
    };
  });
}

function buildScenarioRecommendation({
  scenarioId,
  periods,
  currency,
}: {
  scenarioId: ForecastScenarioId;
  periods: ForecastPeriod[];
  currency: string;
}) {
  const twelveMonth = periods.find((period) => period.months === 12);

  if (!twelveMonth || twelveMonth.projectedProfit === null) {
    return "Forecast needs stronger approved revenue and expense data before this scenario can be trusted.";
  }

  if (scenarioId === "sales_drop_20") {
    if (twelveMonth.projectedProfit < 0) {
      return "A 20% sales drop could create serious pressure. Build cash buffer and reduce fixed costs.";
    }

    return "Business can survive this sales drop scenario, but still monitor cash and fixed expenses.";
  }

  if (scenarioId === "hire_employee") {
    if (twelveMonth.projectedProfit < 0) {
      return "Hiring is not safe under this assumption. Improve profit or cash runway first.";
    }

    return "Hiring may be possible, but approve it only after checking monthly cash runway and recurring revenue.";
  }

  if (twelveMonth.projectedProfit < 0) {
    return `This scenario still leaves projected 12-month loss of ${formatMoney(
      twelveMonth.projectedProfit,
      currency,
    )}. More aggressive action is needed.`;
  }

  return `This scenario improves 12-month projected profit to ${formatMoney(
    twelveMonth.projectedProfit,
    currency,
  )}.`;
}

export async function getForecastReport(userId: string): Promise<ForecastReport> {
  const [profile, business, statusCounts] = await Promise.all([
    getFinancialProfile(userId),
    prisma.business.findUnique({
      where: {
        userId,
      },
      select: {
        currency: true,
      },
    }),
    prisma.document.groupBy({
      by: ["status", "reviewStatus"],
      where: {
        userId,
      },
      _count: {
        _all: true,
      },
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

  const monthlyRevenue = revenue !== null ? revenue / 12 : null;
  const monthlyExpenses = expenses !== null ? expenses / 12 : null;
  const monthlyProfit = profit !== null ? profit / 12 : null;

  const currentMarginPercent = calculateMargin(revenue, profit);

  const processedDocuments = statusCounts
    .filter((item) => item.status === "PROCESSED")
    .reduce((total, item) => total + item._count._all, 0);

  const approvedDocuments = statusCounts
    .filter((item) => item.reviewStatus === "APPROVED")
    .reduce((total, item) => total + item._count._all, 0);

  const pendingDocuments = statusCounts
    .filter(
      (item) =>
        String(item.reviewStatus) !== "APPROVED" &&
        String(item.reviewStatus) !== "REJECTED",
    )
    .reduce((total, item) => total + item._count._all, 0);

  const failedDocuments = statusCounts
    .filter((item) => item.status === "FAILED")
    .reduce((total, item) => total + item._count._all, 0);

  const trend = Array.isArray(profile.cashFlowTrend)
    ? profile.cashFlowTrend.filter((value) => Number.isFinite(value))
    : [];

  let monthlyRevenueGrowthPercent = 1.5;

  if (trend.length >= 2) {
    const first = Math.abs(trend[0]);
    const last = trend[trend.length - 1];

    if (first > 0) {
      monthlyRevenueGrowthPercent = Math.max(
        -5,
        Math.min(6, ((last - trend[0]) / first / trend.length) * 100),
      );
    }
  } else if (currentMarginPercent !== null && currentMarginPercent < 0) {
    monthlyRevenueGrowthPercent = 0.5;
  }

  const monthlyExpenseGrowthPercent =
    currentMarginPercent !== null && currentMarginPercent < 0 ? 1.2 : 0.8;

  const monthlyRevenueGrowthRate = monthlyRevenueGrowthPercent / 100;
  const monthlyExpenseGrowthRate = monthlyExpenseGrowthPercent / 100;

  const estimatedMonthlyEmployeeCost =
    monthlyExpenses !== null
      ? Math.max(monthlyExpenses * 0.06, monthlyRevenue !== null ? monthlyRevenue * 0.025 : 0)
      : null;

  const confidence: ForecastReport["assumptions"]["confidence"] =
    approvedDocuments >= 4 && revenue !== null && expenses !== null
      ? "HIGH"
      : approvedDocuments >= 2 && revenue !== null && expenses !== null
        ? "MEDIUM"
        : "LOW";

  const confidenceReason =
    confidence === "HIGH"
      ? "Forecast has multiple approved documents and core revenue/expense data."
      : confidence === "MEDIUM"
        ? "Forecast has core revenue/expense data but limited approved document depth."
        : "Forecast needs more approved financial statements, invoices, and bank statements.";

  const periods = buildForecastPeriods({
    monthlyRevenue,
    monthlyExpenses,
    cash,
    revenueGrowthRate: monthlyRevenueGrowthRate,
    expenseGrowthRate: monthlyExpenseGrowthRate,
    currency,
  });

  const scenarios: ForecastScenario[] = [
    {
      id: "baseline",
      title: "Baseline forecast",
      description: "Current revenue and expense pattern continues.",
      assumption: `${monthlyRevenueGrowthPercent.toFixed(
        1,
      )}% monthly revenue growth and ${monthlyExpenseGrowthPercent.toFixed(
        1,
      )}% monthly expense growth.`,
      periods,
      recommendation: buildScenarioRecommendation({
        scenarioId: "baseline",
        periods,
        currency,
      }),
    },
    {
      id: "revenue_up_10",
      title: "Revenue increases by 10%",
      description: "Sales improve without increasing fixed costs heavily.",
      assumption: "Revenue is 10% higher from next month.",
      periods: buildForecastPeriods({
        monthlyRevenue,
        monthlyExpenses,
        cash,
        revenueGrowthRate: monthlyRevenueGrowthRate,
        expenseGrowthRate: monthlyExpenseGrowthRate,
        revenueMultiplier: 1.1,
        currency,
      }),
      recommendation: "",
    },
    {
      id: "expense_down_15",
      title: "Expenses reduce by 15%",
      description: "Cost control improves operating efficiency.",
      assumption: "Expenses are 15% lower from next month.",
      periods: buildForecastPeriods({
        monthlyRevenue,
        monthlyExpenses,
        cash,
        revenueGrowthRate: monthlyRevenueGrowthRate,
        expenseGrowthRate: monthlyExpenseGrowthRate,
        expenseMultiplier: 0.85,
        currency,
      }),
      recommendation: "",
    },
    {
      id: "sales_drop_20",
      title: "Sales drop by 20%",
      description: "Stress test for weak sales or delayed collections.",
      assumption: "Revenue is 20% lower from next month.",
      periods: buildForecastPeriods({
        monthlyRevenue,
        monthlyExpenses,
        cash,
        revenueGrowthRate: monthlyRevenueGrowthRate,
        expenseGrowthRate: monthlyExpenseGrowthRate,
        revenueMultiplier: 0.8,
        currency,
      }),
      recommendation: "",
    },
    {
      id: "hire_employee",
      title: "Hire one employee",
      description: "Tests whether another fixed monthly salary is affordable.",
      assumption:
        estimatedMonthlyEmployeeCost !== null
          ? `Adds estimated monthly employee cost of ${formatMoney(
              estimatedMonthlyEmployeeCost,
              currency,
            )}.`
          : "Employee cost could not be estimated because expense data is missing.",
      periods: buildForecastPeriods({
        monthlyRevenue,
        monthlyExpenses,
        cash,
        revenueGrowthRate: monthlyRevenueGrowthRate,
        expenseGrowthRate: monthlyExpenseGrowthRate,
        extraMonthlyExpense: estimatedMonthlyEmployeeCost ?? 0,
        currency,
      }),
      recommendation: "",
    },
  ];

  const scenariosWithRecommendations = scenarios.map((scenario) => ({
    ...scenario,
    recommendation:
      scenario.recommendation ||
      buildScenarioRecommendation({
        scenarioId: scenario.id,
        periods: scenario.periods,
        currency,
      }),
  }));

  const twelveMonthBase = periods.find((period) => period.months === 12);
  const status = twelveMonthBase?.status ?? "INSUFFICIENT_DATA";

  const summary =
    status === "INSUFFICIENT_DATA"
      ? "Forecast needs approved revenue and expense documents before it can become reliable."
      : status === "RISK"
        ? "Forecast shows financial risk. Profit or cash may turn negative without action."
        : status === "WATCH"
          ? "Forecast is not critical, but margins or cash position need monitoring."
          : "Forecast looks positive under current assumptions.";

  return {
    generatedAt: new Date().toISOString(),
    currency,
    status,
    summary,
    baseMetrics: {
      revenue,
      expenses,
      profit,
      cash,
      monthlyRevenue,
      monthlyExpenses,
      monthlyProfit,
      currentMarginPercent,
    },
    assumptions: {
      monthlyRevenueGrowthPercent,
      monthlyExpenseGrowthPercent,
      estimatedMonthlyEmployeeCost,
      confidence,
      confidenceReason,
    },
    periods,
    scenarios: scenariosWithRecommendations,
    dataCoverage: {
      processedDocuments,
      approvedDocuments,
      pendingDocuments,
      failedDocuments,
    },
  };
}

export function formatForecastMoney(value: number | null, currency: string) {
  return formatMoney(value, currency);
}
