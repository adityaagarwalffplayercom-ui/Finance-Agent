import { prisma } from "@/lib/prisma";

type CompletenessTone = "good" | "warning" | "danger" | "neutral";

export type DocumentRequirement = {
  id: string;
  label: string;
  description: string;
  required: boolean;
  matchedCategories: string[];
  trustedCount: number;
  pendingCount: number;
  rejectedCount: number;
  failedCount: number;
  totalCount: number;
  present: boolean;
  status: "COMPLETE" | "PENDING_REVIEW" | "MISSING" | "REJECTED_OR_FAILED";
  confidence: number;
  tone: CompletenessTone;
};

export type DocumentCompletenessAction = {
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  detail: string;
};

export type DocumentCompletenessReport = {
  generatedAt: string;
  overallStatus: "STRONG" | "PARTIAL" | "WEAK";
  score: number;
  summary: string;
  trustedDecisionReady: boolean;
  metrics: {
    totalDocuments: number;
    processedDocuments: number;
    approvedDocuments: number;
    pendingReviewDocuments: number;
    rejectedDocuments: number;
    failedDocuments: number;
    requiredAreas: number;
    completedRequiredAreas: number;
    pendingRequiredAreas: number;
    missingRequiredAreas: number;
    coveragePercent: number;
  };
  requirements: DocumentRequirement[];
  dataQuality: {
    documentsWithTotals: number;
    documentsWithDates: number;
    documentsWithCurrency: number;
    documentsWithLineItems: number;
    readableDataScore: number;
  };
  actions: DocumentCompletenessAction[];
  recentDocuments: {
    id: string;
    fileName: string;
    category: string;
    status: string;
    reviewStatus: string;
    uploadedAt: string;
    quality: "GOOD" | "PARTIAL" | "WEAK";
  }[];
};

type JsonRecord = Record<string, unknown>;

type RequirementDefinition = {
  id: string;
  label: string;
  description: string;
  required: boolean;
  categories: string[];
  dataSignals: string[];
};

const REQUIREMENTS: RequirementDefinition[] = [
  {
    id: "financial-statements",
    label: "Financial statements",
    description:
      "Profit and loss, balance sheet, annual report, or previous financial statement.",
    required: true,
    categories: [
      "FINANCIAL_STATEMENT",
      "FINANCIAL_STATEMENTS",
      "ANNUAL_REPORT",
      "PROFIT_AND_LOSS",
      "BALANCE_SHEET",
    ],
    dataSignals: [
      "revenue",
      "expenses",
      "profit",
      "loss",
      "assets",
      "liabilities",
      "equity",
      "balanceSheet",
      "incomeStatement",
    ],
  },
  {
    id: "bank-statements",
    label: "Bank statements",
    description:
      "Bank statements are needed for cash, inflow, outflow, and runway confidence.",
    required: true,
    categories: ["BANK_STATEMENT", "BANK_STATEMENTS", "BANK"],
    dataSignals: [
      "cash",
      "balance",
      "bank",
      "transactions",
      "cashFlow",
      "inflows",
      "outflows",
    ],
  },
  {
    id: "sales-records",
    label: "Sales / revenue records",
    description:
      "Sales invoices or revenue records are needed to verify income quality.",
    required: true,
    categories: [
      "SALES_INVOICE",
      "SALES_INVOICES",
      "INVOICE",
      "REVENUE",
      "SALES",
    ],
    dataSignals: ["sales", "revenue", "income", "customer", "invoice"],
  },
  {
    id: "purchase-expense-records",
    label: "Purchase / expense records",
    description:
      "Purchase invoices, bills, and expense records are needed for cost control.",
    required: true,
    categories: [
      "PURCHASE_INVOICE",
      "PURCHASE_INVOICES",
      "EXPENSE",
      "EXPENSES",
      "BILL",
      "BILLS",
    ],
    dataSignals: [
      "purchase",
      "expense",
      "expenses",
      "cost",
      "vendor",
      "supplier",
      "bill",
    ],
  },
  {
    id: "tax-documents",
    label: "Tax documents",
    description:
      "GST, income tax, VAT, payroll tax, or other compliance documents.",
    required: false,
    categories: ["TAX", "GST", "VAT", "INCOME_TAX", "TAX_RETURN"],
    dataSignals: ["tax", "gst", "vat", "incomeTax", "return", "filing"],
  },
  {
    id: "payroll-records",
    label: "Payroll records",
    description:
      "Payroll documents improve hiring, salary, and employee cost decisions.",
    required: false,
    categories: ["PAYROLL", "SALARY", "WAGES", "EMPLOYEE"],
    dataSignals: ["payroll", "salary", "wages", "employee", "employees"],
  },
  {
    id: "utility-operating-bills",
    label: "Utility / operating bills",
    description:
      "Utilities and operating bills help identify recurring fixed costs.",
    required: false,
    categories: ["UTILITY_BILL", "UTILITY", "OPERATING_EXPENSE"],
    dataSignals: ["utility", "electricity", "rent", "internet", "operating"],
  },
];

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

