import { prisma } from "@/lib/prisma";

type AnomalyTone = "good" | "warning" | "danger" | "neutral";

export type ExtractedInsightLineItem = {
  id: string;
  label: string;
  amount: number;
  absoluteAmount: number;
  type: "REVENUE" | "EXPENSE" | "CASH" | "UNKNOWN";
  date: string | null;
  sourceDocumentId: string;
  sourceFileName: string;
  sourceCategory: string;
  path: string;
};

export type AnomalyInsight = {
  id: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  detail: string;
  amount: number | null;
  source: string;
  tone: AnomalyTone;
};

export type AnomalyAction = {
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  detail: string;
};

export type AnomalyInsightsReport = {
  generatedAt: string;
  currency: string;
  summary: string;
  score: number;
  status: "STRONG" | "NEEDS_REVIEW" | "WEAK_DATA";
  metrics: {
    approvedDocuments: number;
    documentsWithLineItems: number;
    totalLineItems: number;
    expenseLineItems: number;
    revenueLineItems: number;
    highValueItems: number;
    negativeItems: number;
    duplicateLookingGroups: number;
    largestItemAmount: number | null;
    expenseConcentrationPercent: number | null;
  };
  largestItems: ExtractedInsightLineItem[];
  expenseItems: ExtractedInsightLineItem[];
  revenueItems: ExtractedInsightLineItem[];
  anomalies: AnomalyInsight[];
  actions: AnomalyAction[];
  duplicateGroups: {
    key: string;
    count: number;
    totalAmount: number;
    items: ExtractedInsightLineItem[];
  }[];
  documentCoverage: {
    id: string;
    fileName: string;
    category: string;
    lineItemCount: number;
    quality: "GOOD" | "PARTIAL" | "WEAK";
  }[];
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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
    .replace(/[Rs. $€£]/g, "")
    .trim();

  const isParenthesesNegative = /^\(.*\)$/.test(clean);
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

  const signedNumber = isParenthesesNegative ? -Math.abs(number) : number;

  return signedNumber * multiplier;
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

function readNumber(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const number = toNumber(record[key]);

    if (number !== null) {
      return number;
    }
  }

  return null;
}

function readDate(record: JsonRecord) {
  return (
    readString(record, [
      "date",
      "documentDate",
      "transactionDate",
      "invoiceDate",
      "statementDate",
      "period",
      "year",
      "financialYear",
    ]) || null
  );
}

function inferLineItemType(
  record: JsonRecord,
  label: string,
  amount: number,
): ExtractedInsightLineItem["type"] {
  const text = normalizeText(
    [
      label,
      record.type,
      record.category,
      record.accountType,
      record.classification,
      record.section,
      record.group,
    ].join(" "),
  );

  if (
    text.includes("revenue") ||
    text.includes("sales") ||
    text.includes("income") ||
    text.includes("receipt") ||
    text.includes("credit")
  ) {
    return "REVENUE";
  }

  if (
    text.includes("expense") ||
    text.includes("cost") ||
    text.includes("purchase") ||
    text.includes("salary") ||
    text.includes("payroll") ||
    text.includes("rent") ||
    text.includes("utility") ||
    text.includes("interest") ||
    text.includes("depreciation") ||
    text.includes("admin") ||
    text.includes("marketing") ||
    text.includes("logistics") ||
    text.includes("debit")
  ) {
    return "EXPENSE";
  }

  if (
    text.includes("cash") ||
    text.includes("bank") ||
    text.includes("balance") ||
    text.includes("opening") ||
    text.includes("closing")
  ) {
    return "CASH";
  }

  if (amount < 0) {
    return "EXPENSE";
  }

  return "UNKNOWN";
}

function looksLikeLineItem(record: JsonRecord) {
  const label = readString(record, [
    "description",
    "particulars",
    "name",
    "label",
    "item",
    "account",
    "category",
    "vendor",
    "customer",
    "narration",
  ]);

  const amount = readNumber(record, [
    "amount",
    "value",
    "total",
    "balance",
    "debit",
    "credit",
    "expense",
    "expenses",
    "revenue",
    "income",
    "cost",
  ]);

  return label.length > 0 && amount !== null && Math.abs(amount) > 0;
}

