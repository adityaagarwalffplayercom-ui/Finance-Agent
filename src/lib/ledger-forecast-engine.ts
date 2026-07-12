import {
  LedgerDirection,
  LedgerEntryStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ForecastStatus =
  | "POSITIVE"
  | "WATCH"
  | "RISK"
  | "INSUFFICIENT_DATA";

export type ForecastScenarioId =
  | "baseline"
  | "optimistic"
  | "conservative";

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
    confidenceScore: number;
    confidenceReason: string;
    observedMonths: number;
  };

  periods: ForecastPeriod[];
  scenarios: ForecastScenario[];

  dataCoverage: {
    totalEntries: number;
    approvedEntries: number;
    pendingEntries: number;
    rejectedEntries: number;
    observedMonths: number;
    datedEntries: number;
    sourceCount: number;
    excludedCurrencyEntries: number;

    // Compatibility with the existing Forecast page.
    processedDocuments: number;
    approvedDocuments: number;
    pendingDocuments: number;
    failedDocuments: number;
  };
};

type MonthlyPoint = {
  key: string;
  revenue: number;
  expenses: number;
  profit: number;
};

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

function removeTrailingZeros(
  value: string,
) {
  return value
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function compactNumber(value: number) {
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000_000) {
    const decimals =
      absolute >= 10_000_000_000
        ? 1
        : 2;

    return `${removeTrailingZeros(
      (
        absolute /
        1_000_000_000
      ).toFixed(decimals),
    )}B`;
  }

  if (absolute >= 1_000_000) {
    const decimals =
      absolute >= 10_000_000
        ? 1
        : 2;

    return `${removeTrailingZeros(
      (
        absolute /
        1_000_000
      ).toFixed(decimals),
    )}M`;
  }

  if (absolute >= 1_000) {
    const decimals =
      absolute >= 100_000
        ? 0
        : absolute >= 10_000
          ? 1
          : 2;

    return `${removeTrailingZeros(
      (
        absolute / 1_000
      ).toFixed(decimals),
    )}K`;
  }

  return absolute.toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 2,
    },
  );
}

function currencySymbol(
  currency: string,
) {
  const symbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    AED: "د.إ ",
    CAD: "C$",
    AUD: "A$",
  };

  return (
    symbols[currency.toUpperCase()] ??
    `${currency.toUpperCase()} `
  );
}

function formatMoney(
  value: number | null,
  currency: string,
) {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return "Not available";
  }

  const sign = value < 0 ? "-" : "";

  return `${sign}${currencySymbol(
    currency,
  )}${compactNumber(value)}`;
}

function calculateMargin(
  revenue: number | null,
  profit: number | null,
) {
  if (
    revenue === null ||
    profit === null ||
    revenue <= 0
  ) {
    return null;
  }

  return (profit / revenue) * 100;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return (
    values.reduce(
      (total, value) =>
        total + value,
      0,
    ) / values.length
  );
}

function deriveGrowthPercent(
  values: number[],
) {
  const usableValues = values
    .slice(-6)
    .filter(
      (value) =>
        Number.isFinite(value) &&
        value > 0,
    );

  if (usableValues.length < 2) {
    return 0;
  }

  const first = usableValues[0];
  const last =
    usableValues[
      usableValues.length - 1
    ];

  if (first <= 0 || last <= 0) {
    return 0;
  }

  const periods =
    usableValues.length - 1;

  const compoundGrowth =
    Math.pow(
      last / first,
      1 / periods,
    ) - 1;

  return clamp(
    compoundGrowth * 100,
    -8,
    8,
  );
}

function forecastStatus(params: {
  projectedProfit: number | null;
  marginPercent: number | null;
}): ForecastStatus {
  if (
    params.projectedProfit === null
  ) {
    return "INSUFFICIENT_DATA";
  }

  if (params.projectedProfit < 0) {
    return "RISK";
  }

  if (
    params.marginPercent !== null &&
    params.marginPercent < 5
  ) {
    return "WATCH";
  }

  return "POSITIVE";
}