function collectSearchText(value: unknown, output: string[] = [], depth = 0) {
  if (depth > 8) {
    return output;
  }

  if (typeof value === "string" || typeof value === "number") {
    output.push(String(value));
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectSearchText(item, output, depth + 1);
    }

    return output;
  }

  if (!isRecord(value)) {
    return output;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    output.push(key);
    collectSearchText(nestedValue, output, depth + 1);
  }

  return output;
}

function getSearchText(value: unknown) {
  return collectSearchText(value).join(" ").toLowerCase();
}

function hasTotalsDeep(value: unknown) {
  const searchText = getSearchText(value);

  return (
    hasNonEmptyKeyDeep(value, [
      "revenue",
      "totalRevenue",
      "income",
      "sales",
      "expenses",
      "totalExpenses",
      "profit",
      "loss",
      "netProfit",
      "netLoss",
      "total",
      "amount",
      "assets",
      "liabilities",
      "equity",
      "cash",
    ]) ||
    /\b(revenue|income|sales|expenses|profit|loss|assets|liabilities|equity|cash|total)\b/i.test(
      searchText,
    )
  );
}

function hasDateDeep(value: unknown) {
  const searchText = getSearchText(value);

  return (
    hasNonEmptyKeyDeep(value, [
      "date",
      "documentDate",
      "statementDate",
      "invoiceDate",
      "uploadedAt",
      "period",
      "periodStart",
      "periodEnd",
      "financialYear",
      "fiscalYear",
      "yearEnded",
      "fromDate",
      "toDate",
      "startDate",
      "endDate",
    ]) ||
    /\b(20\d{2}|19\d{2})\b/.test(searchText) ||
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i.test(
      searchText,
    ) ||
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(searchText)
  );
}

function hasCurrencyDeep(value: unknown) {
  const searchText = getSearchText(value);

  return (
    hasNonEmptyKeyDeep(value, [
      "currency",
      "currencyCode",
      "reportingCurrency",
      "functionalCurrency",
      "presentationCurrency",
    ]) ||
    /\b(inr|usd|eur|gbp|aed|cad|aud|sgd|jpy)\b/i.test(searchText) ||
    /₹|\$|€|£|\brs\.?\b|\brupees?\b/i.test(searchText)
  );
}

function hasLineItemsDeep(value: unknown) {
  const searchText = getSearchText(value);

  return (
    hasNonEmptyKeyDeep(value, [
      "lineItems",
      "line_items",
      "transactions",
      "items",
      "entries",
      "rows",
      "table",
      "tables",
      "statementLines",
      "financialLineItems",
    ]) ||
    /\b(particulars|description|amount|debit|credit|balance|expense|revenue)\b/i.test(
      searchText,
    )
  );
}

