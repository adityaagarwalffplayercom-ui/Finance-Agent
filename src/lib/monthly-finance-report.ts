import { GoogleGenAI } from "@google/genai";
import { prisma } from "./prisma";
import { getActiveWorkspaceDataScope } from "./active-workspace-data";

export type MonthlyReportMoney = {
  raw: number;
  formatted: string;
};

export type MonthlyReportLineItem = {
  description: string;
  category: string;
  amount: MonthlyReportMoney;
  date: string | null;
  sourceFileName: string;
};

export type MonthlyFinanceReport = {
  generatedAt: string;
  month: string;
  monthLabel: string;
  periodStart: string;
  periodEnd: string;
  business: {
    name: string;
    industry: string;
    businessType: string;
    country: string;
    currency: string;
    financialYear: string;
  };
  metrics: {
    revenue: MonthlyReportMoney;
    expenses: MonthlyReportMoney;
    profit: MonthlyReportMoney;
    cash: MonthlyReportMoney;
    profitMarginPercent: number | null;
    expenseRatioPercent: number | null;
    revenueCoveragePercent: number | null;
  };
  documentSummary: {
    approvedDocumentsUsed: number;
    pendingReviewDocuments: number;
    rejectedDocuments: number;
    processedDocuments: number;
    sourceDocuments: string[];
  };
  topRevenueItems: MonthlyReportLineItem[];
  topExpenseItems: MonthlyReportLineItem[];
  riskSignals: string[];
  opportunities: string[];
  missingData: string[];
  executiveSummary: string;
  aiNarrative: string;
  confidence: "High" | "Medium" | "Low";
};

type ReportDocument = {
  id: string;
  fileName: string;
  category: string;
  extractedData: unknown;
  uploadedAt: Date;
  reviewedAt: Date | null;
};