function buildPeriodSummary(params: {
  months: number;
  projectedProfit: number | null;
  marginPercent: number | null;
  currency: string;
}) {
  if (
    params.projectedProfit === null
  ) {
    return "Approved credit and debit ledger history is required for this forecast.";
  }

  if (
    params.projectedProfit < 0
  ) {
    return `The ${params.months}-month projection shows cumulative loss of ${formatMoney(
      Math.abs(
        params.projectedProfit,
      ),
      params.currency,
    )}.`;
  }

  if (
    params.marginPercent !== null &&
    params.marginPercent < 5
  ) {
    return `The ${params.months}-month projection remains profitable, but margin is thin at ${params.marginPercent.toFixed(
      1,
    )}%.`;
  }

  return `The ${params.months}-month projection shows cumulative profit of ${formatMoney(
    params.projectedProfit,
    params.currency,
  )}.`;
}

function buildForecastPeriods(params: {
  monthlyRevenue: number | null;
  monthlyExpenses: number | null;
  revenueGrowthRate: number;
  expenseGrowthRate: number;
  revenueMultiplier?: number;
  expenseMultiplier?: number;
  currency: string;
}): ForecastPeriod[] {
  const periods = [3, 6, 12];

  return periods.map((months) => {
    if (
      params.monthlyRevenue === null ||
      params.monthlyExpenses === null
    ) {
      return {
        months,
        projectedRevenue: null,
        projectedExpenses: null,
        projectedProfit: null,
        projectedCash: null,
        marginPercent: null,
        status:
          "INSUFFICIENT_DATA",
        summary:
          "Approve credit and debit ledger entries to generate this forecast.",
      };
    }

    let projectedRevenue = 0;
    let projectedExpenses = 0;

    const revenueMultiplier =
      params.revenueMultiplier ?? 1;

    const expenseMultiplier =
      params.expenseMultiplier ?? 1;

    for (
      let month = 1;
      month <= months;
      month += 1
    ) {
      const monthRevenue =
        params.monthlyRevenue *
        revenueMultiplier *
        Math.pow(
          1 +
            params.revenueGrowthRate,
          month - 1,
        );

      const monthExpenses =
        params.monthlyExpenses *
        expenseMultiplier *
        Math.pow(
          1 +
            params.expenseGrowthRate,
          month - 1,
        );

      projectedRevenue +=
        monthRevenue;

      projectedExpenses +=
        monthExpenses;
    }

    const projectedProfit =
      projectedRevenue -
      projectedExpenses;

    const marginPercent =
      calculateMargin(
        projectedRevenue,
        projectedProfit,
      );

    const status = forecastStatus({
      projectedProfit,
      marginPercent,
    });

    return {
      months,
      projectedRevenue,
      projectedExpenses,
      projectedProfit,

      /*
       * Profit or net movement is not
       * the same as verified cash.
       */
      projectedCash: null,

      marginPercent,
      status,

      summary:
        buildPeriodSummary({
          months,
          projectedProfit,
          marginPercent,
          currency:
            params.currency,
        }),
    };
  });
}

function recommendationForScenario(
  scenario: ForecastScenario,
  currency: string,
) {
  const twelveMonth =
    scenario.periods.find(
      (period) =>
        period.months === 12,
    );

  if (
    !twelveMonth ||
    twelveMonth.projectedProfit ===
      null
  ) {
    return "More reviewed ledger history is required before this scenario can be relied upon.";
  }

  if (
    twelveMonth.projectedProfit < 0
  ) {
    return `This scenario produces projected 12-month loss of ${formatMoney(
      Math.abs(
        twelveMonth.projectedProfit,
      ),
      currency,
    )}. Expense control or higher inflow is required.`;
  }

  if (scenario.id === "conservative") {
    return `Even under conservative assumptions, projected 12-month profit is ${formatMoney(
      twelveMonth.projectedProfit,
      currency,
    )}. Continue monitoring actual monthly movement.`;
  }

  if (scenario.id === "optimistic") {
    return `Under improved growth and cost control, projected 12-month profit reaches ${formatMoney(
      twelveMonth.projectedProfit,
      currency,
    )}.`;
  }

  return `The baseline produces projected 12-month profit of ${formatMoney(
    twelveMonth.projectedProfit,
    currency,
  )}.`;
}

function percentage(
  numerator: number,
  denominator: number,
) {
  if (denominator <= 0) {
    return 0;
  }

  return (
    numerator / denominator
  ) * 100;
}

