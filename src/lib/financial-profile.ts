import { prisma } from "./prisma";
import type { ExtractedDocumentData } from "./gemini";
import type { DocumentCategory } from "@prisma/client";

export type Alert = {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
};

export type StatBlock = {
  value: string;
  delta: string;
};

export type FinancialProfile = {
  hasData: boolean;
  processedCount: number;
  healthScore: number;
  healthLabel: string;
  revenue: StatBlock;
  expenses: StatBlock;
  profit: StatBlock;
  cash: StatBlock;
  cashFlowTrend: number[];
  cashFlowCaption: string;
  alerts: Alert[];
};

type DocForAnalysis = {
  id: string;
  fileName: string;
  category: DocumentCategory;
  extractedData: ExtractedDocumentData | null;
  uploadedAt: Date;
  docDate: Date;
};

const REVENUE_CATEGORIES: DocumentCategory[] = ["SALES_INVOICE"];
const EXPENSE_CATEGORIES: DocumentCategory[] = ["PURCHASE_INVOICE", "PAYROLL", "UTILITY_BILL"];

const VENDOR_SPIKE_THRESHOLD = 0.2;
const VENDOR_SPIKE_MIN_PREV_AMOUNT = 1;
const DUPLICATE_AMOUNT_TOLERANCE = 0.01;
const DUPLICATE_DAY_WINDOW = 14;
const MARGIN_DROP_THRESHOLD = 0.02;
const RUNWAY_CRITICAL_DAYS = 30;
const RUNWAY_WARNING_DAYS = 90;

const CURRENCY_LOCALES: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  GBP: "en-GB",
  EUR: "en-IE",
  AED: "en-AE",
  SGD: "en-SG",
  AUD: "en-AU",
  CAD: "en-CA",
  JPY: "ja-JP",
};

function normalizeCurrency(currency?: string | null) {
  return currency?.trim().toUpperCase() || null;
}

function formatMoney(amount: number, currency = "INR", alreadyInMillions = false) {
  const normalizedCurrency = normalizeCurrency(currency) ?? "INR";
  const locale = CURRENCY_LOCALES[normalizedCurrency] ?? "en-IN";

  let displayAmount = amount;
  let suffix = "";

  if (alreadyInMillions) {
    suffix = "M";
  } else {
    const absAmount = Math.abs(amount);

    if (absAmount >= 1_000_000_000) {
      displayAmount = amount / 1_000_000_000;
      suffix = "B";
    } else if (absAmount >= 1_000_000) {
      displayAmount = amount / 1_000_000;
      suffix = "M";
    }
  }

  try {
    return (
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: normalizedCurrency,
        minimumFractionDigits: suffix ? 2 : 0,
        maximumFractionDigits: suffix ? 2 : 0,
      }).format(displayAmount) + suffix
    );
  } catch {
    return suffix
      ? `${displayAmount.toLocaleString(locale, { maximumFractionDigits: 2 })}${suffix}`
      : amount.toLocaleString(locale);
  }
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addToMonth(map: Map<string, number>, date: Date, amount: number) {
  if (Number.isNaN(date.getTime())) return;
  const key = monthKey(date);
  map.set(key, (map.get(key) ?? 0) + amount);
}