type NormalizedLineItem = {
  description: string;
  category: string;
  amount: number;
  date: string | null;
  type: "revenue" | "expense" | "cash" | "other";
  sourceFileName: string;
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

function getMonthRange(monthInput?: string | null) {
  const now = new Date();
  const cleaned = monthInput?.trim();

  let year = now.getFullYear();
  let monthIndex = now.getMonth();

  if (cleaned && /^\d{4}-\d{2}$/.test(cleaned)) {
    const [yearText, monthText] = cleaned.split("-");
    year = Number(yearText);
    monthIndex = Number(monthText) - 1;
  }

  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  const month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const monthLabel = start.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return {
    month,
    monthLabel,
    start,
    end,
  };
}

function resolveDocumentDate(document: ReportDocument) {
  const data = document.extractedData;

  if (isRecord(data)) {
    const possibleDates = [
      data.documentDate,
      data.date,
      data.invoiceDate,
      data.statementDate,
      data.reportDate,
      data.periodEnd,
      isRecord(data.statementPeriod) ? data.statementPeriod.endDate : null,
      isRecord(data.period) ? data.period.endDate : null,
    ];

    for (const value of possibleDates) {
      if (typeof value === "string") {
        const parsed = new Date(value);

        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
  }

  return document.uploadedAt;
}

function isInsideRange(date: Date, start: Date, end: Date) {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function formatMoney(value: number, currency: string) {
  const normalizedCurrency = currency?.trim() || "INR";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${normalizedCurrency} ${Math.round(value).toLocaleString("en-IN")}`;
  }
}

function money(value: number, currency: string): MonthlyReportMoney {
  return {
    raw: Number.isFinite(value) ? value : 0,
    formatted: formatMoney(Number.isFinite(value) ? value : 0, currency),
  };
}

function inferLineItemType(input: {
  description: string;
  category: string;
  amount: number;
}): NormalizedLineItem["type"] {
  const text = `${input.description} ${input.category}`.toLowerCase();

  if (
    text.includes("revenue") ||
    text.includes("sales") ||
    text.includes("income") ||
    text.includes("receipt") ||
    text.includes("invoice raised") ||
    text.includes("customer")
  ) {
    return "revenue";
  }

  if (
    text.includes("expense") ||
    text.includes("purchase") ||
    text.includes("salary") ||
    text.includes("rent") ||
    text.includes("utility") ||
    text.includes("bill") ||
    text.includes("cost") ||
    text.includes("payment") ||
    text.includes("payroll")
  ) {
    return "expense";
  }

  if (
    text.includes("cash") ||
    text.includes("bank") ||
    text.includes("balance")
  ) {
    return "cash";
  }

  if (input.amount < 0) {
    return "expense";
  }

  return "other";
}

function extractLineItemsFromDocument(document: ReportDocument) {
  const data = document.extractedData;
  const items: NormalizedLineItem[] = [];

  if (isRecord(data) && Array.isArray(data.lineItems)) {
    for (const rawItem of data.lineItems) {
      if (!isRecord(rawItem)) {
        continue;
      }

      const amount = toNumber(rawItem.amount);

      if (amount === null) {
        continue;
      }

      const description = cleanString(
        rawItem.description,
        cleanString(rawItem.name, "Line item"),
      );

      const category = cleanString(rawItem.category, "Other");
      const date = cleanString(rawItem.date, null as unknown as string);

      const item = {
        description,
        category,
        amount: Math.abs(amount),
        date: date || null,
        type: inferLineItemType({
          description,
          category,
          amount,
        }),
        sourceFileName: document.fileName,
      };

      items.push(item);
    }
  }

  if (items.length > 0) {
    return items;
  }

  if (!isRecord(data)) {
    return items;
  }

  const revenue =
    toNumber(data.revenue) ??
    toNumber(data.totalRevenue) ??
    toNumber(data.sales) ??
    toNumber(isRecord(data.totals) ? data.totals.revenue : null);

  const expenses =
    toNumber(data.expenses) ??
    toNumber(data.totalExpenses) ??
    toNumber(data.costs) ??
    toNumber(isRecord(data.totals) ? data.totals.expenses : null);

  const profit =
    toNumber(data.profit) ??
    toNumber(data.netProfit) ??
    toNumber(data.netIncome) ??
    toNumber(data.profitLoss) ??
    toNumber(isRecord(data.totals) ? data.totals.profit : null);

  const cash =
    toNumber(data.cash) ??
    toNumber(data.cashBalance) ??
    toNumber(data.closingBalance) ??
    toNumber(isRecord(data.totals) ? data.totals.cash : null);

  if (revenue !== null) {
    items.push({
      description: "Extracted revenue total",
      category: "Revenue",
      amount: Math.abs(revenue),
      date: resolveDocumentDate(document).toISOString(),
      type: "revenue",
      sourceFileName: document.fileName,
    });
  }

  if (expenses !== null) {
    items.push({
      description: "Extracted expense total",
      category: "Expenses",
      amount: Math.abs(expenses),
      date: resolveDocumentDate(document).toISOString(),
      type: "expense",
      sourceFileName: document.fileName,
    });
  }

  if (profit !== null) {
    items.push({
      description: "Extracted profit / loss total",
      category: "Profit",
      amount: profit,
      date: resolveDocumentDate(document).toISOString(),
      type: "other",
      sourceFileName: document.fileName,
    });
  }

  if (cash !== null) {
    items.push({
      description: "Extracted cash balance",
      category: "Cash",
      amount: cash,
      date: resolveDocumentDate(document).toISOString(),
      type: "cash",
      sourceFileName: document.fileName,
    });
  }

  return items;
}

function convertLineItem(
  item: NormalizedLineItem,
  currency: string,
): MonthlyReportLineItem {
  return {
    description: item.description,
    category: item.category,
    amount: money(item.amount, currency),
    date: item.date,
    sourceFileName: item.sourceFileName,
  };
}

function getRatio(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return null;
  }

  if (denominator === 0) {
    return null;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

function buildRiskSignals(params: {
  revenue: number;
  expenses: number;
  profit: number;
  cash: number;
  approvedDocumentsUsed: number;
  pendingReviewDocuments: number;
  rejectedDocuments: number;
  lineItemsCount: number;
}) {
  const risks: string[] = [];

  if (params.approvedDocumentsUsed === 0) {
    risks.push(
      "No approved documents were available for this month, so the report confidence is low.",
    );
  }

  if (params.profit < 0) {
    risks.push(
      "The month is showing a loss. Expense control or revenue improvement should be reviewed.",
    );
  }

  if (params.revenue > 0 && params.expenses > params.revenue) {
    risks.push(
      "Expenses are higher than revenue, which can create cash pressure.",
    );
  }

  if (params.revenue === 0 && params.expenses > 0) {
    risks.push(
      "Expenses exist but no revenue was detected in approved documents for this month.",
    );
  }

  if (params.cash <= 0) {
    risks.push(
      "Cash balance was not detected or appears low from approved documents.",
    );
  }

  if (params.pendingReviewDocuments > 0) {
    risks.push(
      `${params.pendingReviewDocuments} processed document(s) still need review before they can be trusted in reports.`,
    );
  }

  if (params.rejectedDocuments > 0) {
    risks.push(
      `${params.rejectedDocuments} rejected document(s) are excluded from this report.`,
    );
  }

  if (params.lineItemsCount === 0) {
    risks.push(
      "No line-level items were detected, so the report relies only on extracted totals.",
    );
  }

  return risks.length > 0
    ? risks
    : ["No major monthly risk signal was detected from approved documents."];
}

function buildOpportunities(params: {
  revenue: number;
  expenses: number;
  profit: number;
  topExpenseItems: NormalizedLineItem[];
  approvedDocumentsUsed: number;
}) {
  const opportunities: string[] = [];

  if (params.expenses > 0) {
    opportunities.push(
      "Review the largest expense categories first because they can improve profit fastest.",
    );
  }

  if (params.revenue > 0) {
    opportunities.push(
      "Compare this month's revenue with next month after uploading more sales documents.",
    );
  }

  if (params.profit < 0) {
    opportunities.push(
      "Set a break-even target by reducing costs or increasing revenue enough to cover the monthly loss.",
    );
  } else if (params.profit > 0) {
    opportunities.push(
      "The business appears profitable for this month. Track whether this profit is repeatable.",
    );
  }

  if (params.topExpenseItems.length > 0) {
    opportunities.push(
      `Start with "${params.topExpenseItems[0].description}" because it is one of the largest detected expense items.`,
    );
  }

  if (params.approvedDocumentsUsed < 3) {
    opportunities.push(
      "Upload bank statements, invoices, and bills for a stronger monthly report.",
    );
  }

  return opportunities;
}

function buildMissingData(params: {
  revenue: number;
  expenses: number;
  cash: number;
  approvedDocumentsUsed: number;
  lineItemsCount: number;
}) {
  const missing: string[] = [];

  if (params.approvedDocumentsUsed === 0) {
    missing.push("Approved documents for this month.");
  }

  if (params.revenue === 0) {
    missing.push("Revenue or sales invoice evidence.");
  }

  if (params.expenses === 0) {
    missing.push("Expense bills, purchase invoices, payroll, or utility bills.");
  }

  if (params.cash === 0) {
    missing.push("Bank statement or cash balance evidence.");
  }

  if (params.lineItemsCount === 0) {
    missing.push("Line item level extraction from documents.");
  }

  return missing.length > 0
    ? missing
    : ["No major missing data detected for this monthly report."];
}

function buildExecutiveSummary(params: {
  monthLabel: string;
  revenue: number;
  expenses: number;
  profit: number;
  currency: string;
  approvedDocumentsUsed: number;
  confidence: "High" | "Medium" | "Low";
}) {
  const profitText =
    params.profit >= 0
      ? `profit of ${formatMoney(params.profit, params.currency)}`
      : `loss of ${formatMoney(Math.abs(params.profit), params.currency)}`;

  return `For ${params.monthLabel}, Actic Finance reviewed ${params.approvedDocumentsUsed} approved document(s). The business shows revenue of ${formatMoney(
    params.revenue,
    params.currency,
  )}, expenses of ${formatMoney(
    params.expenses,
    params.currency,
  )}, and a ${profitText}. Report confidence is ${params.confidence}.`;
}

function getConfidence(params: {
  approvedDocumentsUsed: number;
  lineItemsCount: number;
  revenue: number;
  expenses: number;
}) {
  if (
    params.approvedDocumentsUsed >= 3 &&
    params.lineItemsCount >= 5 &&
    (params.revenue > 0 || params.expenses > 0)
  ) {
    return "High";
  }

  if (params.approvedDocumentsUsed >= 1 && (params.revenue > 0 || params.expenses > 0)) {
    return "Medium";
  }

  return "Low";
}

function buildAiPrompt(report: Omit<MonthlyFinanceReport, "aiNarrative">) {
  return `
You are Actic Finance's CFO Agent. Write a monthly finance report for a small business owner.

Rules:
- Use only the data below.
- Do not invent numbers.
- Mention confidence and missing data.
- Be practical and concise.
- Do not provide legal, tax, investment, or audit certification.

Business:
${JSON.stringify(report.business, null, 2)}

Month:
${report.monthLabel}

Metrics:
${JSON.stringify(report.metrics, null, 2)}

Document summary:
${JSON.stringify(report.documentSummary, null, 2)}

Top revenue items:
${JSON.stringify(report.topRevenueItems, null, 2)}

Top expense items:
${JSON.stringify(report.topExpenseItems, null, 2)}

Risk signals:
${JSON.stringify(report.riskSignals, null, 2)}

Opportunities:
${JSON.stringify(report.opportunities, null, 2)}

Missing data:
${JSON.stringify(report.missingData, null, 2)}

Write in this format:
1. Executive summary
2. What changed this month
3. Risks
4. Recommended next actions
`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorToText(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isRetryableAiError(error: unknown) {
  const text = errorToText(error).toLowerCase();

  return (
    text.includes("503") ||
    text.includes("500") ||
    text.includes("502") ||
    text.includes("504") ||
    text.includes("overloaded") ||
    text.includes("unavailable") ||
    text.includes("429") ||
    text.includes("quota") ||
    text.includes("rate limit")
  );
}

async function generateAiNarrative(
  report: Omit<MonthlyFinanceReport, "aiNarrative">,
) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return [
      report.executiveSummary,
      "",
      "AI narrative is unavailable because GEMINI_API_KEY is not configured.",
    ].join("\n");
  }

  const ai = new GoogleGenAI({
    apiKey,
  });

  const prompt = buildAiPrompt(report);
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.25,
          maxOutputTokens: 1600,
        },
      });

      const text = response.text?.trim();

      if (text) {
        return text;
      }
    } catch (error) {
      console.error(
        `Monthly report AI error attempt ${attempt}/3:`,
        errorToText(error),
      );

      if (!isRetryableAiError(error) || attempt === 3) {
        break;
      }

      await sleep(1500 * attempt);
    }
  }

  return [
    report.executiveSummary,
    "",
    "AI narrative fallback: Gemini was temporarily unavailable, so Actic Finance generated this report from approved document metrics only.",
  ].join("\n");
}

export async function getMonthlyFinanceReport(params: {
  userId: string;
  month?: string | null;
}): Promise<MonthlyFinanceReport> {
  const requestedRange = getMonthRange(params.month);
  const { documentWhere, businessWhere } = await getActiveWorkspaceDataScope(params.userId);

  const [business, approvedDocuments, pendingReviewDocuments, rejectedDocuments, processedDocuments] =
    await Promise.all([
      prisma.business.findFirst({
        where: businessWhere,
        select: {
          name: true,
          industry: true,
          businessType: true,
          country: true,
          currency: true,
          financialYear: true,
        },
      }),
      prisma.document.findMany({
        where: { AND: [documentWhere, { status: "PROCESSED", reviewStatus: "APPROVED" }] },
        orderBy: {
          uploadedAt: "desc",
        },
        take: 100,
        select: {
          id: true,
          fileName: true,
          category: true,
          extractedData: true,
          uploadedAt: true,
          reviewedAt: true,
        },
      }),
      prisma.document.count({
        where: { AND: [documentWhere, { status: "PROCESSED", reviewStatus: "NEEDS_REVIEW" }] },
      }),
      prisma.document.count({
        where: { AND: [documentWhere, { reviewStatus: "REJECTED" }] },
      }),
      prisma.document.count({
        where: { AND: [documentWhere, { status: "PROCESSED" }] },
      }),
    ]);

  let range = requestedRange;

  if (!params.month && approvedDocuments.length > 0) {
    const latestDocumentDate = resolveDocumentDate(
      approvedDocuments[0] as ReportDocument,
    );
    const latestMonth = `${latestDocumentDate.getFullYear()}-${String(
      latestDocumentDate.getMonth() + 1,
    ).padStart(2, "0")}`;
    range = getMonthRange(latestMonth);
  }

  const businessInfo = {
    name: business?.name ?? "Not set",
    industry: business?.industry ?? "Not set",
    businessType: business?.businessType ?? "Not set",
    country: business?.country ?? "Not set",
    currency: business?.currency ?? "INR",
    financialYear: business?.financialYear ?? "Not set",
  };

  const monthlyDocuments = (approvedDocuments as ReportDocument[]).filter(
    (document) => {
      const documentDate = resolveDocumentDate(document);
      return isInsideRange(documentDate, range.start, range.end);
    },
  );

  const lineItems = monthlyDocuments.flatMap((document) =>
    extractLineItemsFromDocument(document),
  );

  const revenue = lineItems
    .filter((item) => item.type === "revenue")
    .reduce((total, item) => total + item.amount, 0);

  const expenses = lineItems
    .filter((item) => item.type === "expense")
    .reduce((total, item) => total + item.amount, 0);

  const cashValues = lineItems
    .filter((item) => item.type === "cash")
    .map((item) => item.amount);

  const cash = cashValues.length > 0 ? cashValues[cashValues.length - 1] : 0;
  const profit = revenue - expenses;

  const topRevenueItems = lineItems
    .filter((item) => item.type === "revenue")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const topExpenseItems = lineItems
    .filter((item) => item.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const confidence = getConfidence({
    approvedDocumentsUsed: monthlyDocuments.length,
    lineItemsCount: lineItems.length,
    revenue,
    expenses,
  });

  const riskSignals = buildRiskSignals({
    revenue,
    expenses,
    profit,
    cash,
    approvedDocumentsUsed: monthlyDocuments.length,
    pendingReviewDocuments,
    rejectedDocuments,
    lineItemsCount: lineItems.length,
  });

  const opportunities = buildOpportunities({
    revenue,
    expenses,
    profit,
    topExpenseItems,
    approvedDocumentsUsed: monthlyDocuments.length,
  });

  const missingData = buildMissingData({
    revenue,
    expenses,
    cash,
    approvedDocumentsUsed: monthlyDocuments.length,
    lineItemsCount: lineItems.length,
  });

  const baseReport: Omit<MonthlyFinanceReport, "aiNarrative"> = {
    generatedAt: new Date().toISOString(),
    month: range.month,
    monthLabel: range.monthLabel,
    periodStart: range.start.toISOString(),
    periodEnd: range.end.toISOString(),
    business: businessInfo,
    metrics: {
      revenue: money(revenue, businessInfo.currency),
      expenses: money(expenses, businessInfo.currency),
      profit: money(profit, businessInfo.currency),
      cash: money(cash, businessInfo.currency),
      profitMarginPercent: getRatio(profit, revenue),
      expenseRatioPercent: getRatio(expenses, revenue),
      revenueCoveragePercent: getRatio(revenue, expenses),
    },
    documentSummary: {
      approvedDocumentsUsed: monthlyDocuments.length,
      pendingReviewDocuments,
      rejectedDocuments,
      processedDocuments,
      sourceDocuments: monthlyDocuments.map((document) => document.fileName),
    },
    topRevenueItems: topRevenueItems.map((item) =>
      convertLineItem(item, businessInfo.currency),
    ),
    topExpenseItems: topExpenseItems.map((item) =>
      convertLineItem(item, businessInfo.currency),
    ),
    riskSignals,
    opportunities,
    missingData,
    executiveSummary: buildExecutiveSummary({
      monthLabel: range.monthLabel,
      revenue,
      expenses,
      profit,
      currency: businessInfo.currency,
      approvedDocumentsUsed: monthlyDocuments.length,
      confidence,
    }),
    confidence,
  };

  const aiNarrative = await generateAiNarrative(baseReport);

  return {
    ...baseReport,
    aiNarrative,
  };
}