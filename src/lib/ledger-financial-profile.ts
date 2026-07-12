import {
  LedgerDirection,
  LedgerEntryStatus,
} from "@prisma/client";
import type {
  Alert,
  ExecutiveRecommendation,
  FinancialMetric,
  FinancialProfile,
} from "./financial-profile";
import { prisma } from "./prisma";

type MonthlyPoint = {
  key: string;
  label: string;
  credits: number;
  debits: number;
  net: number;
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

function removeTrailingZeros(value: string) {
  return value
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function formatCompactNumber(value: number) {
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1_000_000_000) {
    const decimals =
      absoluteValue >= 10_000_000_000
        ? 1
        : 2;

    return `${removeTrailingZeros(
      (
        absoluteValue /
        1_000_000_000
      ).toFixed(decimals),
    )}B`;
  }

  if (absoluteValue >= 1_000_000) {
    const decimals =
      absoluteValue >= 10_000_000
        ? 1
        : 2;

    return `${removeTrailingZeros(
      (
        absoluteValue /
        1_000_000
      ).toFixed(decimals),
    )}M`;
  }

  if (absoluteValue >= 1_000) {
    const decimals =
      absoluteValue >= 100_000
        ? 0
        : absoluteValue >= 10_000
          ? 1
          : 2;

    return `${removeTrailingZeros(
      (
        absoluteValue /
        1_000
      ).toFixed(decimals),
    )}K`;
  }

  return absoluteValue.toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 2,
    },
  );
}

function currencySymbol(currency: string) {
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
  value: number,
  currency: string,
) {
  const sign = value < 0 ? "-" : "";

  return `${sign}${currencySymbol(
    currency,
  )}${formatCompactNumber(value)}`;
}

function formatPct(value: number | null) {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return "-";
  }

  return `${value.toFixed(2)}%`;
}

function growthPercentage(
  currentValue: number,
  previousValue: number,
) {
  if (
    previousValue <= 0 ||
    !Number.isFinite(previousValue)
  ) {
    return null;
  }

  return (
    ((currentValue - previousValue) /
      previousValue) *
    100
  );
}

function growthMessage(
  label: string,
  currentValue: number,
  previousValue: number,
) {
  const growth = growthPercentage(
    currentValue,
    previousValue,
  );

  if (growth === null) {
    return `From approved ledger ${label}`;
  }

  if (growth > 0.01) {
    return `Up ${growth.toFixed(
      1,
    )}% vs previous month`;
  }

  if (growth < -0.01) {
    return `Down ${Math.abs(
      growth,
    ).toFixed(1)}% vs previous month`;
  }

  return "No material monthly change";
}

function getMonthKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0"),
  ].join("-");
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function riskLabel(score: number) {
  if (score >= 78) {
    return "Healthy";
  }

  if (score >= 58) {
    return "Needs monitoring";
  }

  if (score >= 38) {
    return "High financial risk";
  }

  return "Critical risk - act soon";
}

function riskLevel(score: number) {
  if (score >= 78) {
    return "LOW";
  }

  if (score >= 58) {
    return "MEDIUM";
  }

  if (score >= 38) {
    return "HIGH";
  }

  return "CRITICAL";
}

function createEmptyProfile(params: {
  approvedCount: number;
  reviewCount: number;
}): FinancialProfile {
  const alerts: Alert[] = [];

  if (params.reviewCount > 0) {
    alerts.push({
      id: "ledger-review-pending",
      severity: "warning",
      message:
        `${params.reviewCount} ledger entr${
          params.reviewCount === 1
            ? "y needs"
            : "ies need"
        } review before dashboard totals can include them.`,
    });
  } else {
    alerts.push({
      id: "ledger-empty",
      severity: "info",
      message:
        "No approved credit or debit entries are available in the transaction ledger.",
    });
  }

  return {
    hasData: false,
    processedCount:
      params.approvedCount,
    healthScore: 50,
    healthLabel:
      "Not enough trusted ledger data yet",

    revenue: {
      value: "-",
      delta:
        "Approve credit entries to calculate revenue",
    },

    expenses: {
      value: "-",
      delta:
        "Approve debit entries to calculate expenses",
    },

    profit: {
      value: "-",
      delta:
        "Approved credits and debits are required",
    },

    cash: {
      value: "-",
      delta:
        "A verified cash balance is not available",
    },

    cashFlowTrend: [],
    cashFlowCaption:
      "Approve dated ledger entries to build a trend",

    alerts,

    executiveSummary:
      "Aureli has not found enough approved credit and debit ledger entries to calculate a trusted financial position.",

    recommendations: [
      {
        id: "review-ledger",
        priority: "high",
        title:
          "Complete the ledger review",
        action:
          "Open Transaction Ledger, review pending entries, and approve only verified credits and debits.",
      },
    ],

    metrics: [
      {
        id: "trusted-ledger-status",
        label: "Trusted ledger status",
        value:
          params.reviewCount > 0
            ? `${params.reviewCount} pending`
            : "No financial entries",
        description:
          "Only approved credit and debit entries are included in dashboard totals.",
      },
    ],
  };
}