function collectLineItems({
  value,
  sourceDocumentId,
  sourceFileName,
  sourceCategory,
  path,
  output,
  depth = 0,
}: {
  value: unknown;
  sourceDocumentId: string;
  sourceFileName: string;
  sourceCategory: string;
  path: string;
  output: ExtractedInsightLineItem[];
  depth?: number;
}) {
  if (depth > 10) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectLineItems({
        value: item,
        sourceDocumentId,
        sourceFileName,
        sourceCategory,
        path: `${path}[${index}]`,
        output,
        depth: depth + 1,
      });
    });

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (looksLikeLineItem(value)) {
    const label = readString(value, [
      "description",
      "particulars",
      "name",
      "label",
      "item",
      "account",
      "category",
      "vendor",
      "customer",
      "narration",
    ]);

    const amount =
      readNumber(value, [
        "amount",
        "value",
        "total",
        "balance",
        "debit",
        "credit",
        "expense",
        "expenses",
        "revenue",
        "income",
        "cost",
      ]) ?? 0;

    const itemType = inferLineItemType(value, label, amount);

    output.push({
      id: `${sourceDocumentId}-${output.length + 1}`,
      label,
      amount,
      absoluteAmount: Math.abs(amount),
      type: itemType,
      date: readDate(value),
      sourceDocumentId,
      sourceFileName,
      sourceCategory,
      path,
    });
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();

    const usefulNestedKey =
      lowerKey.includes("line") ||
      lowerKey.includes("transaction") ||
      lowerKey.includes("item") ||
      lowerKey.includes("entry") ||
      lowerKey.includes("table") ||
      lowerKey.includes("row") ||
      lowerKey.includes("income") ||
      lowerKey.includes("expense") ||
      lowerKey.includes("asset") ||
      lowerKey.includes("liabilit") ||
      lowerKey.includes("cash") ||
      lowerKey.includes("revenue");

    if (Array.isArray(nestedValue) || isRecord(nestedValue)) {
      collectLineItems({
        value: nestedValue,
        sourceDocumentId,
        sourceFileName,
        sourceCategory,
        path: usefulNestedKey ? `${path}.${key}` : path,
        output,
        depth: depth + 1,
      });
    }
  }
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
  const rupee = "Rs. ";

  if (clean === "INR" || currency.trim() === rupee) return rupee;
  if (clean === "USD" || currency.trim() === "$") return "$";
  if (clean === "GBP" || currency.trim() === "£") return "£";
  if (clean === "EUR" || currency.trim() === "€") return "€";

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

function duplicateKey(item: ExtractedInsightLineItem) {
  const label = normalizeText(item.label)
    .replace(/[^a-z0-9 ]/g, "")
    .trim();

  const roundedAmount = Math.round(item.absoluteAmount);

  return `${label}-${roundedAmount}`;
}

function getDocumentQuality(lineItemCount: number): "GOOD" | "PARTIAL" | "WEAK" {
  if (lineItemCount >= 20) {
    return "GOOD";
  }

  if (lineItemCount >= 5) {
    return "PARTIAL";
  }

  return "WEAK";
}

function makeSummary({
  totalLineItems,
  highValueItems,
  duplicateLookingGroups,
  expenseConcentrationPercent,
}: {
  totalLineItems: number;
  highValueItems: number;
  duplicateLookingGroups: number;
  expenseConcentrationPercent: number | null;
}) {
  if (totalLineItems === 0) {
    return "Analyst engine needs approved documents with extracted line items before it can detect unusual costs or transaction patterns.";
  }

  if (highValueItems > 0 || duplicateLookingGroups > 0) {
    return `Analyst engine found ${highValueItems} high-value item(s) and ${duplicateLookingGroups} duplicate-looking group(s). Review these before relying on final business decisions.`;
  }

  if (
    expenseConcentrationPercent !== null &&
    expenseConcentrationPercent >= 45
  ) {
    return `One cost area appears concentrated at about ${expenseConcentrationPercent.toFixed(
      1,
    )}% of detected expenses. Review concentration risk.`;
  }

  return "Analyst engine did not find major line-item red flags from approved documents. Continue monitoring as more documents are uploaded.";
}

