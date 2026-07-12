import {
  LedgerDirection,
  LedgerEntryStatus,
} from "@prisma/client";
import { prisma } from "./prisma";

export type LedgerConfidenceLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export type LedgerDataConfidence = {
  score: number;
  level: LedgerConfidenceLevel;
  label: string;
  detail: string;
  approvedFinancialEntries: number;
  pendingEntries: number;
  rejectedEntries: number;
  reviewedPercentage: number;
  dateCoveragePercentage: number;
  historyMonths: number;
  sourceCount: number;
  currencyConsistencyPercentage: number;
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

function percentage(
  numerator: number,
  denominator: number,
) {
  if (denominator <= 0) {
    return 0;
  }

  return Math.round(
    (numerator / denominator) * 100,
  );
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

export async function getLedgerDataConfidence(
  userId: string,
): Promise<LedgerDataConfidence> {
  const entries =
    await prisma.ledgerEntry.findMany({
      where: {
        userId,
      },
      select: {
        status: true,
        isPosting: true,
        direction: true,
        currency: true,
        transactionDate: true,
        createdAt: true,
        documentId: true,
        sourceType: true,
      },
    });

  const financialEntries = entries.filter(
    (entry) =>
      entry.isPosting &&
      (
        entry.direction === LedgerDirection.CREDIT ||
        entry.direction === LedgerDirection.DEBIT
      ),
  );

  const approvedFinancialEntries =
    financialEntries.filter(
      (entry) =>
        entry.status ===
        LedgerEntryStatus.APPROVED,
    );

  const reviewedFinancialEntries =
    financialEntries.filter(
      (entry) =>
        entry.status ===
          LedgerEntryStatus.APPROVED ||
        entry.status ===
          LedgerEntryStatus.REJECTED,
    );

  const pendingEntries = entries.filter(
    (entry) =>
      entry.isPosting &&
      entry.status === LedgerEntryStatus.NEEDS_REVIEW,
  ).length;

  const rejectedEntries = entries.filter(
    (entry) =>
      entry.isPosting &&
      entry.status === LedgerEntryStatus.REJECTED,
  ).length;

  const datedApprovedEntries =
    approvedFinancialEntries.filter(
      (entry) =>
        entry.transactionDate !== null,
    );

  const months = new Set(
    approvedFinancialEntries.map((entry) =>
      monthKey(
        entry.transactionDate ??
          entry.createdAt,
      ),
    ),
  );

  const documentSources = new Set(
    approvedFinancialEntries
      .map((entry) => entry.documentId)
      .filter(
        (
          documentId,
        ): documentId is string =>
          Boolean(documentId),
      ),
  );

  const hasManualSource =
    approvedFinancialEntries.some(
      (entry) =>
        entry.sourceType === "MANUAL",
    );

  const sourceCount =
    documentSources.size +
    (hasManualSource ? 1 : 0);

  const currencyCounts = new Map<
    string,
    number
  >();

  for (
    const entry of
    approvedFinancialEntries
  ) {
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

  const dominantCurrencyCount =
    Array.from(
      currencyCounts.values(),
    ).sort(
      (first, second) =>
        second - first,
    )[0] ?? 0;

  const reviewedPercentage = percentage(
    reviewedFinancialEntries.length,
    financialEntries.length,
  );

  const dateCoveragePercentage =
    percentage(
      datedApprovedEntries.length,
      approvedFinancialEntries.length,
    );

  const currencyConsistencyPercentage =
    percentage(
      dominantCurrencyCount,
      approvedFinancialEntries.length,
    );

  const reviewScore =
    reviewedPercentage * 0.25;

  const dateScore =
    dateCoveragePercentage * 0.20;

  const volumeScore =
    Math.min(
      approvedFinancialEntries.length /
        12,
      1,
    ) * 20;

  const historyScore =
    Math.min(months.size / 6, 1) *
    15;

  const sourceScore =
    Math.min(sourceCount / 3, 1) *
    10;

  const currencyScore =
    currencyConsistencyPercentage *
    0.10;

  let score = Math.round(
    reviewScore +
      dateScore +
      volumeScore +
      historyScore +
      sourceScore +
      currencyScore,
  );

  if (
    approvedFinancialEntries.length ===
    0
  ) {
    score = 0;
  } else if (
    approvedFinancialEntries.length < 3
  ) {
    score = Math.min(score, 40);
  } else if (
    approvedFinancialEntries.length < 6
  ) {
    score = Math.min(score, 60);
  }

  if (months.size < 2) {
    score = Math.min(score, 70);
  }

  score = clamp(score, 0, 100);

  const level: LedgerConfidenceLevel =
    score >= 75
      ? "HIGH"
      : score >= 50
        ? "MEDIUM"
        : "LOW";

  const label =
    level === "HIGH"
      ? "High confidence"
      : level === "MEDIUM"
        ? "Medium confidence"
        : "Low confidence";

  const detail =
    approvedFinancialEntries.length ===
    0
      ? "No approved credit or debit entries are available."
      : `${approvedFinancialEntries.length} approved financial entr${
          approvedFinancialEntries.length ===
          1
            ? "y"
            : "ies"
        }, ${months.size} month${
          months.size === 1 ? "" : "s"
        } of history, and ${pendingEntries} pending review.`;

  return {
    score,
    level,
    label,
    detail,
    approvedFinancialEntries:
      approvedFinancialEntries.length,
    pendingEntries,
    rejectedEntries,
    reviewedPercentage,
    dateCoveragePercentage,
    historyMonths: months.size,
    sourceCount,
    currencyConsistencyPercentage,
  };
}