function hasKeyDeep(value: unknown, signals: string[], depth = 0): boolean {
  if (depth > 6) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasKeyDeep(item, signals, depth + 1));
  }

  if (!isRecord(value)) {
    return false;
  }

  const normalizedSignals = signals.map((signal) =>
    signal.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (
      normalizedSignals.some(
        (signal) =>
          normalizedKey.includes(signal) || signal.includes(normalizedKey),
      )
    ) {
      return true;
    }

    if (hasKeyDeep(nestedValue, signals, depth + 1)) {
      return true;
    }
  }

  return false;
}

function hasNonEmptyKeyDeep(value: unknown, signals: string[], depth = 0): boolean {
  if (depth > 6) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasNonEmptyKeyDeep(item, signals, depth + 1));
  }

  if (!isRecord(value)) {
    return false;
  }

  const normalizedSignals = signals.map((signal) =>
    signal.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");

    const keyMatches = normalizedSignals.some(
      (signal) =>
        normalizedKey.includes(signal) || signal.includes(normalizedKey),
    );

    if (keyMatches) {
      if (Array.isArray(nestedValue) && nestedValue.length > 0) {
        return true;
      }

      if (
        typeof nestedValue === "string" &&
        nestedValue.trim().length > 0 &&
        nestedValue.trim() !== "â€”"
      ) {
        return true;
      }

      if (typeof nestedValue === "number" && Number.isFinite(nestedValue)) {
        return true;
      }

      if (isRecord(nestedValue) && Object.keys(nestedValue).length > 0) {
        return true;
      }
    }

    if (hasNonEmptyKeyDeep(nestedValue, signals, depth + 1)) {
      return true;
    }
  }

  return false;
}

function getDocumentQuality(extractedData: unknown): "GOOD" | "PARTIAL" | "WEAK" {
  if (!isRecord(extractedData)) {
    return "WEAK";
  }

  let score = 0;

  if (hasTotalsDeep(extractedData)) {
    score += 35;
  }

  if (hasDateDeep(extractedData)) {
    score += 20;
  }

  if (hasCurrencyDeep(extractedData)) {
    score += 15;
  }

  if (hasLineItemsDeep(extractedData)) {
    score += 30;
  }

  if (score >= 70) {
    return "GOOD";
  }

  if (score >= 35) {
    return "PARTIAL";
  }

  return "WEAK";
}
function requirementMatchesDocument(
  requirement: RequirementDefinition,
  document: {
    category: string;
    extractedData: unknown;
  },
) {
  const normalizedCategory = normalizeText(document.category);

  const categoryMatches = requirement.categories.some(
    (category) =>
      normalizedCategory === normalizeText(category) ||
      normalizedCategory.includes(normalizeText(category)) ||
      normalizeText(category).includes(normalizedCategory),
  );

  const dataMatches = hasKeyDeep(document.extractedData, requirement.dataSignals);

  return categoryMatches || dataMatches;
}

function getRequirementStatus({
  trustedCount,
  pendingCount,
  rejectedCount,
  failedCount,
}: {
  trustedCount: number;
  pendingCount: number;
  rejectedCount: number;
  failedCount: number;
}): DocumentRequirement["status"] {
  if (trustedCount > 0) {
    return "COMPLETE";
  }

  if (pendingCount > 0) {
    return "PENDING_REVIEW";
  }

  if (rejectedCount > 0 || failedCount > 0) {
    return "REJECTED_OR_FAILED";
  }

  return "MISSING";
}

function getRequirementTone(
  status: DocumentRequirement["status"],
): CompletenessTone {
  if (status === "COMPLETE") return "good";
  if (status === "PENDING_REVIEW") return "warning";
  if (status === "REJECTED_OR_FAILED") return "danger";
  return "neutral";
}

function makeSummary({
  score,
  completedRequiredAreas,
  requiredAreas,
  pendingRequiredAreas,
  missingRequiredAreas,
}: {
  score: number;
  completedRequiredAreas: number;
  requiredAreas: number;
  pendingRequiredAreas: number;
  missingRequiredAreas: number;
}) {
  if (requiredAreas === 0) {
    return "No required document rules are configured yet.";
  }

  if (score >= 80 && missingRequiredAreas === 0) {
    return "Document coverage is strong. AI decisions can rely on the approved document base with better confidence.";
  }

  if (completedRequiredAreas > 0) {
    return `Document coverage is partial. ${completedRequiredAreas}/${requiredAreas} required areas are approved, ${pendingRequiredAreas} are pending review, and ${missingRequiredAreas} are still missing.`;
  }

  return "Document coverage is weak. Upload and approve core finance documents before relying on CFO, Tax, Risk, and Report decisions.";
}

