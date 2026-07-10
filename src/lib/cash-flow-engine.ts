import { prisma } from "@/lib/prisma";
import { getFinancialProfile } from "@/lib/financial-profile";

type CashFlowTone = "good" | "warning" | "danger" | "neutral";

export type CashFlowMetric = {
  label: string;
  value: string;
  hint: string;
  tone: CashFlowTone;
};

export type CashFlowSignal = {
  id: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  detail: string;
  amount: number | null;
  tone: CashFlowTone;
};

export type CashFlowAction = {
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  detail: string;
};

export type CashFlowLineItem = {
  id: string;
  label: string;
  amount: number;
  absoluteAmount: number;
  type: "INFLOW" | "OUTFLOW" | "UNKNOWN";
  sourceFileName: string;
  sourceCategory: string;
};

export type CashFlowReport = {
  generatedAt: string;
  currency: string;
  summary: string;
  status: "HEALTHY" | "WATCH" | "CRITICAL" | "INSUFFICIENT_DATA";
  score: number;
  metrics: {
    cash: number | null;
    revenue: number | null;
    expenses: number | null;
    profit: number | null;
    estimatedMonthlyBurn: number | null;
    estimatedMonthlyInflow: number | null;
    estimatedMonthlyOutflow: number | null;
    netMonthlyCashFlow: number | null;
    runwayMonths: number | null;
    threeMonthCashNeed: number | null;
    sixMonthCashNeed: number | null;
    cashGapForThreeMonths: number | null;
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

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
    .replace(/[₹$€£]/g, "")
    .trim();

  const isParenthesesNegative = /^\(.*\)$/.test(clean);
  const match = clean.match(/-?\d+(\.\d+)?/);

  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);

  if (!Number.isFinite(parsed)) {
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

  const signed = isParenthesesNegative ? -Math.abs(parsed) : parsed;

  return signed * multiplier;
}

function parseMetricValue(value: string) {
  if (!value || value === "—" || value === "Not available") {
    return null;
  }

  return toNumber(value);
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

  if (clean === "INR") return "Rs. ";
  if (clean === "USD" || currency.trim() === "$") return "$";
  if (clean === "GBP") return "GBP ";
  if (clean === "EUR") return "EUR ";

  return currency ? `${currency} ` : "";
}

function formatMoney(value: number | null, currency: string) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  const sign = value < 0 ? "-" : "";

  return `${sign}${currencySymbol(currency)}${compactNumber(Math.abs(value))}`;
}

function formatMonths(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  return `${value.toFixed(1)} months`;
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

function readAmount(record: JsonRecord) {
  const keys = [
    "amount",
    "value",
    "total",
    "balance",
    "debit",
    "credit",
    "inflow",
    "outflow",
    "revenue",
    "income",
    "expense",
    "expenses",
    "cash",
    "cost",
  ];

  for (const key of keys) {
    const number = toNumber(record[key]);

    if (number !== null) {
      return number;
    }
  }

  return null;
}

function inferCashItemType(
  record: JsonRecord,
  label: string,
  amount: number,
): CashFlowLineItem["type"] {
  const text = [
    label,
    record.type,
    record.category,
    record.section,
    record.classification,
    record.account,
  ]
    .join(" ")
    .toLowerCase();

  if (
    text.includes("inflow") ||
    text.includes("receipt") ||
    text.includes("revenue") ||
    text.includes("income") ||
    text.includes("sales") ||
    text.includes("credit") ||
    text.includes("customer")
  ) {
    return "INFLOW";
  }

  if (
    text.includes("outflow") ||
    text.includes("payment") ||
    text.includes("expense") ||
    text.includes("purchase") ||
    text.includes("salary") ||
    text.includes("rent") ||
    text.includes("debit") ||
    text.includes("vendor") ||
    text.includes("supplier") ||
    text.includes("cost")
  ) {
    return "OUTFLOW";
  }

  if (amount < 0) {
    return "OUTFLOW";
  }

  return "UNKNOWN";
}

function collectCashLineItems({
  value,
  sourceFileName,
  sourceCategory,
  output,
  documentId,
  depth = 0,
}: {
  value: unknown;
  sourceFileName: string;
  sourceCategory: string;
  output: CashFlowLineItem[];
  documentId: string;
  depth?: number;
}) {
  if (depth > 9) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) =>
      collectCashLineItems({
        value: item,
        sourceFileName,
        sourceCategory,
        output,
        documentId,
        depth: depth + 1,
      }),
    );

    return;
  }

  if (!isRecord(value)) {
    return;
  }

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

  const amount = readAmount(value);

  if (label && amount !== null && Math.abs(amount) > 0) {
    const type = inferCashItemType(value, label, amount);

    output.push({
      id: `${documentId}-${output.length + 1}`,
      label,
      amount,
      absoluteAmount: Math.abs(amount),
      type,
      sourceFileName,
      sourceCategory,
    });
  }

  for (const nestedValue of Object.values(value)) {
    if (Array.isArray(nestedValue) || isRecord(nestedValue)) {
      collectCashLineItems({
        value: nestedValue,
        sourceFileName,
        sourceCategory,
        output,
        documentId,
        depth: depth + 1,
      });
    }
  }
}

