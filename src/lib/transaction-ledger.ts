import { createHash } from "node:crypto";
import {
  DocumentCategory,
  DocumentReviewStatus,
  DocumentStatus,
  LedgerDirection,
  LedgerEntryStatus,
  LedgerSourceType,
  Prisma,
} from "@prisma/client";
import type { ExtractedDocumentData } from "./gemini";
import { prisma } from "./prisma";

type LedgerDocument = {
  id: string;
  userId: string;
  fileName: string;
  category: DocumentCategory;
  extractedData: Prisma.JsonValue | null;
};

type LedgerSyncParams = {
  documentId: string;
  userId: string;
};

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function cleanNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = cleanNumber(value);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function parseDate(value: unknown) {
  const raw = cleanString(value);

  if (!raw) {
    return null;
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? `${raw}T00:00:00.000Z`
    : raw;

  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sourceKey(parts: Array<string | number | null | undefined>) {
  return createHash("sha256")
    .update(parts.map((part) => String(part ?? "")).join("|"))
    .digest("hex")
    .slice(0, 32);
}

function normalizeCurrency(value: unknown) {
  const currency = cleanString(value)?.toUpperCase();

  return currency && /^[A-Z]{3}$/.test(currency)
    ? currency
    : "INR";
}

function isOrderDocument(category: DocumentCategory) {
  return (
    category === DocumentCategory.SALES_ORDER ||
    category === DocumentCategory.PURCHASE_ORDER
  );
}

function categoryDirection(category: DocumentCategory) {
  if (
    category === DocumentCategory.SALES_INVOICE ||
    category === DocumentCategory.RECEIPT
  ) {
    return LedgerDirection.CREDIT;
  }

  if (
    category === DocumentCategory.PURCHASE_INVOICE ||
    category === DocumentCategory.PAYROLL ||
    category === DocumentCategory.UTILITY_BILL ||
    category === DocumentCategory.RENT_LEASE ||
    category === DocumentCategory.INSURANCE_DOCUMENT ||
    category === DocumentCategory.TAX_DOCUMENT ||
    category === DocumentCategory.GST_RETURN
  ) {
    return LedgerDirection.DEBIT;
  }

  return LedgerDirection.NEUTRAL;
}

function inferDirection(params: {
  description: string;
  itemCategory: string | null;
  amount: number;
  documentCategory: DocumentCategory;
}) {
  const text =
    `${params.itemCategory ?? ""} ${params.description}`.toLowerCase();

  const creditWords = [
    "revenue",
    "sales",
    "turnover",
    "income",
    "receipt",
    "cash inflow",
    "customer payment",
  ];

  const debitWords = [
    "expense",
    "cost",
    "purchase",
    "salary",
    "payroll",
    "rent",
    "utility",
    "tax",
    "interest",
    "finance cost",
    "cash outflow",
    "vendor payment",
  ];

  if (creditWords.some((word) => text.includes(word))) {
    return LedgerDirection.CREDIT;
  }

  if (debitWords.some((word) => text.includes(word))) {
    return LedgerDirection.DEBIT;
  }

  if (params.amount < 0) {
    return LedgerDirection.DEBIT;
  }

  return categoryDirection(params.documentCategory);
}

function isLikelyAggregateLine(description: string, category: string | null) {
  const text = `${category ?? ""} ${description}`.toLowerCase();

  return [
    "grand total",
    "subtotal",
    "sub total",
    "total revenue",
    "total income",
    "total expense",
    "total expenses",
    "total assets",
    "total liabilities",
    "total equity",
    "gross total",
    "net total",
    "carried forward",
    "brought forward",
  ].some((phrase) => text.includes(phrase));
}

function buildFinancialStatementEntries(params: {
  document: LedgerDocument;
  extracted: ExtractedDocumentData;
  currency: string;
  counterparty: string | null;
}) {
  const { document, extracted, currency, counterparty } = params;
  const statementDate =
    parseDate(extracted.periodEnd) ??
    parseDate(extracted.documentDate);
  const periodStart = cleanString(extracted.periodStart);
  const periodEnd = cleanString(extracted.periodEnd);

  const metrics: Array<{
    key: string;
    label: string;
    amount: number | null;
    direction: LedgerDirection;
  }> = [
    {
      key: "revenue",
      label: "Statement revenue",
      amount: firstNumber(
        extracted.revenue,
        extracted.totalRevenue,
        extracted.sales,
      ),
      direction: LedgerDirection.CREDIT,
    },
    {
      key: "expenses",
      label: "Statement expenses",
      amount: firstNumber(
        extracted.expenses,
        extracted.totalExpenses,
      ),
      direction: LedgerDirection.DEBIT,
    },
    {
      key: "net-income",
      label: "Statement net income",
      amount: firstNumber(
        extracted.netIncome,
        extracted.profit,
        extracted.loss === null || extracted.loss === undefined
          ? null
          : -Math.abs(extracted.loss),
      ),
      direction: LedgerDirection.NEUTRAL,
    },
    {
      key: "assets",
      label: "Statement assets",
      amount: firstNumber(extracted.assets),
      direction: LedgerDirection.NEUTRAL,
    },
    {
      key: "liabilities",
      label: "Statement liabilities",
      amount: firstNumber(extracted.liabilities),
      direction: LedgerDirection.NEUTRAL,
    },
    {
      key: "equity",
      label: "Statement equity",
      amount: firstNumber(extracted.equity),
      direction: LedgerDirection.NEUTRAL,
    },
    {
      key: "cash",
      label: "Statement cash",
      amount: firstNumber(
        extracted.cash,
        extracted.closingBalance,
        extracted.balance,
      ),
      direction: LedgerDirection.NEUTRAL,
    },
  ];

  return metrics.flatMap<Prisma.LedgerEntryCreateManyInput>((metric) => {
    if (metric.amount === null || metric.amount === 0) {
      return [];
    }

    return [
      {
        userId: document.userId,
        documentId: document.id,
        transactionDate: statementDate,
        description: metric.label,
        counterparty,
        category: "Financial statement summary",
        direction: metric.direction,
        amount: Math.abs(metric.amount),
        currency,
        confidence: 0.9,
        status: LedgerEntryStatus.NEEDS_REVIEW,
        sourceType: LedgerSourceType.STATEMENT_LINE,
        sourceLineKey: sourceKey([
          "statement-summary",
          metric.key,
          periodStart,
          periodEnd,
          metric.amount,
        ]),
        metadata: {
          aggregate: true,
          statementMetric: metric.key,
          originalAmount: metric.amount,
          periodStart: periodStart ?? "",
          periodEnd: periodEnd ?? "",
          note:
            "Statement summaries require ledger review because they may overlap with invoices, bills, or bank transactions from the same period.",
        },
      },
    ];
  });
}

function buildDocumentTotalEntry(params: {
  document: LedgerDocument;
  extracted: ExtractedDocumentData;
  currency: string;
  counterparty: string | null;
}) {
  const { document, extracted, currency, counterparty } = params;
  const totalAmount = cleanNumber(extracted.totalAmount);

  if (totalAmount === null || totalAmount === 0) {
    return [];
  }

  const description =
    cleanString(extracted.totalAmountLabel) ??
    `Total from ${document.fileName}`;

  return [
    {
      userId: document.userId,
      documentId: document.id,
      transactionDate: parseDate(extracted.documentDate),
      description,
      counterparty,
      category: document.category.replaceAll("_", " "),
      direction: inferDirection({
        description,
        itemCategory: cleanString(extracted.totalAmountLabel),
        amount: totalAmount,
        documentCategory: document.category,
      }),
      amount: Math.abs(totalAmount),
      currency,
      confidence: 0.94,
      status: LedgerEntryStatus.APPROVED,
      sourceType: LedgerSourceType.DOCUMENT_TOTAL,
      sourceLineKey: sourceKey([
        "document-total",
        description,
        totalAmount,
      ]),
      metadata: {
        originalAmount: totalAmount,
        accountingTreatment:
          "Single document total used to avoid counting invoice or bill components together with their subtotal/total rows.",
      },
    } satisfies Prisma.LedgerEntryCreateManyInput,
  ];
}

function buildFallbackLineEntries(params: {
  document: LedgerDocument;
  extracted: ExtractedDocumentData;
  currency: string;
  counterparty: string | null;
}) {
  const { document, extracted, currency, counterparty } = params;
  const lineItems = Array.isArray(extracted.lineItems)
    ? extracted.lineItems
    : [];

  return lineItems.flatMap<Prisma.LedgerEntryCreateManyInput>((item, index) => {
    const amount = cleanNumber(item.amount);

    if (amount === null || amount === 0) {
      return [];
    }

    const description =
      cleanString(item.description) ??
      `Extracted line ${index + 1}`;
    const itemCategory = cleanString(item.category);

    if (isLikelyAggregateLine(description, itemCategory)) {
      return [];
    }

    const direction = inferDirection({
      description,
      itemCategory,
      amount,
      documentCategory: document.category,
    });

    return [
      {
        userId: document.userId,
        documentId: document.id,
        transactionDate:
          parseDate(item.date) ??
          parseDate(extracted.documentDate),
        description,
        counterparty,
        category: itemCategory,
        direction,
        amount: Math.abs(amount),
        currency,
        confidence: 0.78,
        status: LedgerEntryStatus.NEEDS_REVIEW,
        sourceType: LedgerSourceType.DOCUMENT_LINE,
        sourceLineKey: sourceKey([
          "line-fallback",
          index,
          item.date,
          description,
          itemCategory,
          amount,
          direction,
        ]),
        metadata: {
          sourceIndex: index,
          originalAmount: amount,
          originalCategory: itemCategory ?? "",
          note:
            "No document total was available. This extracted line requires review before it affects trusted financial totals.",
        },
      },
    ];
  });
}

function buildEntries(document: LedgerDocument) {
  if (
    !document.extractedData ||
    typeof document.extractedData !== "object" ||
    Array.isArray(document.extractedData)
  ) {
    return [];
  }

  if (isOrderDocument(document.category)) {
    return [];
  }

  const extracted =
    document.extractedData as unknown as ExtractedDocumentData;
  const currency = normalizeCurrency(extracted.currency);
  const counterparty = cleanString(extracted.vendorOrCounterparty);

  if (document.category === DocumentCategory.FINANCIAL_STATEMENT) {
    return buildFinancialStatementEntries({
      document,
      extracted,
      currency,
      counterparty,
    });
  }

  const transactions = Array.isArray(extracted.transactions)
    ? extracted.transactions
    : [];

  if (transactions.length > 0) {
    return transactions.flatMap<Prisma.LedgerEntryCreateManyInput>(
      (transaction, index) => {
        const amount = cleanNumber(transaction.amount);

        if (amount === null || amount === 0) {
          return [];
        }

        const description =
          cleanString(transaction.description) ??
          `Bank transaction ${index + 1}`;
        const direction =
          transaction.direction === "credit"
            ? LedgerDirection.CREDIT
            : LedgerDirection.DEBIT;

        return [
          {
            userId: document.userId,
            documentId: document.id,
            transactionDate:
              parseDate(transaction.date) ??
              parseDate(extracted.documentDate),
            description,
            counterparty,
            category: "Bank transaction",
            direction,
            amount: Math.abs(amount),
            currency,
            confidence: 0.96,
            status: LedgerEntryStatus.APPROVED,
            sourceType: LedgerSourceType.BANK_TRANSACTION,
            sourceLineKey: sourceKey([
              "transaction",
              index,
              transaction.date,
              description,
              amount,
              direction,
            ]),
            metadata: {
              sourceIndex: index,
              originalDirection: transaction.direction,
              originalAmount: amount,
            },
          },
        ];
      },
    );
  }

  const totalEntries = buildDocumentTotalEntry({
    document,
    extracted,
    currency,
    counterparty,
  });

  if (totalEntries.length > 0) {
    return totalEntries;
  }

  return buildFallbackLineEntries({
    document,
    extracted,
    currency,
    counterparty,
  });
}

async function syncLedgerEntriesFromDocumentInTransaction(
  transaction: Prisma.TransactionClient,
  params: LedgerSyncParams,
) {
  const document = await transaction.document.findFirst({
    where: {
      id: params.documentId,
      userId: params.userId,
    },
    select: {
      id: true,
      userId: true,
      fileName: true,
      category: true,
      status: true,
      reviewStatus: true,
      extractedData: true,
    },
  });

  if (!document) {
    throw new Error("Document not found during ledger sync.");
  }

  if (
    document.status !== DocumentStatus.PROCESSED ||
    document.reviewStatus !== DocumentReviewStatus.APPROVED
  ) {
    await transaction.ledgerEntry.deleteMany({
      where: {
        documentId: params.documentId,
        userId: params.userId,
      },
    });

    return 0;
  }

  const entries = buildEntries(document);

  await transaction.ledgerEntry.deleteMany({
    where: {
      documentId: document.id,
      userId: document.userId,
    },
  });

  if (entries.length > 0) {
    await transaction.ledgerEntry.createMany({
      data: entries,
      skipDuplicates: true,
    });
  }

  return entries.length;
}

export async function removeLedgerEntriesForDocument(params: LedgerSyncParams) {
  return prisma.ledgerEntry.deleteMany({
    where: {
      documentId: params.documentId,
      userId: params.userId,
    },
  });
}

export async function syncLedgerEntriesFromDocument(params: LedgerSyncParams) {
  return prisma.$transaction((transaction) =>
    syncLedgerEntriesFromDocumentInTransaction(transaction, params),
  );
}

export async function syncLedgerForReviewInTransaction(
  transaction: Prisma.TransactionClient,
  params: LedgerSyncParams & {
    reviewStatus: DocumentReviewStatus;
  },
) {
  if (params.reviewStatus === DocumentReviewStatus.APPROVED) {
    return syncLedgerEntriesFromDocumentInTransaction(transaction, {
      documentId: params.documentId,
      userId: params.userId,
    });
  }

  await transaction.ledgerEntry.deleteMany({
    where: {
      documentId: params.documentId,
      userId: params.userId,
    },
  });

  return 0;
}

export async function syncLedgerForReview(params: LedgerSyncParams & {
  reviewStatus: DocumentReviewStatus;
}) {
  return prisma.$transaction((transaction) =>
    syncLedgerForReviewInTransaction(transaction, params),
  );
}

export async function syncAllApprovedDocuments(userId: string) {
  const documents = await prisma.document.findMany({
    where: {
      userId,
      status: DocumentStatus.PROCESSED,
      reviewStatus: DocumentReviewStatus.APPROVED,
    },
    select: {
      id: true,
    },
    orderBy: {
      uploadedAt: "asc",
    },
  });

  let entriesCreated = 0;

  for (const document of documents) {
    entriesCreated += await syncLedgerEntriesFromDocument({
      documentId: document.id,
      userId,
    });
  }

  return {
    documentsSynced: documents.length,
    entriesCreated,
  };
}
