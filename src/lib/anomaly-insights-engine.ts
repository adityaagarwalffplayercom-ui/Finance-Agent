import {
  getTrustedLedgerContext,
} from "./trusted-ledger-context";

type AnomalyTone =
  | "good"
  | "warning"
  | "danger"
  | "neutral";

export type ExtractedInsightLineItem = {
  id: string;
  label: string;
  amount: number;
  absoluteAmount: number;
  type:
    | "REVENUE"
    | "EXPENSE"
    | "CASH"
    | "UNKNOWN";
  date: string | null;
  sourceDocumentId: string;
  sourceFileName: string;
  sourceCategory: string;
  path: string;
};

export type AnomalyInsight = {
  id: string;
  severity:
    | "HIGH"
    | "MEDIUM"
    | "LOW";
  title: string;
  detail: string;
  amount: number | null;
  source: string;
  tone: AnomalyTone;
};

export type AnomalyAction = {
  priority:
    | "HIGH"
    | "MEDIUM"
    | "LOW";
  title: string;
  detail: string;
};

export type AnomalyInsightsReport = {
  generatedAt: string;
  currency: string;
  summary: string;
  score: number;
  status:
    | "STRONG"
    | "NEEDS_REVIEW"
    | "WEAK_DATA";

  metrics: {
    approvedDocuments: number;
    documentsWithLineItems: number;
    totalLineItems: number;
    expenseLineItems: number;
    revenueLineItems: number;
    highValueItems: number;
    negativeItems: number;
    duplicateLookingGroups: number;
    largestItemAmount:
      | number
      | null;
    expenseConcentrationPercent:
      | number
      | null;
  };

  largestItems:
    ExtractedInsightLineItem[];
  expenseItems:
    ExtractedInsightLineItem[];
  revenueItems:
    ExtractedInsightLineItem[];
  anomalies: AnomalyInsight[];
  actions: AnomalyAction[];

  duplicateGroups: {
    key: string;
    count: number;
    totalAmount: number;
    items:
      ExtractedInsightLineItem[];
  }[];

  documentCoverage: {
    id: string;
    fileName: string;
    category: string;
    lineItemCount: number;
    quality:
      | "GOOD"
      | "PARTIAL"
      | "WEAK";
  }[];
};

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(
      /[^a-z0-9 ]/g,
      "",
    );
}

function itemDate(
  value: Date | null,
) {
  return value
    ? value
        .toISOString()
        .slice(0, 10)
    : null;
}

function quality(
  count: number,
):
  | "GOOD"
  | "PARTIAL"
  | "WEAK" {
  if (count >= 20) {
    return "GOOD";
  }

  if (count >= 5) {
    return "PARTIAL";
  }

  return "WEAK";
}