function pluralize(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function resolveDocDate(data: ExtractedDocumentData | null, uploadedAt: Date): Date {
  const raw = data?.documentDate;
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return uploadedAt;
}

function vendorKey(data: ExtractedDocumentData | null, category: DocumentCategory): string {
  const vendor = data?.vendorOrCounterparty?.trim().toLowerCase();
  return vendor && vendor.length > 0 ? vendor : `category:${category}`;
}

function vendorDisplayName(data: ExtractedDocumentData | null, category: DocumentCategory): string {
  return data?.vendorOrCounterparty?.trim() || category.replace(/_/g, " ").toLowerCase();
}

function emptyProfile(): FinancialProfile {
  return {
    hasData: false,
    processedCount: 0,
    healthScore: 50,
    healthLabel: "Not enough data yet",
    revenue: { value: "—", delta: "No invoices processed yet" },
    expenses: { value: "—", delta: "No bills processed yet" },
    profit: { value: "—", delta: "Upload and process documents to see this" },
    cash: { value: "—", delta: "Upload a bank statement to see this" },
    cashFlowTrend: [],
    cashFlowCaption: "Not enough data yet",
    alerts: [
      {
        id: "empty",
        severity: "info",
        message: "Process your uploaded documents to start building a real financial picture.",
      },
    ],
  };
}

function computeHealthScore(params: { profit: number; revenueTotal: number; cash: number | null }) {
  const { profit, revenueTotal, cash } = params;

  if (revenueTotal === 0 && cash === null) {
    return { score: 50, label: "Not enough data yet" };
  }

  let score = 50;

  if (revenueTotal > 0) {
    const margin = profit / revenueTotal;
    score += Math.max(-30, Math.min(30, margin * 60));
  }

  if (cash !== null) {
    score += cash > 0 ? 10 : -25;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const label =
    score >= 70 ? "Healthy" : score >= 40 ? "Cash runway needs attention" : "At risk — act soon";

  return { score, label };
}

function analyzeRunway(params: {
  cash: number | null;
  bankMonthlyNet: Map<string, number>;
  currency: string;
}): Alert | null {
  const { cash, bankMonthlyNet, currency } = params;
  if (cash === null || cash <= 0) return null;

  const keys = [...bankMonthlyNet.keys()].sort();
  if (keys.length === 0) return null;

  const latestNet = bankMonthlyNet.get(keys[keys.length - 1])!;
  if (latestNet >= 0) return null;

  const monthlyBurn = -latestNet;
  const runwayDays = Math.round(cash / (monthlyBurn / 30));

  if (runwayDays >= RUNWAY_WARNING_DAYS) return null;

  return {
    id: "runway",
    severity: runwayDays < RUNWAY_CRITICAL_DAYS ? "critical" : "warning",
    message: `At the recent burn rate (${formatMoney(
      monthlyBurn,
      currency,
      true,
    )}/month), cash may run out in about ${runwayDays} days.`,
  };
}

function analyzeVendorSpikes(docs: DocForAnalysis[]): Alert[] {
  const vendorMonthly = new Map<string, Map<string, number>>();
  const vendorDisplay = new Map<string, string>();

  for (const doc of docs) {
    if (!EXPENSE_CATEGORIES.includes(doc.category)) continue;
    if (typeof doc.extractedData?.totalAmount !== "number") continue;

    const key = vendorKey(doc.extractedData, doc.category);
    vendorDisplay.set(key, vendorDisplayName(doc.extractedData, doc.category));

    if (!vendorMonthly.has(key)) vendorMonthly.set(key, new Map());
    addToMonth(vendorMonthly.get(key)!, doc.docDate, doc.extractedData.totalAmount);
  }

  const alerts: Alert[] = [];

  for (const [key, monthly] of vendorMonthly) {
    const months = [...monthly.keys()].sort();
    if (months.length < 2) continue;

    const latest = monthly.get(months[months.length - 1])!;
    const previous = monthly.get(months[months.length - 2])!;

    if (previous < VENDOR_SPIKE_MIN_PREV_AMOUNT) continue;

    const change = (latest - previous) / previous;

    if (change >= VENDOR_SPIKE_THRESHOLD) {
      alerts.push({
        id: `vendor-spike-${key}`,
        severity: "warning",
        message: `${vendorDisplay.get(key)} cost ${Math.round(
          change * 100,
        )}% more than the previous month.`,
      });
    }
  }

  return alerts;
}

function analyzeDuplicates(docs: DocForAnalysis[]): Alert[] {
  const candidates = docs.filter(
    (doc) =>
      (EXPENSE_CATEGORIES.includes(doc.category) || REVENUE_CATEGORIES.includes(doc.category)) &&
      typeof doc.extractedData?.totalAmount === "number",
  );

  const alerts: Alert[] = [];
  const flaggedPairs = new Set<string>();

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];

      if (a.category !== b.category) continue;

      const vendorA = vendorKey(a.extractedData, a.category);
      const vendorB = vendorKey(b.extractedData, b.category);
      if (vendorA !== vendorB) continue;
      if (vendorA.startsWith("category:")) continue;

      const amountA = a.extractedData!.totalAmount!;
      const amountB = b.extractedData!.totalAmount!;
      const amountDiff = Math.abs(amountA - amountB) / Math.max(amountA, amountB, 1);

      if (amountDiff > DUPLICATE_AMOUNT_TOLERANCE) continue;

      const daysApart = Math.abs(a.docDate.getTime() - b.docDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysApart > DUPLICATE_DAY_WINDOW) continue;

      const pairKey = [a.id, b.id].sort().join(":");
      if (flaggedPairs.has(pairKey)) continue;

      flaggedPairs.add(pairKey);

      alerts.push({
        id: `duplicate-${pairKey}`,
        severity: "info",
        message: `"${a.fileName}" and "${b.fileName}" look like possible duplicates — same vendor and similar amount, ${Math.round(
          daysApart,
        )} day${Math.round(daysApart) === 1 ? "" : "s"} apart.`,
      });
    }
  }

  return alerts;
}