export async function getFinancialProfile(
  userId: string,
): Promise<FinancialProfile> {
  const [
    business,
    approvedEntries,
    reviewCount,
    rejectedCount,
  ] = await Promise.all([
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
        status:
          LedgerEntryStatus.APPROVED,
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        direction: true,
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

    prisma.ledgerEntry.count({
      where: {
        userId,
        status:
          LedgerEntryStatus.NEEDS_REVIEW,
      },
    }),

    prisma.ledgerEntry.count({
      where: {
        userId,
        status:
          LedgerEntryStatus.REJECTED,
      },
    }),
  ]);

  const configuredCurrency = (
    business?.currency ?? "INR"
  )
    .trim()
    .toUpperCase();

  const currencyCounts = new Map<
    string,
    number
  >();

  for (const entry of approvedEntries) {
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

  const currencyEntries =
    approvedEntries.filter(
      (entry) =>
        entry.currency
          .trim()
          .toUpperCase() === currency,
    );

  const financialEntries =
    currencyEntries.filter(
      (entry) =>
        entry.direction ===
          LedgerDirection.CREDIT ||
        entry.direction ===
          LedgerDirection.DEBIT,
    );

  if (financialEntries.length === 0) {
    return createEmptyProfile({
      approvedCount:
        approvedEntries.length,
      reviewCount,
    });
  }

  const creditEntries =
    financialEntries.filter(
      (entry) =>
        entry.direction ===
        LedgerDirection.CREDIT,
    );

  const debitEntries =
    financialEntries.filter(
      (entry) =>
        entry.direction ===
        LedgerDirection.DEBIT,
    );

  const revenue = creditEntries.reduce(
    (total, entry) =>
      total + Number(entry.amount),
    0,
  );

  const expenses = debitEntries.reduce(
    (total, entry) =>
      total + Number(entry.amount),
    0,
  );

  const profit = revenue - expenses;

  const profitMarginPct =
    revenue > 0
      ? (profit / revenue) * 100
      : null;

  const expenseRatioPct =
    revenue > 0
      ? (expenses / revenue) * 100
      : null;

  const revenueCoveragePct =
    expenses > 0
      ? (revenue / expenses) * 100
      : revenue > 0
        ? 100
        : null;

  const monthlyMap = new Map<
    string,
    MonthlyPoint
  >();

  let missingTransactionDates = 0;

  for (const entry of financialEntries) {
    if (!entry.transactionDate) {
      missingTransactionDates += 1;
    }

    const date =
      entry.transactionDate ??
      entry.createdAt;

    const key = getMonthKey(date);

    const existing =
      monthlyMap.get(key) ?? {
        key,
        label: getMonthLabel(date),
        credits: 0,
        debits: 0,
        net: 0,
      };

    const amount =
      Number(entry.amount);

    if (
      entry.direction ===
      LedgerDirection.CREDIT
    ) {
      existing.credits += amount;
    }

    if (
      entry.direction ===
      LedgerDirection.DEBIT
    ) {
      existing.debits += amount;
    }

    existing.net =
      existing.credits -
      existing.debits;

    monthlyMap.set(key, existing);
  }

  const monthlyPoints =
    Array.from(
      monthlyMap.values(),
    ).sort((first, second) =>
      first.key.localeCompare(
        second.key,
      ),
    );

  const latestMonth =
    monthlyPoints.at(-1);

  const previousMonth =
    monthlyPoints.at(-2);

  const negativeMonths =
    monthlyPoints.filter(
      (point) => point.net < 0,
    );

  const monthlyBurnRate =
    negativeMonths.length > 0
      ? negativeMonths.reduce(
          (total, point) =>
            total +
            Math.abs(point.net),
          0,
        ) / negativeMonths.length
      : null;

  let healthScore = 62;

  if (revenue <= 0 && expenses > 0) {
    healthScore -= 35;
  } else if (profit >= 0) {
    healthScore += 16;
  } else {
    healthScore -= 24;
  }

  if (
    expenseRatioPct !== null
  ) {
    if (expenseRatioPct <= 70) {
      healthScore += 10;
    } else if (
      expenseRatioPct <= 100
    ) {
      healthScore += 2;
    } else {
      healthScore -= 15;
    }
  }

  if (financialEntries.length >= 10) {
    healthScore += 5;
  }

  healthScore -= Math.min(
    reviewCount * 2,
    18,
  );

  const excludedCurrencyCount =
    approvedEntries.length -
    currencyEntries.length;

  if (excludedCurrencyCount > 0) {
    healthScore -= 3;
  }

  healthScore = Math.round(
    clamp(healthScore, 0, 100),
  );

  const alerts: Alert[] = [];

  if (profit < 0) {
    alerts.push({
      id: "ledger-loss",
      severity: "critical",
      message:
        `Approved ledger entries show a loss of ${formatMoney(
          Math.abs(profit),
          currency,
        )}.`,
    });
  }

  if (
    expenseRatioPct !== null &&
    expenseRatioPct > 100
  ) {
    alerts.push({
      id: "ledger-expense-ratio",
      severity: "critical",
      message:
        `Expenses are ${expenseRatioPct.toFixed(
          1,
        )}% of approved revenue.`,
    });
  } else if (
    expenseRatioPct !== null &&
    expenseRatioPct > 80
  ) {
    alerts.push({
      id: "ledger-expense-warning",
      severity: "warning",
      message:
        `Expenses are consuming ${expenseRatioPct.toFixed(
          1,
        )}% of approved revenue.`,
    });
  }

  if (reviewCount > 0) {
    alerts.push({
      id: "ledger-review-count",
      severity: "warning",
      message:
        `${reviewCount} ledger entr${
          reviewCount === 1
            ? "y is"
            : "ies are"
        } excluded while awaiting review.`,
    });
  }

  if (excludedCurrencyCount > 0) {
    alerts.push({
      id: "ledger-mixed-currency",
      severity: "info",
      message:
        `${excludedCurrencyCount} approved entr${
          excludedCurrencyCount === 1
            ? "y uses"
            : "ies use"
        } another currency and ${
          excludedCurrencyCount === 1
            ? "is"
            : "are"
        } excluded from ${currency} totals.`,
    });
  }

  if (missingTransactionDates > 0) {
    alerts.push({
      id: "ledger-missing-dates",
      severity: "info",
      message:
        `${missingTransactionDates} approved entr${
          missingTransactionDates === 1
            ? "y has"
            : "ies have"
        } no transaction date; creation date was used for the monthly trend.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "ledger-steady",
      severity: "info",
      message:
        "Approved ledger credits currently cover approved debits.",
    });
  }

  const recommendations:
    ExecutiveRecommendation[] = [];

  if (profit < 0) {
    recommendations.push({
      id: "restore-profit",
      priority: "high",
      title:
        "Close the approved ledger loss",
      action:
        `Reduce debits or increase credits by at least ${formatMoney(
          Math.abs(profit),
          currency,
        )} to reach break-even.`,
    });
  }

  if (
    expenseRatioPct !== null &&
    expenseRatioPct > 80
  ) {
    recommendations.push({
      id: "control-ledger-debits",
      priority:
        expenseRatioPct > 100
          ? "high"
          : "medium",
      title:
        "Review the largest debit categories",
      action:
        "Open Transaction Ledger, filter by Debit, and verify which recurring costs can be reduced.",
    });
  }

  if (reviewCount > 0) {
    recommendations.push({
      id: "complete-ledger-review",
      priority: "high",
      title:
        "Complete pending ledger review",
      action:
        `Review ${reviewCount} pending entr${
          reviewCount === 1
            ? "y"
            : "ies"
        } so the dashboard uses the complete trusted dataset.`,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "maintain-ledger",
      priority: "low",
      title:
        "Keep the ledger current",
      action:
        "Sync approved documents regularly and record offline transactions when they happen.",
    });
  }

  const metrics: FinancialMetric[] = [
    {
      id: "profit-margin",
      label: "Profit margin",
      value:
        formatPct(profitMarginPct),
      description:
        "Approved profit divided by approved credits.",
    },
    {
      id: "expense-ratio",
      label: "Expense ratio",
      value:
        formatPct(expenseRatioPct),
      description:
        "Approved debits as a percentage of approved credits.",
    },
    {
      id: "revenue-coverage",
      label: "Revenue coverage",
      value:
        formatPct(revenueCoveragePct),
      description:
        "How much of approved debits are covered by approved credits.",
    },
    {
      id: "risk-level",
      label: "Risk level",
      value:
        riskLevel(healthScore),
      description:
        "Risk calculated from approved ledger movement and pending review volume.",
    },
    {
      id: "monthly-burn-rate",
      label: "Monthly burn",
      value:
        monthlyBurnRate === null
          ? "-"
          : formatMoney(
              monthlyBurnRate,
              currency,
            ),
      description:
        "Average negative net movement across loss-making months.",
    },
    {
      id: "cash-runway",
      label: "Cash runway",
      value: "-",
      description:
        "A verified opening or closing cash balance is required for runway.",
    },
  ];

  const uniqueDocuments =
    new Set(
      financialEntries
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
    ).size;

  const manualEntries =
    financialEntries.filter(
      (entry) =>
        entry.sourceType === "MANUAL",
    ).length;

  const currentCredits =
    latestMonth?.credits ?? revenue;

  const previousCredits =
    previousMonth?.credits ?? 0;

  const currentDebits =
    latestMonth?.debits ?? expenses;

  const previousDebits =
    previousMonth?.debits ?? 0;

  const cashFlowTrend =
    monthlyPoints
      .slice(-12)
      .map((point) => {
        if (
          Math.abs(point.net) >=
          1_000_000
        ) {
          return Math.round(
            point.net / 1_000_000,
          );
        }

        return Math.round(point.net);
      });

  return {
    hasData: true,

    processedCount:
      financialEntries.length,

    healthScore,

    healthLabel:
      riskLabel(healthScore),

    revenue: {
      value:
        formatMoney(
          revenue,
          currency,
        ),
      delta:
        growthMessage(
          "credits",
          currentCredits,
          previousCredits,
        ),
    },

    expenses: {
      value:
        formatMoney(
          expenses,
          currency,
        ),
      delta:
        growthMessage(
          "debits",
          currentDebits,
          previousDebits,
        ),
    },

    profit: {
      value:
        formatMoney(
          profit,
          currency,
        ),
      delta:
        profit >= 0
          ? `Margin ${formatPct(
              profitMarginPct,
            )}`
          : `Loss from approved ledger entries`,
    },

    cash: {
      value: "-",
      delta:
        "Cash balance requires a verified opening or closing balance",
    },

    cashFlowTrend,

    cashFlowCaption:
      monthlyPoints.length >= 2
        ? `Net approved ledger movement across ${monthlyPoints.length} month(s)`
        : "Add dated entries across more months to build a trend",

    alerts:
      alerts.slice(0, 5),

    executiveSummary:
      `Trusted ledger analysis includes ${financialEntries.length} approved financial entr${
        financialEntries.length === 1
          ? "y"
          : "ies"
      } from ${uniqueDocuments} source document${
        uniqueDocuments === 1
          ? ""
          : "s"
      } and ${manualEntries} manual entr${
        manualEntries === 1
          ? "y"
          : "ies"
      }. Approved credits are ${formatMoney(
        revenue,
        currency,
      )}, approved debits are ${formatMoney(
        expenses,
        currency,
      )}, producing ${
        profit >= 0
          ? "a profit"
          : "a loss"
      } of ${formatMoney(
        Math.abs(profit),
        currency,
      )}.`,

    recommendations:
      recommendations.slice(0, 5),

    metrics,
  };
}