export async function getAnomalyInsightsReport(
  userId: string,
): Promise<AnomalyInsightsReport> {
  const context =
    await getTrustedLedgerContext(
      userId,
    );

  const allItems:
    ExtractedInsightLineItem[] =
    context.entries.map(
      (entry) => ({
        id: entry.id,
        label:
          entry.description,
        amount:
          entry.direction ===
          "CREDIT"
            ? entry.amount
            : -entry.amount,
        absoluteAmount:
          entry.amount,
        type:
          entry.direction ===
          "CREDIT"
            ? "REVENUE"
            : "EXPENSE",
        date:
          itemDate(
            entry.transactionDate,
          ),
        sourceDocumentId:
          entry.documentId ?? "",
        sourceFileName:
          entry.documentId
            ? entry.sourceFileName
            : "Manual entry",
        sourceCategory:
          entry.sourceCategory,
        path:
          `ledger:${entry.id}`,
      }),
    );

  const sortedItems =
    [...allItems].sort(
      (first, second) =>
        second.absoluteAmount -
        first.absoluteAmount,
    );

  const expenseItems =
    allItems
      .filter(
        (item) =>
          item.type ===
          "EXPENSE",
      )
      .sort(
        (first, second) =>
          second.absoluteAmount -
          first.absoluteAmount,
      );

  const revenueItems =
    allItems
      .filter(
        (item) =>
          item.type ===
          "REVENUE",
      )
      .sort(
        (first, second) =>
          second.absoluteAmount -
          first.absoluteAmount,
      );

  const totalExpenseAmount =
    expenseItems.reduce(
      (total, item) =>
        total +
        item.absoluteAmount,
      0,
    );

  const largestExpenseAmount =
    expenseItems[0]
      ?.absoluteAmount ?? null;

  const expenseConcentrationPercent =
    largestExpenseAmount !== null &&
    totalExpenseAmount > 0
      ? (
          largestExpenseAmount /
          totalExpenseAmount
        ) * 100
      : null;

  const averageAbsoluteAmount =
    allItems.length > 0
      ? allItems.reduce(
          (total, item) =>
            total +
            item.absoluteAmount,
          0,
        ) / allItems.length
      : 0;

  const highValueThreshold =
    averageAbsoluteAmount > 0
      ? averageAbsoluteAmount *
        2.5
      : 0;

  const highValueItems =
    highValueThreshold > 0
      ? allItems.filter(
          (item) =>
            item.absoluteAmount >=
            highValueThreshold,
        )
      : [];

  /*
   * Debit direction is not itself an
   * anomaly, so normal expenses are not
   * counted as negative-value errors.
   */
  const negativeItems:
    ExtractedInsightLineItem[] = [];

  const duplicateMap =
    new Map<
      string,
      ExtractedInsightLineItem[]
    >();

  for (const item of allItems) {
    if (
      item.absoluteAmount <= 0 ||
      item.label.trim().length < 3
    ) {
      continue;
    }

    const key =
      `${normalizeText(
        item.label,
      )}-${Math.round(
        item.absoluteAmount,
      )}-${item.date ?? "no-date"}`;

    const existing =
      duplicateMap.get(key) ??
      [];

    existing.push(item);

    duplicateMap.set(
      key,
      existing,
    );
  }

  const duplicateGroups =
    Array.from(
      duplicateMap.entries(),
    )
      .filter(
        ([, items]) =>
          items.length >= 2,
      )
      .map(
        ([key, items]) => ({
          key,
          count:
            items.length,
          totalAmount:
            items.reduce(
              (total, item) =>
                total +
                item.absoluteAmount,
              0,
            ),
          items:
            items.slice(0, 5),
        }),
      )
      .sort(
        (first, second) =>
          second.totalAmount -
          first.totalAmount,
      )
      .slice(0, 8);

  const coverageMap =
    new Map<
      string,
      {
        id: string;
        fileName: string;
        category: string;
        lineItemCount: number;
      }
    >();

  for (const entry of context.entries) {
    if (!entry.documentId) {
      continue;
    }

    const current =
      coverageMap.get(
        entry.documentId,
      ) ?? {
        id:
          entry.documentId,
        fileName:
          entry.sourceFileName,
        category:
          entry.sourceCategory,
        lineItemCount: 0,
      };

    current.lineItemCount += 1;

    coverageMap.set(
      entry.documentId,
      current,
    );
  }

  const documentCoverage =
    Array.from(
      coverageMap.values(),
    )
      .map((item) => ({
        ...item,
        quality:
          quality(
            item.lineItemCount,
          ),
      }))
      .sort(
        (first, second) =>
          second.lineItemCount -
          first.lineItemCount,
      );

  const anomalies:
    AnomalyInsight[] = [];

  if (allItems.length === 0) {
    anomalies.push({
      id:
        "no-approved-ledger-items",
      severity: "HIGH",
      title:
        "No approved ledger entries",
      detail:
        "Approve credit and debit ledger entries before anomaly analysis.",
      amount: null,
      source:
        "Transaction Ledger",
      tone: "danger",
    });
  }

  for (
    const item of
    highValueItems.slice(0, 8)
  ) {
    anomalies.push({
      id:
        `high-value-${item.id}`,
      severity: "MEDIUM",
      title:
        "High-value ledger entry",
      detail:
        `${item.label} is much larger than the average approved entry.`,
      amount:
        item.absoluteAmount,
      source:
        item.sourceFileName,
      tone: "warning",
    });
  }

  for (
    const group of
    duplicateGroups.slice(0, 5)
  ) {
    anomalies.push({
      id:
        `duplicate-${group.key}`,
      severity: "MEDIUM",
      title:
        "Duplicate-looking entries",
      detail:
        `${group.count} approved entries have the same normalized description, amount, and date. Verify whether they are genuine or duplicated.`,
      amount:
        group.totalAmount,
      source:
        group.items[0]
          ?.sourceFileName ??
        "Multiple sources",
      tone: "warning",
    });
  }

  if (
    expenseConcentrationPercent !==
      null &&
    expenseConcentrationPercent >=
      45 &&
    expenseItems[0]
  ) {
    anomalies.push({
      id:
        "expense-concentration",
      severity: "HIGH",
      title:
        "Expense concentration risk",
      detail:
        `${expenseItems[0].label} represents ${expenseConcentrationPercent.toFixed(
          1,
        )}% of approved debits.`,
      amount:
        expenseItems[0]
          .absoluteAmount,
      source:
        expenseItems[0]
          .sourceFileName,
      tone: "danger",
    });
  }

  if (
    context.counts
      .pendingEntries > 0
  ) {
    anomalies.push({
      id:
        "pending-review-excluded",
      severity: "LOW",
      title:
        "Pending entries excluded",
      detail:
        `${context.counts.pendingEntries} ledger entr${
          context.counts
            .pendingEntries === 1
            ? "y is"
            : "ies are"
        } excluded until review is complete.`,
      amount: null,
      source:
        "Transaction Ledger",
      tone: "neutral",
    });
  }

  if (
    context.confidence.level ===
    "LOW"
  ) {
    anomalies.push({
      id:
        "low-data-confidence",
      severity: "LOW",
      title:
        "Limited anomaly confidence",
      detail:
        `Data confidence is ${context.confidence.score}/100. More dated and reviewed entries will improve anomaly detection.`,
      amount: null,
      source:
        "Ledger confidence",
      tone: "neutral",
    });
  }

  const score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        100 -
          anomalies.filter(
            (item) =>
              item.severity ===
              "HIGH",
          ).length *
            22 -
          anomalies.filter(
            (item) =>
              item.severity ===
              "MEDIUM",
          ).length *
            10 -
          anomalies.filter(
            (item) =>
              item.severity ===
              "LOW",
          ).length *
            4,
      ),
    ),
  );

  const status:
    AnomalyInsightsReport["status"] =
    allItems.length === 0
      ? "WEAK_DATA"
      : score >= 75
        ? "STRONG"
        : "NEEDS_REVIEW";

  const actions:
    AnomalyAction[] = [];

  if (allItems.length === 0) {
    actions.push({
      priority: "HIGH",
      title:
        "Build approved ledger evidence",
      detail:
        "Sync approved documents, review entries, and approve verified credits and debits.",
    });
  }

  if (
    highValueItems.length > 0
  ) {
    actions.push({
      priority: "HIGH",
      title:
        "Review high-value entries",
      detail:
        `Start with ${highValueItems
          .slice(0, 3)
          .map(
            (item) =>
              item.label,
          )
          .join(", ")}.`,
    });
  }

  if (
    duplicateGroups.length > 0
  ) {
    actions.push({
      priority: "MEDIUM",
      title:
        "Verify duplicate-looking entries",
      detail:
        "Check identical descriptions, amounts, dates, and source documents before rejecting any row.",
    });
  }

  if (
    expenseConcentrationPercent !==
      null &&
    expenseConcentrationPercent >=
      45
  ) {
    actions.push({
      priority: "HIGH",
      title:
        "Reduce concentration risk",
      detail:
        "A single approved debit dominates total costs. Verify and review whether it can be negotiated, reduced, or diversified.",
    });
  }

  if (
    context.counts
      .pendingEntries > 0
  ) {
    actions.push({
      priority: "MEDIUM",
      title:
        "Complete ledger review",
      detail:
        "Anomaly analysis excludes every pending and rejected entry.",
    });
  }

  if (actions.length === 0) {
    actions.push({
      priority: "LOW",
      title:
        "Continue monthly monitoring",
      detail:
        "No major anomaly action is required from the current approved ledger.",
    });
  }

  const summary =
    allItems.length === 0
      ? "Anomaly analysis needs approved ledger entries."
      : highValueItems.length > 0 ||
          duplicateGroups.length > 0
        ? `Actic Finance found ${highValueItems.length} high-value entr${
            highValueItems.length === 1
              ? "y"
              : "ies"
          } and ${duplicateGroups.length} duplicate-looking group${
            duplicateGroups.length === 1
              ? ""
              : "s"
          } in the approved ledger.`
        : expenseConcentrationPercent !==
              null &&
            expenseConcentrationPercent >=
              45
          ? `The largest approved debit represents about ${expenseConcentrationPercent.toFixed(
              1,
            )}% of total approved debits.`
          : "No major anomaly was detected in approved ledger entries.";

  return {
    generatedAt:
      new Date().toISOString(),
    currency:
      context.currency,
    summary,
    score,
    status,

    metrics: {
      approvedDocuments:
        context.counts
          .documentsWithApprovedEntries,
      documentsWithLineItems:
        documentCoverage.length,
      totalLineItems:
        allItems.length,
      expenseLineItems:
        expenseItems.length,
      revenueLineItems:
        revenueItems.length,
      highValueItems:
        highValueItems.length,
      negativeItems:
        negativeItems.length,
      duplicateLookingGroups:
        duplicateGroups.length,
      largestItemAmount:
        sortedItems[0]
          ?.absoluteAmount ??
        null,
      expenseConcentrationPercent,
    },

    largestItems:
      sortedItems.slice(0, 12),
    expenseItems:
      expenseItems.slice(0, 20),
    revenueItems:
      revenueItems.slice(0, 20),
    anomalies:
      anomalies.slice(0, 15),
    actions:
      actions.slice(0, 8),
    duplicateGroups,
    documentCoverage,
  };
}