function analyzeMarginTrend(monthlyRevenue: Map<string, number>, monthlyExpense: Map<string, number>): Alert | null {
  const months = [...new Set([...monthlyRevenue.keys(), ...monthlyExpense.keys()])]
    .filter((m) => (monthlyRevenue.get(m) ?? 0) > 0)
    .sort();

  if (months.length < 2) return null;

  const [prevMonth, latestMonth] = months.slice(-2);

  const prevRevenue = monthlyRevenue.get(prevMonth) ?? 0;
  const latestRevenue = monthlyRevenue.get(latestMonth) ?? 0;
  const prevExpense = monthlyExpense.get(prevMonth) ?? 0;
  const latestExpense = monthlyExpense.get(latestMonth) ?? 0;

  const prevMargin = (prevRevenue - prevExpense) / prevRevenue;
  const latestMargin = (latestRevenue - latestExpense) / latestRevenue;

  if (latestRevenue > prevRevenue && prevMargin - latestMargin >= MARGIN_DROP_THRESHOLD) {
    return {
      id: "margin-trend",
      severity: "warning",
      message: "Revenue is growing, but profit margin is slipping month over month.",
    };
  }

  return null;
}

function buildAlerts(params: {
  hasBankStatement: boolean;
  revenueDocCount: number;
  expenseDocCount: number;
  profit: number;
  cash: number | null;
  currenciesSeen: Set<string>;
  currency: string;
  bankMonthlyNet: Map<string, number>;
  monthlyRevenue: Map<string, number>;
  monthlyExpense: Map<string, number>;
  docs: DocForAnalysis[];
}): Alert[] {
  const {
    hasBankStatement,
    revenueDocCount,
    expenseDocCount,
    profit,
    cash,
    currenciesSeen,
    currency,
    bankMonthlyNet,
    monthlyRevenue,
    monthlyExpense,
    docs,
  } = params;

  const alerts: Alert[] = [];

  if (!hasBankStatement) {
    alerts.push({
      id: "no-bank-statement",
      severity: "info",
      message: "Upload a bank statement to see your real cash position.",
    });
  }

  if (cash !== null && cash < 0) {
    alerts.push({
      id: "negative-balance",
      severity: "critical",
      message: "Your most recent processed bank statement shows a negative balance.",
    });
  }

  if (revenueDocCount === 0) {
    alerts.push({
      id: "no-revenue-docs",
      severity: "info",
      message: `No sales invoices or financial statement revenue found — revenue will read as ${formatMoney(
        0,
        currency,
      )} until you add some.`,
    });
  }

  if (revenueDocCount > 0 && expenseDocCount > 0 && profit < 0) {
    alerts.push({
      id: "expenses-exceed-revenue",
      severity: "warning",
      message: "Expenses currently exceed revenue across your processed documents.",
    });
  }

  if (currenciesSeen.size > 1) {
    alerts.push({
      id: "mixed-currencies",
      severity: "warning",
      message: `Documents in multiple currencies detected (${[...currenciesSeen].join(
        ", ",
      )}) — totals are summed as raw numbers without currency conversion.`,
    });
  }

  const runwayAlert = analyzeRunway({ cash, bankMonthlyNet, currency });
  if (runwayAlert) alerts.push(runwayAlert);

  alerts.push(...analyzeVendorSpikes(docs));
  alerts.push(...analyzeDuplicates(docs));

  const marginAlert = analyzeMarginTrend(monthlyRevenue, monthlyExpense);
  if (marginAlert) alerts.push(marginAlert);

  if (alerts.length === 0) {
    alerts.push({
      id: "all-clear",
      severity: "info",
      message: "Everything looks steady based on what's been processed so far.",
    });
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

export async function getFinancialProfile(userId: string): Promise<FinancialProfile> {
  const business = await prisma.business.findUnique({
    where: { userId },
    select: { currency: true },
  });

  const rawDocuments = await prisma.document.findMany({
    where: { userId, status: "PROCESSED" },
    select: {
      id: true,
      fileName: true,
      category: true,
      extractedData: true,
      uploadedAt: true,
    },
    orderBy: { uploadedAt: "asc" },
  });

  if (rawDocuments.length === 0) {
    return emptyProfile();
  }

  const docs: DocForAnalysis[] = rawDocuments.map((doc) => {
    const data = doc.extractedData as ExtractedDocumentData | null;

    return {
      id: doc.id,
      fileName: doc.fileName,
      category: doc.category,
      extractedData: data,
      uploadedAt: doc.uploadedAt,
      docDate: resolveDocDate(data, doc.uploadedAt),
    };
  });

  const currenciesSeen = new Set<string>();

  for (const doc of docs) {
    const docCurrency = normalizeCurrency(doc.extractedData?.currency);
    if (docCurrency) currenciesSeen.add(docCurrency);
  }

  const firstDocumentCurrency = [...currenciesSeen][0];
  const currency = firstDocumentCurrency ?? normalizeCurrency(business?.currency) ?? "INR";

  let revenueTotal = 0;
  let expenseTotal = 0;
  let revenueDocCount = 0;
  let expenseDocCount = 0;
  let latestBankBalance: number | null = null;
  let latestBankDate: Date | null = null;

  let hasFinancialStatement = false;

  const monthlyNet = new Map<string, number>();
  const monthlyRevenue = new Map<string, number>();
  const monthlyExpense = new Map<string, number>();
  const bankMonthlyNet = new Map<string, number>();

  for (const doc of docs) {
    const data = doc.extractedData;
    if (!data) continue;

    if (doc.category === "FINANCIAL_STATEMENT") {
      hasFinancialStatement = true;

      if (typeof data.revenue === "number") {
        revenueTotal += data.revenue;
        revenueDocCount += 1;
        addToMonth(monthlyNet, doc.docDate, data.revenue);
        addToMonth(monthlyRevenue, doc.docDate, data.revenue);
      }

      if (typeof data.expenses === "number") {
        expenseTotal += data.expenses;
        expenseDocCount += 1;
        addToMonth(monthlyNet, doc.docDate, -data.expenses);
        addToMonth(monthlyExpense, doc.docDate, data.expenses);
      }
    }

    if (REVENUE_CATEGORIES.includes(doc.category) && typeof data.totalAmount === "number") {
      revenueTotal += data.totalAmount;
      revenueDocCount += 1;
      addToMonth(monthlyNet, doc.docDate, data.totalAmount);
      addToMonth(monthlyRevenue, doc.docDate, data.totalAmount);
    }

    if (EXPENSE_CATEGORIES.includes(doc.category) && typeof data.totalAmount === "number") {
      expenseTotal += data.totalAmount;
      expenseDocCount += 1;
      addToMonth(monthlyNet, doc.docDate, -data.totalAmount);
      addToMonth(monthlyExpense, doc.docDate, data.totalAmount);
    }

    if (doc.category === "BANK_STATEMENT") {
      if (typeof data.totalAmount === "number" && (!latestBankDate || doc.uploadedAt > latestBankDate)) {
        latestBankBalance = data.totalAmount;
        latestBankDate = doc.uploadedAt;
      }

      for (const txn of data.transactions ?? []) {
        const signed = txn.direction === "credit" ? txn.amount : -txn.amount;
        const txnDate = new Date(txn.date);

        addToMonth(monthlyNet, txnDate, signed);
        addToMonth(bankMonthlyNet, txnDate, signed);
      }
    }
  }

  const profit = revenueTotal - expenseTotal;
  const cash = latestBankBalance;

  const trendKeys = [...monthlyNet.keys()].sort();
  const cashFlowTrend = trendKeys.map((key) => Math.round(monthlyNet.get(key)!));

  const health = computeHealthScore({ profit, revenueTotal, cash });

  const alerts = buildAlerts({
    hasBankStatement: cash !== null,
    revenueDocCount,
    expenseDocCount,
    profit,
    cash,
    currenciesSeen,
    currency,
    bankMonthlyNet,
    monthlyRevenue,
    monthlyExpense,
    docs,
  });

  const showInMillions = hasFinancialStatement;

  return {
    hasData: true,
    processedCount: docs.length,
    healthScore: health.score,
    healthLabel: health.label,

    revenue: {
      value: formatMoney(revenueTotal, currency, showInMillions),
      delta: revenueDocCount > 0 ? `From ${pluralize(revenueDocCount, "document")}` : "No revenue documents yet",
    },

    expenses: {
      value: formatMoney(expenseTotal, currency, showInMillions),
      delta: expenseDocCount > 0 ? `From ${pluralize(expenseDocCount, "document")}` : "No expense documents yet",
    },

    profit: {
      value: formatMoney(profit, currency, showInMillions),
      delta: profit >= 0 ? "Profitable so far" : "Running a loss so far",
    },

    cash: {
      value: cash !== null ? formatMoney(cash, currency, showInMillions) : "—",
      delta:
        cash !== null && latestBankDate
          ? `As of ${latestBankDate.toLocaleDateString("en-IN")}`
          : "Upload a bank statement to see this",
    },

    cashFlowTrend,
    cashFlowCaption:
      cashFlowTrend.length >= 2
        ? "Net monthly activity from your processed documents"
        : "Process documents across more than one month to see a trend",
    alerts,
  };
}