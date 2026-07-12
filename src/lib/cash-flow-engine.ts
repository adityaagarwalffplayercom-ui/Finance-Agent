import {
  LedgerDirection,
  LedgerEntryStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CashFlowTone =
  | "good"
  | "warning"
  | "danger"
  | "neutral";

export type CashFlowMetric = {
  label: string;
  value: string;
  hint: string;
  tone: CashFlowTone;
};

export type CashFlowSignal = {
  id: string;
  severity:
    | "HIGH"
    | "MEDIUM"
    | "LOW";
  title: string;
  detail: string;
  amount: number | null;
  tone: CashFlowTone;
};

export type CashFlowAction = {
  priority:
    | "HIGH"
    | "MEDIUM"
    | "LOW";
  title: string;
  detail: string;
};

export type CashFlowLineItem = {
  id: string;
  label: string;
  amount: number;
  absoluteAmount: number;
  type:
    | "INFLOW"
    | "OUTFLOW"
    | "UNKNOWN";
  sourceFileName: string;
  sourceCategory: string;
};

export type CashFlowReport = {
  generatedAt: string;
  currency: string;
  summary: string;
  status:
    | "HEALTHY"
    | "WATCH"
    | "CRITICAL"
    | "INSUFFICIENT_DATA";
  score: number;

  metrics: {
    cash: number | null;
    revenue: number | null;
    expenses: number | null;
    profit: number | null;
    estimatedMonthlyBurn:
      | number
      | null;
    estimatedMonthlyInflow:
      | number
      | null;
    estimatedMonthlyOutflow:
      | number
      | null;
    netMonthlyCashFlow:
      | number
      | null;
    runwayMonths: number | null;
    threeMonthCashNeed:
      | number
      | null;
    sixMonthCashNeed:
      | number
      | null;
    cashGapForThreeMonths:
      | number
      | null;
  };

  cards: CashFlowMetric[];
  signals: CashFlowSignal[];
  actions: CashFlowAction[];
  topInflows: CashFlowLineItem[];
  topOutflows: CashFlowLineItem[];

  documentCoverage: {
    id: string;
    fileName: string;
    category: string;
    lineItemCount: number;
    cashSignalCount: number;
  }[];
};

type MonthlyMovement = {
  key: string;
  inflow: number;
  outflow: number;
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

function getMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

function makeSummary(params: {
  financialEntryCount: number;
  observedMonths: number;
  estimatedMonthlyInflow:
    | number
    | null;
  estimatedMonthlyOutflow:
    | number
    | null;
  netMonthlyCashFlow:
    | number
    | null;
  pendingCount: number;
  currency: string;
}) {
  if (
    params.financialEntryCount === 0
  ) {
    return "Cash flow needs approved credit and debit ledger entries before movement can be calculated.";
  }

  const netText = formatMoney(
    params.netMonthlyCashFlow,
    params.currency,
  );

  const direction =
    (params.netMonthlyCashFlow ?? 0) >= 0
      ? "positive"
      : "negative";

  return `Based on ${params.financialEntryCount} approved ledger entries across ${params.observedMonths} month${
    params.observedMonths === 1
      ? ""
      : "s"
  }, average monthly net movement is ${netText} and is currently ${direction}. ${params.pendingCount} entr${
    params.pendingCount === 1
      ? "y remains"
      : "ies remain"
  } excluded while awaiting review.`;
}

export async function getCashFlowReport(
  userId: string,
): Promise<CashFlowReport> {
  const [
    business,
    approvedEntries,
    pendingCount,
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
        description: true,
        counterparty: true,
        category: true,
        amount: true,
        currency: true,
        direction: true,
        transactionDate: true,
        createdAt: true,
        sourceType: true,
        documentId: true,

        document: {
          select: {
            id: true,
            fileName: true,
            category: true,
          },
        },
      },
      orderBy: [
        {
          transactionDate: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 1000,
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
    if (
      entry.direction !==
        LedgerDirection.CREDIT &&
      entry.direction !==
        LedgerDirection.DEBIT
    ) {
      continue;
    }

    const currency =
      entry.currency
        .trim()
        .toUpperCase() || "INR";

    currencyCounts.set(
      currency,
      (currencyCounts.get(currency) ??
        0) + 1,
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

  const financialEntries =
    approvedEntries.filter(
      (entry) =>
        entry.currency
          .trim()
          .toUpperCase() ===
          currency &&
        (entry.direction ===
          LedgerDirection.CREDIT ||
          entry.direction ===
            LedgerDirection.DEBIT),
    );

  const excludedCurrencyCount =
    approvedEntries.filter(
      (entry) =>
        entry.direction ===
          LedgerDirection.CREDIT ||
        entry.direction ===
          LedgerDirection.DEBIT,
    ).length -
    financialEntries.length;

  const inflowEntries =
    financialEntries.filter(
      (entry) =>
        entry.direction ===
        LedgerDirection.CREDIT,
    );

  const outflowEntries =
    financialEntries.filter(
      (entry) =>
        entry.direction ===
        LedgerDirection.DEBIT,
    );

  const totalInflow =
    inflowEntries.reduce(
      (total, entry) =>
        total + Number(entry.amount),
      0,
    );

  const totalOutflow =
    outflowEntries.reduce(
      (total, entry) =>
        total + Number(entry.amount),
      0,
    );

  const profit =
    totalInflow - totalOutflow;

  const monthlyMap = new Map<
    string,
    MonthlyMovement
  >();

  let missingDateCount = 0;

  for (const entry of financialEntries) {
    if (!entry.transactionDate) {
      missingDateCount += 1;
    }

    const date =
      entry.transactionDate ??
      entry.createdAt;

    const key = getMonthKey(date);

    const point =
      monthlyMap.get(key) ?? {
        key,
        inflow: 0,
        outflow: 0,
        net: 0,
      };

    const amount =
      Number(entry.amount);

    if (
      entry.direction ===
      LedgerDirection.CREDIT
    ) {
      point.inflow += amount;
    } else {
      point.outflow += amount;
    }

    point.net =
      point.inflow - point.outflow;

    monthlyMap.set(key, point);
  }

  const monthlyPoints =
    Array.from(
      monthlyMap.values(),
    ).sort((first, second) =>
      first.key.localeCompare(
        second.key,
      ),
    );

  const observedMonths =
    monthlyPoints.length;

  const monthlyDivisor =
    Math.max(observedMonths, 1);

  const estimatedMonthlyInflow =
    financialEntries.length > 0
      ? totalInflow /
        monthlyDivisor
      : null;

  const estimatedMonthlyOutflow =
    financialEntries.length > 0
      ? totalOutflow /
        monthlyDivisor
      : null;

  const netMonthlyCashFlow =
    estimatedMonthlyInflow !== null &&
    estimatedMonthlyOutflow !== null
      ? estimatedMonthlyInflow -
        estimatedMonthlyOutflow
      : null;

  const negativeMonths =
    monthlyPoints.filter(
      (point) => point.net < 0,
    );

  const estimatedMonthlyBurn =
    negativeMonths.length > 0
      ? negativeMonths.reduce(
          (total, point) =>
            total +
            Math.abs(point.net),
          0,
        ) / negativeMonths.length
      : netMonthlyCashFlow !== null &&
          netMonthlyCashFlow < 0
        ? Math.abs(netMonthlyCashFlow)
        : 0;

  /*
   * Net movement is not the same as
   * bank cash balance. Runway remains
   * unavailable until a verified opening
   * or closing cash balance is stored.
   */
  const cash: number | null = null;
  const runwayMonths: number | null =
    null;

  const threeMonthCashNeed =
    estimatedMonthlyBurn > 0
      ? estimatedMonthlyBurn * 3
      : 0;

  const sixMonthCashNeed =
    estimatedMonthlyBurn > 0
      ? estimatedMonthlyBurn * 6
      : 0;

  const cashGapForThreeMonths:
    | number
    | null = null;

  const status:
    CashFlowReport["status"] =
    financialEntries.length === 0
      ? "INSUFFICIENT_DATA"
      : netMonthlyCashFlow !== null &&
          netMonthlyCashFlow < 0 &&
          totalOutflow >
            totalInflow * 1.25
        ? "CRITICAL"
        : netMonthlyCashFlow !== null &&
              netMonthlyCashFlow < 0
          ? "WATCH"
          : pendingCount > 0
            ? "WATCH"
            : "HEALTHY";

  let score =
    financialEntries.length === 0
      ? 20
      : 78;

  if (
    netMonthlyCashFlow !== null &&
    netMonthlyCashFlow >= 0
  ) {
    score += 10;
  }

  if (
    netMonthlyCashFlow !== null &&
    netMonthlyCashFlow < 0
  ) {
    const pressureRatio =
      estimatedMonthlyOutflow &&
      estimatedMonthlyOutflow > 0
        ? Math.abs(
            netMonthlyCashFlow,
          ) /
          estimatedMonthlyOutflow
        : 1;

    score -= Math.min(
      38,
      15 + pressureRatio * 30,
    );
  }

  if (observedMonths >= 3) {
    score += 5;
  } else if (
    financialEntries.length > 0
  ) {
    score -= 8;
  }

  score -= Math.min(
    pendingCount * 2,
    15,
  );

  if (excludedCurrencyCount > 0) {
    score -= 4;
  }

  score = Math.round(
    clamp(score, 0, 95),
  );

  const cards: CashFlowMetric[] = [
    {
      label:
        "Avg. monthly inflow",
      value: formatMoney(
        estimatedMonthlyInflow,
        currency,
      ),
      hint:
        "Average approved credits per observed month",
      tone:
        estimatedMonthlyInflow ===
          null
          ? "neutral"
          : "good",
    },
    {
      label:
        "Avg. monthly outflow",
      value: formatMoney(
        estimatedMonthlyOutflow,
        currency,
      ),
      hint:
        "Average approved debits per observed month",
      tone:
        estimatedMonthlyOutflow ===
          null
          ? "neutral"
          : netMonthlyCashFlow !==
                null &&
              netMonthlyCashFlow < 0
            ? "danger"
            : "warning",
    },
    {
      label:
        "Net monthly movement",
      value: formatMoney(
        netMonthlyCashFlow,
        currency,
      ),
      hint:
        "Approved inflow minus approved outflow",
      tone:
        netMonthlyCashFlow === null
          ? "neutral"
          : netMonthlyCashFlow >= 0
            ? "good"
            : "danger",
    },
    {
      label: "Monthly burn",
      value: formatMoney(
        estimatedMonthlyBurn,
        currency,
      ),
      hint:
        estimatedMonthlyBurn > 0
          ? "Average negative movement in loss-making months"
          : "No negative monthly movement detected",
      tone:
        estimatedMonthlyBurn > 0
          ? "danger"
          : "good",
    },
  ];

  const signals: CashFlowSignal[] = [];

  if (financialEntries.length === 0) {
    signals.push({
      id: "no-approved-ledger-data",
      severity: "HIGH",
      title:
        "No approved cash movement",
      detail:
        "Approve credit and debit ledger entries to calculate trusted cash movement.",
      amount: null,
      tone: "danger",
    });
  }

  if (
    netMonthlyCashFlow !== null &&
    netMonthlyCashFlow < 0
  ) {
    signals.push({
      id: "negative-monthly-movement",
      severity: "HIGH",
      title:
        "Negative monthly movement",
      detail:
        "Average approved outflow is higher than average approved inflow.",
      amount: netMonthlyCashFlow,
      tone: "danger",
    });
  }

  if (
    estimatedMonthlyOutflow !== null &&
    estimatedMonthlyInflow !== null &&
    estimatedMonthlyOutflow >
      estimatedMonthlyInflow
  ) {
    signals.push({
      id: "outflow-pressure",
      severity: "MEDIUM",
      title:
        "Outflow pressure is high",
      detail:
        "Approved monthly debits are exceeding approved monthly credits.",
      amount:
        estimatedMonthlyOutflow -
        estimatedMonthlyInflow,
      tone: "warning",
    });
  }

  if (pendingCount > 0) {
    signals.push({
      id: "pending-ledger-review",
      severity: "MEDIUM",
      title:
        "Ledger review is incomplete",
      detail:
        `${pendingCount} entr${
          pendingCount === 1
            ? "y is"
            : "ies are"
        } excluded while awaiting review.`,
      amount: null,
      tone: "warning",
    });
  }

  if (observedMonths < 3) {
    signals.push({
      id: "limited-history",
      severity: "LOW",
      title:
        "Limited monthly history",
      detail:
        `The cash-flow score is provisional because only ${observedMonths} observed month${
          observedMonths === 1
            ? " is"
            : "s are"
        } available.`,
      amount: null,
      tone: "neutral",
    });
  }

  if (excludedCurrencyCount > 0) {
    signals.push({
      id: "mixed-currency",
      severity: "LOW",
      title:
        "Mixed currencies excluded",
      detail:
        `${excludedCurrencyCount} approved financial entr${
          excludedCurrencyCount === 1
            ? "y is"
            : "ies are"
        } excluded from ${currency} totals.`,
      amount: null,
      tone: "neutral",
    });
  }

  if (missingDateCount > 0) {
    signals.push({
      id: "missing-transaction-dates",
      severity: "LOW",
      title:
        "Some transaction dates are missing",
      detail:
        `${missingDateCount} entr${
          missingDateCount === 1
            ? "y uses"
            : "ies use"
        } creation date for monthly grouping.`,
      amount: null,
      tone: "neutral",
    });
  }

  if (signals.length === 0) {
    signals.push({
      id: "stable-ledger-movement",
      severity: "LOW",
      title:
        "Approved movement is stable",
      detail:
        "No major cash-movement warning was found in approved ledger entries.",
      amount: netMonthlyCashFlow,
      tone: "good",
    });
  }

  const actions: CashFlowAction[] = [];

  if (financialEntries.length === 0) {
    actions.push({
      priority: "HIGH",
      title:
        "Build the trusted ledger",
      detail:
        "Sync approved documents and review credit and debit entries.",
    });
  }

  if (
    netMonthlyCashFlow !== null &&
    netMonthlyCashFlow < 0
  ) {
    actions.push({
      priority: "HIGH",
      title:
        "Restore positive monthly movement",
      detail:
        `Reduce monthly outflow or improve inflow by at least ${formatMoney(
          Math.abs(
            netMonthlyCashFlow,
          ),
          currency,
        )}.`,
    });
  }

  if (outflowEntries.length > 0) {
    const topOutflow =
      [...outflowEntries].sort(
        (first, second) =>
          Number(second.amount) -
          Number(first.amount),
      )[0];

    actions.push({
      priority: "MEDIUM",
      title:
        "Review the largest debit",
      detail:
        `Start with ${topOutflow.description}, currently ${formatMoney(
          Number(topOutflow.amount),
          currency,
        )}.`,
    });
  }

  if (pendingCount > 0) {
    actions.push({
      priority: "MEDIUM",
      title:
        "Complete pending review",
      detail:
        `Approve or reject ${pendingCount} pending ledger entr${
          pendingCount === 1
            ? "y"
            : "ies"
        } before relying on the full cash-flow picture.`,
    });
  }

  if (actions.length === 0) {
    actions.push({
      priority: "LOW",
      title:
        "Maintain cash discipline",
      detail:
        "Continue recording offline transactions and syncing approved documents.",
    });
  }

  const topInflows: CashFlowLineItem[] =
    [...inflowEntries]
      .sort(
        (first, second) =>
          Number(second.amount) -
          Number(first.amount),
      )
      .slice(0, 10)
      .map((entry) => ({
        id: entry.id,
        label: entry.description,
        amount: Number(entry.amount),
        absoluteAmount: Number(
          entry.amount,
        ),
        type: "INFLOW",
        sourceFileName:
          entry.document?.fileName ??
          "Manual entry",
        sourceCategory:
          entry.document
            ? String(
                entry.document.category,
              )
            : entry.category ??
              "MANUAL",
      }));

  const topOutflows: CashFlowLineItem[] =
    [...outflowEntries]
      .sort(
        (first, second) =>
          Number(second.amount) -
          Number(first.amount),
      )
      .slice(0, 10)
      .map((entry) => ({
        id: entry.id,
        label: entry.description,
        amount: Number(entry.amount),
        absoluteAmount: Number(
          entry.amount,
        ),
        type: "OUTFLOW",
        sourceFileName:
          entry.document?.fileName ??
          "Manual entry",
        sourceCategory:
          entry.document
            ? String(
                entry.document.category,
              )
            : entry.category ??
              "MANUAL",
      }));

  const coverageMap = new Map<
    string,
    {
      id: string;
      fileName: string;
      category: string;
      lineItemCount: number;
      cashSignalCount: number;
    }
  >();

  for (const entry of financialEntries) {
    if (!entry.document) {
      continue;
    }

    const current =
      coverageMap.get(
        entry.document.id,
      ) ?? {
        id: entry.document.id,
        fileName:
          entry.document.fileName,
        category: String(
          entry.document.category,
        ),
        lineItemCount: 0,
        cashSignalCount: 0,
      };

    current.lineItemCount += 1;
    current.cashSignalCount += 1;

    coverageMap.set(
      entry.document.id,
      current,
    );
  }

  const documentCoverage =
    Array.from(
      coverageMap.values(),
    ).sort(
      (first, second) =>
        second.lineItemCount -
        first.lineItemCount,
    );

  return {
    generatedAt:
      new Date().toISOString(),

    currency,

    summary: makeSummary({
      financialEntryCount:
        financialEntries.length,
      observedMonths,
      estimatedMonthlyInflow,
      estimatedMonthlyOutflow,
      netMonthlyCashFlow,
      pendingCount,
      currency,
    }),

    status,
    score,

    metrics: {
      cash,
      revenue: totalInflow,
      expenses: totalOutflow,
      profit,
      estimatedMonthlyBurn,
      estimatedMonthlyInflow,
      estimatedMonthlyOutflow,
      netMonthlyCashFlow,
      runwayMonths,
      threeMonthCashNeed,
      sixMonthCashNeed,
      cashGapForThreeMonths,
    },

    cards,
    signals: signals.slice(0, 6),
    actions: actions.slice(0, 5),
    topInflows,
    topOutflows,
    documentCoverage,
  };
}