function makeSummary({
  status,
  runwayMonths,
  netMonthlyCashFlow,
  cashGapForThreeMonths,
  currency,
}: {
  status: CashFlowReport["status"];
  runwayMonths: number | null;
  netMonthlyCashFlow: number | null;
  cashGapForThreeMonths: number | null;
  currency: string;
}) {
  if (status === "INSUFFICIENT_DATA") {
    return "Cash flow engine needs approved cash, revenue, expense, or bank statement data before calculating runway reliably.";
  }

  if (status === "CRITICAL") {
    return `Cash flow looks critical. Estimated runway is ${formatMonths(
      runwayMonths,
    )}, and the 3-month cash gap is ${formatMoney(
      cashGapForThreeMonths,
      currency,
    )}.`;
  }

  if (status === "WATCH") {
    return `Cash flow needs monitoring. Estimated runway is ${formatMonths(
      runwayMonths,
    )}, and estimated monthly net cash flow is ${formatMoney(
      netMonthlyCashFlow,
      currency,
    )}.`;
  }

  return `Cash flow looks healthy. Estimated runway is ${formatMonths(
    runwayMonths,
  )}, with monthly net cash flow around ${formatMoney(
    netMonthlyCashFlow,
    currency,
  )}.`;
}

export async function getCashFlowReport(userId: string): Promise<CashFlowReport> {
  const [profile, business, documents] = await Promise.all([
    getFinancialProfile(userId),
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

  const revenue = parseMetricValue(profile.revenue.value);
  const expenses = parseMetricValue(profile.expenses.value);
  let profit = parseMetricValue(profile.profit.value);
  const cash = parseMetricValue(profile.cash.value);

  if (profit === null && revenue !== null && expenses !== null) {
    profit = revenue - expenses;
  }

  const allItems: CashFlowLineItem[] = [];
  const documentCoverage: CashFlowReport["documentCoverage"] = [];

  for (const document of documents) {
    const before = allItems.length;

    collectCashLineItems({
      value: document.extractedData,
      sourceFileName: document.fileName,
      sourceCategory: String(document.category),
      output: allItems,
      documentId: document.id,
    });

    const lineItemCount = allItems.length - before;

    const cashSignalCount = allItems
      .slice(before)
      .filter((item) => item.type === "INFLOW" || item.type === "OUTFLOW").length;

    documentCoverage.push({
      id: document.id,
      fileName: document.fileName,
      category: String(document.category),
      lineItemCount,
      cashSignalCount,
    });
  }

  const inflows = allItems
    .filter((item) => item.type === "INFLOW")
    .sort((a, b) => b.absoluteAmount - a.absoluteAmount);

  const outflows = allItems
    .filter((item) => item.type === "OUTFLOW")
    .sort((a, b) => b.absoluteAmount - a.absoluteAmount);

  const itemInflowTotal = inflows.reduce(
    (total, item) => total + item.absoluteAmount,
    0,
  );

  const itemOutflowTotal = outflows.reduce(
    (total, item) => total + item.absoluteAmount,
    0,
  );

  const estimatedMonthlyInflow =
    revenue !== null && revenue > 0
      ? revenue / 12
      : itemInflowTotal > 0
        ? itemInflowTotal / 12
        : null;

  const estimatedMonthlyOutflow =
    expenses !== null && expenses > 0
      ? expenses / 12
      : itemOutflowTotal > 0
        ? itemOutflowTotal / 12
        : null;

  const netMonthlyCashFlow =
    estimatedMonthlyInflow !== null && estimatedMonthlyOutflow !== null
      ? estimatedMonthlyInflow - estimatedMonthlyOutflow
      : profit !== null
        ? profit / 12
        : null;

  const estimatedMonthlyBurn =
    netMonthlyCashFlow !== null && netMonthlyCashFlow < 0
      ? Math.abs(netMonthlyCashFlow)
      : estimatedMonthlyOutflow;

  const runwayMonths =
    cash !== null &&
    estimatedMonthlyBurn !== null &&
    estimatedMonthlyBurn > 0
      ? cash / estimatedMonthlyBurn
      : null;

  const threeMonthCashNeed =
    estimatedMonthlyBurn !== null ? estimatedMonthlyBurn * 3 : null;

  const sixMonthCashNeed =
    estimatedMonthlyBurn !== null ? estimatedMonthlyBurn * 6 : null;

  const cashGapForThreeMonths =
    cash !== null && threeMonthCashNeed !== null
      ? Math.max(0, threeMonthCashNeed - cash)
      : null;

  const status: CashFlowReport["status"] =
    cash === null && estimatedMonthlyBurn === null && netMonthlyCashFlow === null
      ? "INSUFFICIENT_DATA"
      : runwayMonths !== null && runwayMonths < 3
        ? "CRITICAL"
        : runwayMonths !== null && runwayMonths < 6
          ? "WATCH"
          : netMonthlyCashFlow !== null && netMonthlyCashFlow < 0
            ? "WATCH"
            : "HEALTHY";

  const score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        status === "INSUFFICIENT_DATA"
          ? 20
          : 100 -
              (runwayMonths !== null && runwayMonths < 3 ? 35 : 0) -
              (runwayMonths !== null && runwayMonths < 6 ? 15 : 0) -
              (netMonthlyCashFlow !== null && netMonthlyCashFlow < 0 ? 20 : 0) -
              (cashGapForThreeMonths !== null && cashGapForThreeMonths > 0
                ? 15
                : 0),
      ),
    ),
  );

  const cards: CashFlowMetric[] = [
    {
      label: "Cash runway",
      value: formatMonths(runwayMonths),
      hint: "Estimated survival time from current cash",
      tone:
        runwayMonths === null
          ? "neutral"
          : runwayMonths >= 6
            ? "good"
            : runwayMonths >= 3
              ? "warning"
              : "danger",
    },
    {
      label: "Monthly burn",
      value: formatMoney(estimatedMonthlyBurn, currency),
      hint: "Estimated monthly cash requirement",
      tone:
        estimatedMonthlyBurn === null
          ? "neutral"
          : netMonthlyCashFlow !== null && netMonthlyCashFlow < 0
            ? "danger"
            : "warning",
    },
    {
      label: "Net monthly cash flow",
      value: formatMoney(netMonthlyCashFlow, currency),
      hint: "Estimated inflow minus outflow",
      tone:
        netMonthlyCashFlow === null
          ? "neutral"
          : netMonthlyCashFlow >= 0
            ? "good"
            : "danger",
    },
    {
      label: "3-month cash gap",
      value: formatMoney(cashGapForThreeMonths, currency),
      hint: "Extra cash needed for 3-month safety",
      tone:
        cashGapForThreeMonths === null
          ? "neutral"
          : cashGapForThreeMonths > 0
            ? "danger"
            : "good",
    },
  ];

  const signals: CashFlowSignal[] = [];

  if (status === "INSUFFICIENT_DATA") {
    signals.push({
      id: "insufficient-data",
      severity: "HIGH",
      title: "Insufficient cash data",
      detail:
        "Upload and approve bank statements, financial statements, or cash flow records to calculate runway.",
      amount: null,
      tone: "danger",
    });
  }

  if (runwayMonths !== null && runwayMonths < 3) {
    signals.push({
      id: "low-runway",
      severity: "HIGH",
      title: "Cash runway below 3 months",
      detail:
        "Runway is below the safe zone. Reduce discretionary spending and improve collections urgently.",
      amount: cash,
      tone: "danger",
    });
  }

  if (netMonthlyCashFlow !== null && netMonthlyCashFlow < 0) {
    signals.push({
      id: "negative-net-cash-flow",
      severity: "HIGH",
      title: "Negative monthly cash flow",
      detail:
        "Estimated monthly outflow is higher than inflow. This creates cash burn.",
      amount: netMonthlyCashFlow,
      tone: "danger",
    });
  }

  if (cashGapForThreeMonths !== null && cashGapForThreeMonths > 0) {
    signals.push({
      id: "three-month-gap",
      severity: "MEDIUM",
      title: "3-month safety gap",
      detail:
        "Current cash may not cover the next 3 months of estimated burn.",
      amount: cashGapForThreeMonths,
      tone: "warning",
    });
  }

  if (outflows.length > 0) {
    signals.push({
      id: "largest-outflow",
      severity: "LOW",
      title: "Largest outflow signal",
      detail: `${outflows[0].label} is the largest detected outflow item.`,
      amount: outflows[0].absoluteAmount,
      tone: "neutral",
    });
  }

  if (signals.length === 0) {
    signals.push({
      id: "healthy-signal",
      severity: "LOW",
      title: "No major cash warning",
      detail:
        "No critical cash flow warning was detected from approved documents.",
      amount: null,
      tone: "good",
    });
  }

  const actions: CashFlowAction[] = [];

  if (status === "INSUFFICIENT_DATA") {
    actions.push({
      priority: "HIGH",
      title: "Upload bank statements",
      detail:
        "Cash runway is weak without bank statements or cash balance records.",
    });
  }

  if (runwayMonths !== null && runwayMonths < 3) {
    actions.push({
      priority: "HIGH",
      title: "Protect cash immediately",
      detail:
        "Delay non-essential spending, pause hiring, and prioritize customer collections.",
    });
  }

  if (netMonthlyCashFlow !== null && netMonthlyCashFlow < 0) {
    actions.push({
      priority: "HIGH",
      title: "Reduce monthly burn",
      detail:
        "Cut recurring expenses or increase recurring inflows until monthly cash flow becomes positive.",
    });
  }

  if (cashGapForThreeMonths !== null && cashGapForThreeMonths > 0) {
    actions.push({
      priority: "MEDIUM",
      title: "Close the 3-month cash gap",
      detail: `Build at least ${formatMoney(
        cashGapForThreeMonths,
        currency,
      )} extra cash buffer for short-term safety.`,
    });
  }

  if (outflows.length > 0) {
    actions.push({
      priority: "MEDIUM",
      title: "Review largest outflows",
      detail: `Start with ${outflows
        .slice(0, 3)
        .map((item) => item.label)
        .join(", ")}.`,
    });
  }

  if (actions.length === 0) {
    actions.push({
      priority: "LOW",
      title: "Maintain cash discipline",
      detail:
        "Cash flow looks stable. Keep monthly bank statements updated for monitoring.",
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    currency,
    summary: makeSummary({
      status,
      runwayMonths,
      netMonthlyCashFlow,
      cashGapForThreeMonths,
      currency,
    }),
    status,
    score,
    metrics: {
      cash,
      revenue,
      expenses,
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
    signals,
    actions,
    topInflows: inflows.slice(0, 10),
    topOutflows: outflows.slice(0, 10),
    documentCoverage,
  };
}