export async function getDocumentCompletenessReport(
  userId: string,
): Promise<DocumentCompletenessReport> {
  const [documents, business] = await Promise.all([
    prisma.document.findMany({
    where: {
      userId,
    },
    select: {
      id: true,
      fileName: true,
      category: true,
      status: true,
      reviewStatus: true,
      uploadedAt: true,
      extractedData: true,
    },
    orderBy: {
      uploadedAt: "desc",
    },    }),
    prisma.business.findUnique({
      where: {
        userId,
      },
      select: {
        currency: true,
      },
    }),
  ]);

  const hasBusinessCurrency =
    typeof business?.currency === "string" &&
    business.currency.trim().length > 0;

  const totalDocuments = documents.length;
  const processedDocuments = documents.filter(
    (document) => String(document.status) === "PROCESSED",
  ).length;
  const approvedDocuments = documents.filter(
    (document) =>
      String(document.status) === "PROCESSED" &&
      String(document.reviewStatus) === "APPROVED",
  ).length;
  const pendingReviewDocuments = documents.filter(
    (document) =>
      String(document.status) === "PROCESSED" &&
      String(document.reviewStatus) === "NEEDS_REVIEW",
  ).length;
  const rejectedDocuments = documents.filter(
    (document) => String(document.reviewStatus) === "REJECTED",
  ).length;
  const failedDocuments = documents.filter(
    (document) => String(document.status) === "FAILED",
  ).length;

  const requirements: DocumentRequirement[] = REQUIREMENTS.map((requirement) => {
    const matchedDocuments = documents.filter((document) =>
      requirementMatchesDocument(requirement, {
        category: String(document.category),
        extractedData: document.extractedData,
      }),
    );

    const trustedCount = matchedDocuments.filter(
      (document) =>
        String(document.status) === "PROCESSED" &&
        String(document.reviewStatus) === "APPROVED",
    ).length;

    const pendingCount = matchedDocuments.filter(
      (document) =>
        String(document.status) === "PROCESSED" &&
        String(document.reviewStatus) === "NEEDS_REVIEW",
    ).length;

    const rejectedCount = matchedDocuments.filter(
      (document) => String(document.reviewStatus) === "REJECTED",
    ).length;

    const failedCount = matchedDocuments.filter(
      (document) => String(document.status) === "FAILED",
    ).length;

    const status = getRequirementStatus({
      trustedCount,
      pendingCount,
      rejectedCount,
      failedCount,
    });

    const confidence =
      status === "COMPLETE"
        ? Math.min(100, 70 + trustedCount * 10)
        : status === "PENDING_REVIEW"
          ? 45
          : status === "REJECTED_OR_FAILED"
            ? 20
            : 0;

    return {
      id: requirement.id,
      label: requirement.label,
      description: requirement.description,
      required: requirement.required,
      matchedCategories: requirement.categories,
      trustedCount,
      pendingCount,
      rejectedCount,
      failedCount,
      totalCount: matchedDocuments.length,
      present: trustedCount > 0 || pendingCount > 0,
      status,
      confidence,
      tone: getRequirementTone(status),
    };
  });

  const requiredRequirements = requirements.filter(
    (requirement) => requirement.required,
  );

  const requiredAreas = requiredRequirements.length;
  const completedRequiredAreas = requiredRequirements.filter(
    (requirement) => requirement.status === "COMPLETE",
  ).length;
  const pendingRequiredAreas = requiredRequirements.filter(
    (requirement) => requirement.status === "PENDING_REVIEW",
  ).length;
  const missingRequiredAreas = requiredRequirements.filter(
    (requirement) =>
      requirement.status === "MISSING" ||
      requirement.status === "REJECTED_OR_FAILED",
  ).length;

  const coveragePercent =
    requiredAreas > 0 ? (completedRequiredAreas / requiredAreas) * 100 : 0;

  const score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        coveragePercent -
          missingRequiredAreas * 8 -
          rejectedDocuments * 3 +
          Math.min(15, approvedDocuments * 2),
      ),
    ),
  );

  const overallStatus =
    score >= 80 && missingRequiredAreas === 0
      ? "STRONG"
      : score >= 45
        ? "PARTIAL"
        : "WEAK";

  const documentsWithTotals = documents.filter((document) =>
    hasTotalsDeep(document.extractedData),
  ).length;

  const documentsWithDates = documents.filter((document) =>
    hasDateDeep(document.extractedData),
  ).length;

  const documentsWithCurrency = documents.filter(
    (document) => hasCurrencyDeep(document.extractedData) || hasBusinessCurrency,
  ).length;

  const documentsWithLineItems = documents.filter((document) =>
    hasLineItemsDeep(document.extractedData),
  ).length;

  const readableDataScore =
    totalDocuments > 0
      ? Math.round(
          ((documentsWithTotals +
            documentsWithDates +
            documentsWithCurrency +
            documentsWithLineItems) /
            (totalDocuments * 4)) *
            100,
        )
      : 0;

  const actions: DocumentCompletenessAction[] = [];

  for (const requirement of requiredRequirements) {
    if (requirement.status === "MISSING") {
      actions.push({
        priority: "HIGH",
        title: `Upload ${requirement.label}`,
        detail: requirement.description,
      });
    }

    if (requirement.status === "PENDING_REVIEW") {
      actions.push({
        priority: "HIGH",
        title: `Review pending ${requirement.label}`,
        detail:
          "Documents are uploaded but not approved yet, so AI decisions cannot fully trust them.",
      });
    }

    if (requirement.status === "REJECTED_OR_FAILED") {
      actions.push({
        priority: "MEDIUM",
        title: `Replace failed or rejected ${requirement.label}`,
        detail:
          "Rejected or failed documents are excluded from dashboard, reports, and AI answers.",
      });
    }
  }

  if (readableDataScore < 55 && totalDocuments > 0) {
    actions.push({
      priority: "MEDIUM",
      title: "Improve readable data quality",
      detail:
        "Some documents do not contain enough totals, dates, currency, or line items. Upload clearer PDFs, Excel files, or CSV exports.",
    });
  }

  if (actions.length === 0) {
    actions.push({
      priority: "LOW",
      title: "Maintain monthly document updates",
      detail:
        "Coverage looks good. Keep uploading bank, sales, expense, and financial statements every month.",
    });
  }

  const trustedDecisionReady =
    completedRequiredAreas >= Math.max(3, requiredAreas - 1) &&
    approvedDocuments > 0 &&
    score >= 70;

  return {
    generatedAt: new Date().toISOString(),
    overallStatus,
    score,
    summary: makeSummary({
      score,
      completedRequiredAreas,
      requiredAreas,
      pendingRequiredAreas,
      missingRequiredAreas,
    }),
    trustedDecisionReady,
    metrics: {
      totalDocuments,
      processedDocuments,
      approvedDocuments,
      pendingReviewDocuments,
      rejectedDocuments,
      failedDocuments,
      requiredAreas,
      completedRequiredAreas,
      pendingRequiredAreas,
      missingRequiredAreas,
      coveragePercent: Math.round(coveragePercent),
    },
    requirements,
    dataQuality: {
      documentsWithTotals,
      documentsWithDates,
      documentsWithCurrency,
      documentsWithLineItems,
      readableDataScore,
    },
    actions,
    recentDocuments: documents.slice(0, 10).map((document) => ({
      id: document.id,
      fileName: document.fileName,
      category: String(document.category),
      status: String(document.status),
      reviewStatus: String(document.reviewStatus),
      uploadedAt: document.uploadedAt.toISOString(),
      quality: getDocumentQuality(document.extractedData),
    })),
  };
}


