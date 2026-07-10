import type { ExtractedDocumentData } from "./gemini";

type FallbackLineItem = {
  description: string;
  amount: number;
  category: string | null;
  date: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value.trim();
  }

  return parsed.toISOString().slice(0, 10);
}

function getDocumentFallbackDate(data: ExtractedDocumentData) {
  return (
    normalizeDate(data.documentDate) ||
    normalizeDate(data.periodEnd) ||
    normalizeDate(data.periodStart) ||
    null
  );
}

function pushNumberLineItem(
  items: FallbackLineItem[],
  params: {
    description: string;
    amount: unknown;
    category: string;
    date: string | null;
  },
) {
  const amount = toNumber(params.amount);

  if (amount === null) {
    return;
  }

  items.push({
    description: params.description,
    amount,
    category: params.category,
    date: params.date,
  });
}

function normalizeExistingLineItems(data: ExtractedDocumentData) {
  const items: FallbackLineItem[] = [];

  if (!Array.isArray(data.lineItems)) {
    return items;
  }

  for (const item of data.lineItems) {
    const rawItem = item as unknown;

    if (!isRecord(rawItem)) {
      continue;
    }

    const amount = toNumber(rawItem.amount);

    if (amount === null) {
      continue;
    }

    const description =
      cleanString(rawItem.description) ||
      cleanString(rawItem.name) ||
      cleanString(rawItem.label) ||
      "Extracted line item";

    items.push({
      description,
      amount,
      category: cleanString(rawItem.category, "Other"),
      date: normalizeDate(rawItem.date),
    });
  }

  return items;
}

function buildLineItemsFromTransactions(data: ExtractedDocumentData) {
  const items: FallbackLineItem[] = [];

  if (!Array.isArray(data.transactions)) {
    return items;
  }

  for (const transaction of data.transactions) {
    const rawTransaction = transaction as unknown;

    if (!isRecord(rawTransaction)) {
      continue;
    }

    const amount = toNumber(rawTransaction.amount);

    if (amount === null) {
      continue;
    }

    const direction = cleanString(rawTransaction.direction).toLowerCase();
    const description =
      cleanString(rawTransaction.description) || "Bank transaction";

    items.push({
      description,
      amount: Math.abs(amount),
      category:
        direction === "credit"
          ? "Bank Credit / Revenue"
          : direction === "debit"
            ? "Bank Debit / Expense"
            : "Bank Transaction",
      date: normalizeDate(rawTransaction.date),
    });
  }

  return items;
}

function buildLineItemsFromTotals(data: ExtractedDocumentData) {
  const items: FallbackLineItem[] = [];
  const date = getDocumentFallbackDate(data);

  pushNumberLineItem(items, {
    description: "Revenue",
    amount: data.revenue,
    category: "Revenue",
    date,
  });

  pushNumberLineItem(items, {
    description: "Total revenue",
    amount: data.totalRevenue,
    category: "Revenue",
    date,
  });

  pushNumberLineItem(items, {
    description: "Sales",
    amount: data.sales,
    category: "Revenue",
    date,
  });

  pushNumberLineItem(items, {
    description: "Expenses",
    amount: data.expenses,
    category: "Expense",
    date,
  });

  pushNumberLineItem(items, {
    description: "Total expenses",
    amount: data.totalExpenses,
    category: "Expense",
    date,
  });

  pushNumberLineItem(items, {
    description: "Profit",
    amount: data.profit,
    category: "Profit / Loss",
    date,
  });

  pushNumberLineItem(items, {
    description: "Loss",
    amount: data.loss,
    category: "Profit / Loss",
    date,
  });

  pushNumberLineItem(items, {
    description: "Net income",
    amount: data.netIncome,
    category: "Profit / Loss",
    date,
  });

  pushNumberLineItem(items, {
    description: "Total assets",
    amount: data.assets,
    category: "Asset",
    date,
  });

  pushNumberLineItem(items, {
    description: "Total liabilities",
    amount: data.liabilities,
    category: "Liability",
    date,
  });

  pushNumberLineItem(items, {
    description: "Equity",
    amount: data.equity,
    category: "Equity",
    date,
  });

  pushNumberLineItem(items, {
    description: "Cash",
    amount: data.cash,
    category: "Cash",
    date,
  });

  pushNumberLineItem(items, {
    description: "Opening balance",
    amount: data.openingBalance,
    category: "Cash / Balance",
    date,
  });

  pushNumberLineItem(items, {
    description: "Closing balance",
    amount: data.closingBalance,
    category: "Cash / Balance",
    date,
  });

  pushNumberLineItem(items, {
    description: cleanString(data.totalAmountLabel, "Total amount"),
    amount: data.totalAmount,
    category: "Total",
    date,
  });

  return items;
}

function dedupeLineItems(items: FallbackLineItem[]) {
  const seen = new Set<string>();
  const deduped: FallbackLineItem[] = [];

  for (const item of items) {
    const description = item.description.trim();

    if (!description) {
      continue;
    }

    const key = [
      description.toLowerCase(),
      item.category?.trim().toLowerCase() ?? "",
      item.amount,
      item.date ?? "",
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    deduped.push({
      description,
      amount: item.amount,
      category: item.category ?? "Other",
      date: item.date,
    });
  }

  return deduped;
}

export function ensureExtractedLineItems(
  data: ExtractedDocumentData,
): ExtractedDocumentData {
  const existingLineItems = normalizeExistingLineItems(data);

  if (existingLineItems.length > 0) {
    return {
      ...data,
      lineItems: existingLineItems,
      transactions: Array.isArray(data.transactions) ? data.transactions : [],
    };
  }

  const transactionLineItems = buildLineItemsFromTransactions(data);
  const totalLineItems = buildLineItemsFromTotals(data);

  const fallbackLineItems = dedupeLineItems([
    ...transactionLineItems,
    ...totalLineItems,
  ]);

  return {
    ...data,
    lineItems: fallbackLineItems,
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
  };
}