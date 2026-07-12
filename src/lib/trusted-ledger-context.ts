import {
  LedgerDirection,
  LedgerEntryStatus,
  LedgerSourceType,
} from "@prisma/client";
import {
  getLedgerDataConfidence,
  type LedgerDataConfidence,
} from "./ledger-data-confidence";
import { prisma } from "./prisma";

export type TrustedLedgerEntryEvidence = {
  id: string;
  transactionDate: Date | null;
  createdAt: Date;
  description: string;
  counterparty: string | null;
  category: string | null;
  direction: "CREDIT" | "DEBIT";
  amount: number;
  currency: string;
  confidence: number | null;
  sourceType: LedgerSourceType;
  documentId: string | null;
  sourceFileName: string;
  sourceCategory: string;
};

export type TrustedLedgerMonthlyPoint = {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
};

export type TrustedLedgerContext = {
  business: {
    name: string;
    industry: string;
    businessType: string;
    financialYear: string;
    currency: string;
    country: string;
  };

  currency: string;

  counts: {
    totalEntries: number;
    approvedEntries: number;
    pendingEntries: number;
    rejectedEntries: number;
    approvedFinancialEntries: number;
    excludedCurrencyEntries: number;
    neutralApprovedEntries: number;
    manualApprovedEntries: number;
    datedApprovedEntries: number;
    sourceCount: number;
    documentsWithApprovedEntries: number;
  };

  documents: {
    total: number;
    processed: number;
    approved: number;
    pending: number;
    rejected: number;
    failed: number;
  };

  totals: {
    revenue: number;
    expenses: number;
    profit: number;
    cashBalance: null;
    profitMarginPercent: number | null;
    expenseRatioPercent: number | null;
    revenueCoveragePercent: number | null;
  };

  monthly: {
    points: TrustedLedgerMonthlyPoint[];
    observedMonths: number;
    averageRevenue: number | null;
    averageExpenses: number | null;
    averageProfit: number | null;
    burnRate: number | null;
    latestNet: number | null;
    revenueGrowthPercent: number | null;
    expenseGrowthPercent: number | null;
  };

  entries: TrustedLedgerEntryEvidence[];
  topCredits: TrustedLedgerEntryEvidence[];
  topDebits: TrustedLedgerEntryEvidence[];
  confidence: LedgerDataConfidence;
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

export function formatLedgerMoney(
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

export function formatLedgerPercent(
  value: number | null,
) {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return "Not available";
  }

  return `${value.toFixed(2)}%`;
}

function safeRatio(
  numerator: number,
  denominator: number,
) {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return null;
  }

  return (numerator / denominator) * 100;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat(
    "en-IN",
    {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    },
  ).format(date);
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

function growthPercent(
  current: number,
  previous: number,
) {
  if (
    previous <= 0 ||
    !Number.isFinite(previous)
  ) {
    return null;
  }

  return clamp(
    ((current - previous) /
      previous) *
      100,
    -500,
    500,
  );
}

function normalizeCurrency(value: string | null | undefined) {
  return (
    value?.trim().toUpperCase() ||
    "INR"
  );
}

function evidenceDate(
  entry: TrustedLedgerEntryEvidence,
) {
  const date =
    entry.transactionDate ??
    entry.createdAt;

  return date.toISOString().slice(0, 10);
}

function evidenceSource(
  entry: TrustedLedgerEntryEvidence,
) {
  return entry.documentId
    ? entry.sourceFileName
    : "Manual entry";
}

export async function getTrustedLedgerContext(
  userId: string,
): Promise<TrustedLedgerContext> {
  const [
    business,
    ledgerEntries,
    documents,
    confidence,
  ] = await Promise.all([
    prisma.business.findUnique({
      where: {
        userId,
      },
      select: {
        name: true,
        industry: true,
        businessType: true,
        financialYear: true,
        currency: true,
        country: true,
      },
    }),

    prisma.ledgerEntry.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        transactionDate: true,
        createdAt: true,
        description: true,
        counterparty: true,
        category: true,
        direction: true,
        amount: true,
        currency: true,
        confidence: true,
        status: true,
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
          transactionDate: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
      take: 5000,
    }),

    prisma.document.findMany({
      where: {
        userId,
      },
      select: {
        status: true,
        reviewStatus: true,
      },
    }),

    getLedgerDataConfidence(userId),
  ]);

  const configuredCurrency =
    normalizeCurrency(
      business?.currency,
    );

  const approvedFinancialAllCurrencies =
    ledgerEntries.filter(
      (entry) =>
        entry.status ===
          LedgerEntryStatus.APPROVED &&
        (
          entry.direction ===
            LedgerDirection.CREDIT ||
          entry.direction ===
            LedgerDirection.DEBIT
        ),
    );

  const currencyCounts = new Map<
    string,
    number
  >();

  for (
    const entry of
    approvedFinancialAllCurrencies
  ) {
    const currency =
      normalizeCurrency(
        entry.currency,
      );

    currencyCounts.set(
      currency,
      (currencyCounts.get(
        currency,
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

  const trustedEntries:
    TrustedLedgerEntryEvidence[] =
    approvedFinancialAllCurrencies
      .filter(
        (entry) =>
          normalizeCurrency(
            entry.currency,
          ) === currency,
      )
      .map((entry) => ({
        id: entry.id,
        transactionDate:
          entry.transactionDate,
        createdAt: entry.createdAt,
        description:
          entry.description,
        counterparty:
          entry.counterparty,
        category: entry.category,
        direction:
          entry.direction ===
          LedgerDirection.CREDIT
            ? "CREDIT"
            : "DEBIT",
        amount:
          Number(entry.amount),
        currency,
        confidence:
          entry.confidence,
        sourceType:
          entry.sourceType,
        documentId:
          entry.documentId,
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

  const creditEntries =
    trustedEntries.filter(
      (entry) =>
        entry.direction ===
        "CREDIT",
    );

  const debitEntries =
    trustedEntries.filter(
      (entry) =>
        entry.direction ===
        "DEBIT",
    );

  const revenue =
    creditEntries.reduce(
      (total, entry) =>
        total + entry.amount,
      0,
    );

  const expenses =
    debitEntries.reduce(
      (total, entry) =>
        total + entry.amount,
      0,
    );

  const profit =
    revenue - expenses;

  const monthlyMap = new Map<
    string,
    TrustedLedgerMonthlyPoint
  >();

  for (const entry of trustedEntries) {
    const date =
      entry.transactionDate ??
      entry.createdAt;

    const key = monthKey(date);

    const point =
      monthlyMap.get(key) ?? {
        key,
        label:
          monthLabel(date),
        revenue: 0,
        expenses: 0,
        profit: 0,
      };

    if (
      entry.direction === "CREDIT"
    ) {
      point.revenue +=
        entry.amount;
    } else {
      point.expenses +=
        entry.amount;
    }

    point.profit =
      point.revenue -
      point.expenses;

    monthlyMap.set(key, point);
  }

  const points =
    Array.from(
      monthlyMap.values(),
    ).sort((first, second) =>
      first.key.localeCompare(
        second.key,
      ),
    );

  const recentPoints =
    points.slice(-6);

  const averageRevenue =
    average(
      recentPoints.map(
        (point) =>
          point.revenue,
      ),
    );

  const averageExpenses =
    average(
      recentPoints.map(
        (point) =>
          point.expenses,
      ),
    );

  const averageProfit =
    averageRevenue !== null &&
    averageExpenses !== null
      ? averageRevenue -
        averageExpenses
      : null;

  const lossMonths =
    points.filter(
      (point) =>
        point.profit < 0,
    );

  const burnRate =
    lossMonths.length > 0
      ? average(
          lossMonths.map(
            (point) =>
              Math.abs(
                point.profit,
              ),
          ),
        )
      : averageProfit !== null &&
          averageProfit < 0
        ? Math.abs(
            averageProfit,
          )
        : 0;

  const latestPoint =
    points.length > 0
      ? points[
          points.length - 1
        ]
      : null;

  const previousPoint =
    points.length > 1
      ? points[
          points.length - 2
        ]
      : null;

  const approvedEntries =
    ledgerEntries.filter(
      (entry) =>
        entry.status ===
        LedgerEntryStatus.APPROVED,
    );

  const pendingEntries =
    ledgerEntries.filter(
      (entry) =>
        entry.status ===
        LedgerEntryStatus.NEEDS_REVIEW,
    ).length;

  const rejectedEntries =
    ledgerEntries.filter(
      (entry) =>
        entry.status ===
        LedgerEntryStatus.REJECTED,
    ).length;

  const neutralApprovedEntries =
    approvedEntries.filter(
      (entry) =>
        entry.direction ===
        LedgerDirection.NEUTRAL,
    ).length;

  const manualApprovedEntries =
    trustedEntries.filter(
      (entry) =>
        entry.sourceType ===
        LedgerSourceType.MANUAL,
    ).length;

  const datedApprovedEntries =
    trustedEntries.filter(
      (entry) =>
        entry.transactionDate !==
        null,
    ).length;

  const documentSources =
    new Set(
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

  const sourceCount =
    documentSources.size +
    (
      manualApprovedEntries > 0
        ? 1
        : 0
    );

  const processedDocuments =
    documents.filter(
      (document) =>
        String(
          document.status,
        ) === "PROCESSED",
    ).length;

  const approvedDocuments =
    documents.filter(
      (document) =>
        String(
          document.reviewStatus,
        ) === "APPROVED",
    ).length;

  const pendingDocuments =
    documents.filter(
      (document) =>
        String(
          document.reviewStatus,
        ) === "NEEDS_REVIEW",
    ).length;

  const rejectedDocuments =
    documents.filter(
      (document) =>
        String(
          document.reviewStatus,
        ) === "REJECTED",
    ).length;

  const failedDocuments =
    documents.filter(
      (document) =>
        String(
          document.status,
        ) === "FAILED",
    ).length;

  return {
    business: {
      name:
        business?.name ??
        "Not set",
      industry:
        business?.industry ??
        "Not set",
      businessType:
        business?.businessType ??
        "Not set",
      financialYear:
        business?.financialYear ??
        "Not set",
      currency,
      country:
        business?.country ??
        "Not set",
    },

    currency,

    counts: {
      totalEntries:
        ledgerEntries.length,
      approvedEntries:
        approvedEntries.length,
      pendingEntries,
      rejectedEntries,
      approvedFinancialEntries:
        trustedEntries.length,
      excludedCurrencyEntries:
        approvedFinancialAllCurrencies.length -
        trustedEntries.length,
      neutralApprovedEntries,
      manualApprovedEntries,
      datedApprovedEntries,
      sourceCount,
      documentsWithApprovedEntries:
        documentSources.size,
    },

    documents: {
      total: documents.length,
      processed:
        processedDocuments,
      approved:
        approvedDocuments,
      pending:
        pendingDocuments,
      rejected:
        rejectedDocuments,
      failed:
        failedDocuments,
    },

    totals: {
      revenue,
      expenses,
      profit,
      cashBalance: null,
      profitMarginPercent:
        safeRatio(
          profit,
          revenue,
        ),
      expenseRatioPercent:
        safeRatio(
          expenses,
          revenue,
        ),
      revenueCoveragePercent:
        expenses > 0
          ? safeRatio(
              revenue,
              expenses,
            )
          : revenue > 0
            ? 100
            : null,
    },

    monthly: {
      points,
      observedMonths:
        points.length,
      averageRevenue,
      averageExpenses,
      averageProfit,
      burnRate,
      latestNet:
        latestPoint?.profit ??
        null,
      revenueGrowthPercent:
        latestPoint &&
        previousPoint
          ? growthPercent(
              latestPoint.revenue,
              previousPoint.revenue,
            )
          : null,
      expenseGrowthPercent:
        latestPoint &&
        previousPoint
          ? growthPercent(
              latestPoint.expenses,
              previousPoint.expenses,
            )
          : null,
    },

    entries: trustedEntries,

    topCredits:
      [...creditEntries]
        .sort(
          (first, second) =>
            second.amount -
            first.amount,
        )
        .slice(0, 15),

    topDebits:
      [...debitEntries]
        .sort(
          (first, second) =>
            second.amount -
            first.amount,
        )
        .slice(0, 15),

    confidence,
  };
}

export function buildTrustedLedgerPromptBlock(
  context: TrustedLedgerContext,
) {
  const topCredits =
    context.topCredits.length > 0
      ? context.topCredits
          .slice(0, 10)
          .map(
            (entry) =>
              `- ${evidenceDate(
                entry,
              )} | CREDIT | ${entry.description} | ${formatLedgerMoney(
                entry.amount,
                context.currency,
              )} | Source: ${evidenceSource(
                entry,
              )}`,
          )
          .join("\n")
      : "- No approved credit entries.";

  const topDebits =
    context.topDebits.length > 0
      ? context.topDebits
          .slice(0, 10)
          .map(
            (entry) =>
              `- ${evidenceDate(
                entry,
              )} | DEBIT | ${entry.description} | ${formatLedgerMoney(
                entry.amount,
                context.currency,
              )} | Source: ${evidenceSource(
                entry,
              )}`,
          )
          .join("\n")
      : "- No approved debit entries.";

  const monthlyHistory =
    context.monthly.points.length > 0
      ? context.monthly.points
          .slice(-12)
          .map(
            (point) =>
              `- ${point.label}: credits ${formatLedgerMoney(
                point.revenue,
                context.currency,
              )}, debits ${formatLedgerMoney(
                point.expenses,
                context.currency,
              )}, net ${formatLedgerMoney(
                point.profit,
                context.currency,
              )}`,
          )
          .join("\n")
      : "- No dated monthly history.";

  return `
Trusted ledger source of truth:
- Currency used for calculations: ${context.currency}
- Total ledger entries: ${context.counts.totalEntries}
- Approved financial entries used: ${context.counts.approvedFinancialEntries}
- Pending entries excluded: ${context.counts.pendingEntries}
- Rejected entries excluded: ${context.counts.rejectedEntries}
- Neutral approved entries excluded from totals: ${context.counts.neutralApprovedEntries}
- Different-currency approved entries excluded: ${context.counts.excludedCurrencyEntries}
- Manual approved entries included: ${context.counts.manualApprovedEntries}
- Observed months: ${context.monthly.observedMonths}
- Data confidence: ${context.confidence.label} (${context.confidence.score}/100)
- Approved credits / revenue: ${formatLedgerMoney(
    context.totals.revenue,
    context.currency,
  )}
- Approved debits / expenses: ${formatLedgerMoney(
    context.totals.expenses,
    context.currency,
  )}
- Approved net profit or loss: ${formatLedgerMoney(
    context.totals.profit,
    context.currency,
  )}
- Profit margin: ${formatLedgerPercent(
    context.totals.profitMarginPercent,
  )}
- Expense ratio: ${formatLedgerPercent(
    context.totals.expenseRatioPercent,
  )}
- Revenue coverage: ${formatLedgerPercent(
    context.totals.revenueCoveragePercent,
  )}
- Average monthly credits: ${formatLedgerMoney(
    context.monthly.averageRevenue,
    context.currency,
  )}
- Average monthly debits: ${formatLedgerMoney(
    context.monthly.averageExpenses,
    context.currency,
  )}
- Average monthly net movement: ${formatLedgerMoney(
    context.monthly.averageProfit,
    context.currency,
  )}
- Verified cash balance: Not available.
- Cash runway: Not available because a verified opening or closing cash balance is not stored.

Top approved credits:
${topCredits}

Top approved debits:
${topDebits}

Approved monthly history:
${monthlyHistory}

Ledger evidence rules:
- Approved CREDIT and DEBIT entries in the selected currency are the source of truth for financial amounts.
- Pending, rejected, neutral, and different-currency entries are excluded from financial totals.
- Manual approved entries are valid ledger evidence.
- Document extracted totals may support source context, but they must not override approved ledger totals.
- Never invent a cash balance, runway, tax amount, or forecast input.
`;
}