export async function getForecastReport(
  userId: string,
): Promise<ForecastReport> {
  const [business, entries] =
    await Promise.all([
      prisma.business.findUnique({
        where: {
          userId,
        },
        select: {
          currency: true,
        },
      }),

      prisma.ledgerEntry.findMany({
        where: {
          userId,
        },
        select: {
          id: true,
          status: true,
          direction: true,
          amount: true,
          currency: true,
          transactionDate: true,
          createdAt: true,
          documentId: true,
          sourceType: true,
        },
        orderBy: [
          {
            transactionDate: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      }),
    ]);

  const configuredCurrency = (
    business?.currency ?? "INR"
  )
    .trim()
    .toUpperCase();

  const allFinancialEntries =
    entries.filter(
      (entry) =>
        entry.direction ===
          LedgerDirection.CREDIT ||
        entry.direction ===
          LedgerDirection.DEBIT,
    );

  const approvedFinancialEntries =
    allFinancialEntries.filter(
      (entry) =>
        entry.status ===
        LedgerEntryStatus.APPROVED,
    );

  const pendingEntries =
    entries.filter(
      (entry) =>
        entry.status ===
        LedgerEntryStatus.NEEDS_REVIEW,
    ).length;

  const rejectedEntries =
    entries.filter(
      (entry) =>
        entry.status ===
        LedgerEntryStatus.REJECTED,
    ).length;

  const currencyCounts = new Map<
    string,
    number
  >();

  for (
    const entry of
    approvedFinancialEntries
  ) {
    const entryCurrency =
      entry.currency
        .trim()
        .toUpperCase() || "INR";

    currencyCounts.set(
      entryCurrency,
      (currencyCounts.get(
        entryCurrency,
      ) ?? 0) + 1,
    );
  }

  const dominantCurrency =
    Array.from(
      currencyCounts.entries(),
    ).sort(
      (first, second) =>
        second[1] - first[1],
    )[0]?.[0];

  const currency =
    currencyCounts.has(
      configuredCurrency,
    )
      ? configuredCurrency
      : dominantCurrency ??
        configuredCurrency;

  const trustedEntries =
    approvedFinancialEntries.filter(
      (entry) =>
        entry.currency
          .trim()
          .toUpperCase() ===
        currency,
    );

  const excludedCurrencyEntries =
    approvedFinancialEntries.length -
    trustedEntries.length;

  const monthlyMap = new Map<
    string,
    MonthlyPoint
  >();

  for (const entry of trustedEntries) {
    const date =
      entry.transactionDate ??
      entry.createdAt;

    const key = monthKey(date);

    const current =
      monthlyMap.get(key) ?? {
        key,
        revenue: 0,
        expenses: 0,
        profit: 0,
      };

    const amount =
      Number(entry.amount);

    if (
      entry.direction ===
      LedgerDirection.CREDIT
    ) {
      current.revenue += amount;
    }

    if (
      entry.direction ===
      LedgerDirection.DEBIT
    ) {
      current.expenses += amount;
    }

    current.profit =
      current.revenue -
      current.expenses;

    monthlyMap.set(key, current);
  }

  const monthlyPoints =
    Array.from(
      monthlyMap.values(),
    ).sort((first, second) =>
      first.key.localeCompare(
        second.key,
      ),
    );

  const recentPoints =
    monthlyPoints.slice(-6);

  const monthlyRevenue = average(
    recentPoints.map(
      (point) => point.revenue,
    ),
  );

  const monthlyExpenses = average(
    recentPoints.map(
      (point) => point.expenses,
    ),
  );

  const monthlyProfit =
    monthlyRevenue !== null &&
    monthlyExpenses !== null
      ? monthlyRevenue -
        monthlyExpenses
      : null;

  const revenue =
    trustedEntries
      .filter(
        (entry) =>
          entry.direction ===
          LedgerDirection.CREDIT,
      )
      .reduce(
        (total, entry) =>
          total +
          Number(entry.amount),
        0,
      );

  const expenses =
    trustedEntries
      .filter(
        (entry) =>
          entry.direction ===
          LedgerDirection.DEBIT,
      )
      .reduce(
        (total, entry) =>
          total +
          Number(entry.amount),
        0,
      );

  const profit =
    trustedEntries.length > 0
      ? revenue - expenses
      : null;

  const currentMarginPercent =
    calculateMargin(
      monthlyRevenue,
      monthlyProfit,
    );

  const monthlyRevenueGrowthPercent =
    deriveGrowthPercent(
      monthlyPoints.map(
        (point) => point.revenue,
      ),
    );

  const monthlyExpenseGrowthPercent =
    deriveGrowthPercent(
      monthlyPoints.map(
        (point) => point.expenses,
      ),
    );

  const datedEntries =
    trustedEntries.filter(
      (entry) =>
        entry.transactionDate !==
        null,
    ).length;

  const reviewedFinancialEntries =
    allFinancialEntries.filter(
      (entry) =>
        entry.status ===
          LedgerEntryStatus.APPROVED ||
        entry.status ===
          LedgerEntryStatus.REJECTED,
    ).length;

  const reviewCoverage =
    percentage(
      reviewedFinancialEntries,
      allFinancialEntries.length,
    );

  const dateCoverage =
    percentage(
      datedEntries,
      trustedEntries.length,
    );

  const currencyConsistency =
    percentage(
      trustedEntries.length,
      approvedFinancialEntries.length,
    );

  const documentSources = new Set(
    trustedEntries
      .map(
        (entry) =>
          entry.documentId,
      )
      .filter(
        (
          documentId,
        ): documentId is string =>
          Boolean(documentId),
      ),
  );

  const hasManualSource =
    trustedEntries.some(
      (entry) =>
        entry.sourceType ===
        "MANUAL",
    );

  const sourceCount =
    documentSources.size +
    (hasManualSource ? 1 : 0);

  let confidenceScore =
    reviewCoverage * 0.25 +
    dateCoverage * 0.20 +
    Math.min(
      trustedEntries.length / 12,
      1,
    ) *
      20 +
    Math.min(
      monthlyPoints.length / 6,
      1,
    ) *
      20 +
    Math.min(sourceCount / 3, 1) *
      10 +
    currencyConsistency * 0.05;

  if (trustedEntries.length === 0) {
    confidenceScore = 0;
  } else if (
    trustedEntries.length < 3
  ) {
    confidenceScore = Math.min(
      confidenceScore,
      35,
    );
  } else if (
    monthlyPoints.length < 2
  ) {
    confidenceScore = Math.min(
      confidenceScore,
      48,
    );
  } else if (
    monthlyPoints.length < 3
  ) {
    confidenceScore = Math.min(
      confidenceScore,
      65,
    );
  }

  confidenceScore = Math.round(
    clamp(confidenceScore, 0, 100),
  );

  const confidence:
    ForecastReport["assumptions"]["confidence"] =
    confidenceScore >= 75
      ? "HIGH"
      : confidenceScore >= 50
        ? "MEDIUM"
        : "LOW";

  const confidenceReason =
    trustedEntries.length === 0
      ? "No approved credit or debit entries are available for forecasting."
      : confidence === "HIGH"
        ? `High confidence from ${trustedEntries.length} approved entries across ${monthlyPoints.length} months.`
        : confidence === "MEDIUM"
          ? `Medium confidence: ${trustedEntries.length} approved entries across ${monthlyPoints.length} months. More history will improve reliability.`
          : `Low-confidence forecast: only ${trustedEntries.length} approved entries across ${monthlyPoints.length} months are available.`;

  const estimatedMonthlyEmployeeCost =
    monthlyExpenses !== null
      ? Math.max(
          monthlyExpenses * 0.06,
          (monthlyRevenue ?? 0) *
            0.025,
        )
      : null;

  const baselinePeriods =
    buildForecastPeriods({
      monthlyRevenue,
      monthlyExpenses,

      revenueGrowthRate:
        monthlyRevenueGrowthPercent /
        100,

      expenseGrowthRate:
        monthlyExpenseGrowthPercent /
        100,

      currency,
    });

  const optimisticPeriods =
    buildForecastPeriods({
      monthlyRevenue,
      monthlyExpenses,

      revenueGrowthRate:
        clamp(
          monthlyRevenueGrowthPercent +
            2,
          -5,
          10,
        ) / 100,

      expenseGrowthRate:
        clamp(
          monthlyExpenseGrowthPercent -
            1,
          -5,
          8,
        ) / 100,

      revenueMultiplier: 1.05,
      expenseMultiplier: 0.98,
      currency,
    });

  const conservativePeriods =
    buildForecastPeriods({
      monthlyRevenue,
      monthlyExpenses,

      revenueGrowthRate:
        clamp(
          monthlyRevenueGrowthPercent -
            2.5,
          -10,
          8,
        ) / 100,

      expenseGrowthRate:
        clamp(
          monthlyExpenseGrowthPercent +
            1.5,
          -5,
          10,
        ) / 100,

      revenueMultiplier: 0.95,
      expenseMultiplier: 1.05,
      currency,
    });

  const scenariosWithoutRecommendations:
    ForecastScenario[] = [
      {
        id: "baseline",
        title: "Baseline forecast",
        description:
          "Current approved ledger pattern continues.",
        assumption:
          `${monthlyRevenueGrowthPercent.toFixed(
            1,
          )}% monthly credit growth and ${monthlyExpenseGrowthPercent.toFixed(
            1,
          )}% monthly debit growth.`,
        periods: baselinePeriods,
        recommendation: "",
      },

      {
        id: "optimistic",
        title: "Optimistic scenario",
        description:
          "Revenue improves while expense growth is controlled.",
        assumption:
          "Starting monthly revenue improves by 5%, expenses reduce by 2%, and future revenue growth strengthens.",
        periods: optimisticPeriods,
        recommendation: "",
      },

      {
        id: "conservative",
        title: "Conservative scenario",
        description:
          "Revenue weakens while expense pressure increases.",
        assumption:
          "Starting monthly revenue falls by 5%, expenses rise by 5%, and future growth becomes less favourable.",
        periods:
          conservativePeriods,
        recommendation: "",
      },
    ];

  const scenarios =
    scenariosWithoutRecommendations.map(
      (scenario) => ({
        ...scenario,
        recommendation:
          recommendationForScenario(
            scenario,
            currency,
          ),
      }),
    );

  const twelveMonthBaseline =
    baselinePeriods.find(
      (period) =>
        period.months === 12,
    );

  let status =
    twelveMonthBaseline?.status ??
    "INSUFFICIENT_DATA";

  if (
    confidence === "LOW" &&
    status === "POSITIVE"
  ) {
    status = "WATCH";
  }

  const summary =
    status === "INSUFFICIENT_DATA"
      ? "Forecast needs approved credit and debit ledger entries before projections can be generated."
      : confidence === "LOW"
        ? `This is a provisional low-confidence forecast based on ${trustedEntries.length} approved entries across ${monthlyPoints.length} months.`
        : status === "RISK"
          ? "The ledger-based forecast shows projected loss under the baseline assumptions."
          : status === "WATCH"
            ? "The forecast requires monitoring because margins, projected profit, or data confidence remain weak."
            : "The approved ledger forecast remains positive under baseline assumptions.";

  return {
    generatedAt:
      new Date().toISOString(),

    currency,
    status,
    summary,

    baseMetrics: {
      revenue:
        trustedEntries.length > 0
          ? revenue
          : null,

      expenses:
        trustedEntries.length > 0
          ? expenses
          : null,

      profit,

      // Verified bank cash balance
      // is not yet stored.
      cash: null,

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
      confidenceScore,
      confidenceReason,
      observedMonths:
        monthlyPoints.length,
    },

    periods: baselinePeriods,
    scenarios,

    dataCoverage: {
      totalEntries: entries.length,
      approvedEntries:
        trustedEntries.length,
      pendingEntries,
      rejectedEntries,
      observedMonths:
        monthlyPoints.length,
      datedEntries,
      sourceCount,
      excludedCurrencyEntries,

      processedDocuments:
        entries.length,
      approvedDocuments:
        trustedEntries.length,
      pendingDocuments:
        pendingEntries,
      failedDocuments:
        rejectedEntries,
    },
  };
}

export function formatForecastMoney(
  value: number | null,
  currency: string,
) {
  return formatMoney(
    value,
    currency,
  );
}