export async function getAnomalyInsightsReport(
  userId: string,
): Promise<AnomalyInsightsReport> {
  const [business, documents] = await Promise.all([
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
        id: true,
        fileName: true,
        category: true,
        extractedData: true,
      },
      orderBy: {
        uploadedAt: "desc",
      },
      take: 80,
    }),
  ]);

  const currency = business?.currency || "INR";

  const allItems: ExtractedInsightLineItem[] = [];
  const documentCoverage: AnomalyInsightsReport["documentCoverage"] = [];

  for (const document of documents) {
    const beforeCount = allItems.length;

    collectLineItems({
      value: document.extractedData,
      sourceDocumentId: document.id,
      sourceFileName: document.fileName,
      sourceCategory: String(document.category),
      path: "extractedData",
      output: allItems,
    });

    const lineItemCount = allItems.length - beforeCount;

    documentCoverage.push({
      id: document.id,
      fileName: document.fileName,
      category: String(document.category),
      lineItemCount,
      quality: getDocumentQuality(lineItemCount),
    });
  }

  const sortedItems = [...allItems].sort(
    (a, b) => b.absoluteAmount - a.absoluteAmount,
  );

  const expenseItems = allItems
    .filter((item) => item.type === "EXPENSE" || item.amount < 0)
    .sort((a, b) => b.absoluteAmount - a.absoluteAmount);

  const revenueItems = allItems
    .filter((item) => item.type === "REVENUE")
    .sort((a, b) => b.absoluteAmount - a.absoluteAmount);

  const totalExpenseAmount = expenseItems.reduce(
    (total, item) => total + item.absoluteAmount,
    0,
  );

  const largestExpenseAmount = expenseItems[0]?.absoluteAmount ?? null;

  const expenseConcentrationPercent =
    largestExpenseAmount !== null && totalExpenseAmount > 0
      ? (largestExpenseAmount / totalExpenseAmount) * 100
      : null;

  const averageAbsoluteAmount =
    allItems.length > 0
      ? allItems.reduce((total, item) => total + item.absoluteAmount, 0) /
        allItems.length
      : 0;

  const highValueThreshold =
    averageAbsoluteAmount > 0 ? averageAbsoluteAmount * 2.5 : 0;

  const highValueItems =
    highValueThreshold > 0
      ? allItems.filter((item) => item.absoluteAmount >= highValueThreshold)
      : [];

  const negativeItems = allItems.filter((item) => item.amount < 0);

  const duplicateMap = new Map<string, ExtractedInsightLineItem[]>();

  for (const item of allItems) {
    if (item.absoluteAmount <= 0 || item.label.trim().length < 3) {
      continue;
    }

    const key = duplicateKey(item);
    const existing = duplicateMap.get(key) ?? [];

    existing.push(item);
    duplicateMap.set(key, existing);
  }

  const duplicateGroups = [...duplicateMap.entries()]
    .filter(([, items]) => items.length >= 2)
    .map(([key, items]) => ({
      key,
      count: items.length,
      totalAmount: items.reduce((total, item) => total + item.absoluteAmount, 0),
      items: items.slice(0, 5),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 8);

  const anomalies: AnomalyInsight[] = [];

  if (allItems.length === 0) {
    anomalies.push({
      id: "no-line-items",
      severity: "HIGH",
      title: "No usable line items detected",
      detail:
        "Approved documents exist, but the analyst could not detect line items. Upload clearer CSV/XLSX files or reprocess documents.",
      amount: null,
      source: "Document extraction",
      tone: "danger",
    });
  }

  for (const item of highValueItems.slice(0, 8)) {
    anomalies.push({
      id: `high-value-${item.id}`,
      severity: "MEDIUM",
      title: "High-value line item",
      detail: `${item.label} is much larger than the average detected item.`,
      amount: item.absoluteAmount,
      source: item.sourceFileName,
      tone: "warning",
    });
  }

  for (const group of duplicateGroups.slice(0, 5)) {
    anomalies.push({
      id: `duplicate-${group.key}`,
      severity: "MEDIUM",
      title: "Duplicate-looking entries",
      detail: `${group.count} entries look similar by name and amount. Check whether they are valid repeated transactions or duplicates.`,
      amount: group.totalAmount,
      source: group.items[0]?.sourceFileName ?? "Multiple documents",
      tone: "warning",
    });
  }

  if (
    expenseConcentrationPercent !== null &&
    expenseConcentrationPercent >= 45 &&
    expenseItems[0]
  ) {
    anomalies.push({
      id: "expense-concentration",
      severity: "HIGH",
      title: "Expense concentration risk",
      detail: `${expenseItems[0].label} appears to represent ${expenseConcentrationPercent.toFixed(
        1,
      )}% of detected expenses.`,
      amount: expenseItems[0].absoluteAmount,
      source: expenseItems[0].sourceFileName,
      tone: "danger",
    });
  }

  if (negativeItems.length > 0) {
    anomalies.push({
      id: "negative-items",
      severity: "LOW",
      title: "Negative amount signals",
      detail: `${negativeItems.length} negative amount item(s) were found. They may be refunds, reversals, losses, or expense entries.`,
      amount: negativeItems.reduce((total, item) => total + item.amount, 0),
      source: "Approved documents",
      tone: "neutral",
    });
  }

  const weakDocuments = documentCoverage.filter(
    (document) => document.quality === "WEAK",
  );

  if (weakDocuments.length > 0) {
    anomalies.push({
      id: "weak-document-line-items",
      severity: "LOW",
      title: "Weak line-item coverage",
      detail: `${weakDocuments.length} approved document(s) have weak line-item extraction.`,
      amount: null,
      source: "Document extraction",
      tone: "neutral",
    });
  }

  const score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        100 -
          anomalies.filter((item) => item.severity === "HIGH").length * 22 -
          anomalies.filter((item) => item.severity === "MEDIUM").length * 10 -
          anomalies.filter((item) => item.severity === "LOW").length * 4,
      ),
    ),
  );

  const status =
    allItems.length === 0
      ? "WEAK_DATA"
      : score >= 75
        ? "STRONG"
        : "NEEDS_REVIEW";

  const actions: AnomalyAction[] = [];

  if (allItems.length === 0) {
    actions.push({
      priority: "HIGH",
      title: "Improve line item extraction",
      detail:
        "Upload Excel/CSV files or readable PDFs with tables. Without line items, anomaly analysis remains weak.",
    });
  }

  if (highValueItems.length > 0) {
    actions.push({
      priority: "HIGH",
      title: "Review high-value items",
      detail: `Start with ${highValueItems
        .slice(0, 3)
        .map((item) => item.label)
        .join(", ")}.`,
    });
  }

  if (duplicateGroups.length > 0) {
    actions.push({
      priority: "MEDIUM",
      title: "Check duplicate-looking entries",
      detail:
        "Similar name and amount entries may be valid recurring transactions, but they should be verified.",
    });
  }

  if (
    expenseConcentrationPercent !== null &&
    expenseConcentrationPercent >= 45
  ) {
    actions.push({
      priority: "HIGH",
      title: "Reduce concentration risk",
      detail:
        "A single expense area dominates detected costs. Negotiate, reduce, or diversify this cost where possible.",
    });
  }

  if (actions.length === 0) {
    actions.push({
      priority: "LOW",
      title: "Keep monitoring monthly",
      detail:
        "No major anomaly actions found. Re-run analysis after every new month of documents.",
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    currency,
    summary: makeSummary({
      totalLineItems: allItems.length,
      highValueItems: highValueItems.length,
      duplicateLookingGroups: duplicateGroups.length,
      expenseConcentrationPercent,
    }),
    score,
    status,
    metrics: {
      approvedDocuments: documents.length,
      documentsWithLineItems: documentCoverage.filter(
        (document) => document.lineItemCount > 0,
      ).length,
      totalLineItems: allItems.length,
      expenseLineItems: expenseItems.length,
      revenueLineItems: revenueItems.length,
      highValueItems: highValueItems.length,
      negativeItems: negativeItems.length,
      duplicateLookingGroups: duplicateGroups.length,
      largestItemAmount: sortedItems[0]?.absoluteAmount ?? null,
      expenseConcentrationPercent,
    },
    largestItems: sortedItems.slice(0, 12),
    expenseItems: expenseItems.slice(0, 12),
    revenueItems: revenueItems.slice(0, 12),
    anomalies: anomalies.slice(0, 18),
    actions,
    duplicateGroups,
    documentCoverage,
  };
}