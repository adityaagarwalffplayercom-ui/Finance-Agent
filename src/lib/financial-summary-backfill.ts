import type { ExtractedDocumentData } from "./gemini";

type FinancialLineItem = NonNullable<ExtractedDocumentData["lineItems"]>[number];

type SummaryMetric =
  | "revenue"
  | "expenses"
  | "netIncome"
  | "assets"
  | "liabilities"
  | "equity"
  | "cash";

type MetricRule = {
  categoryHints: string[];
  patterns: Array<{ pattern: RegExp; score: number }>;
  exclusions?: RegExp[];
};

type Candidate = {
  item: FinancialLineItem;
  score: number;
};

const METRIC_RULES: Record<SummaryMetric, MetricRule> = {
  revenue: {
    categoryHints: ["revenue", "income"],
    patterns: [
      { pattern: /\btotal revenue\b/i, score: 140 },
      { pattern: /\btotal income\b/i, score: 135 },
      { pattern: /\brevenue from operations\b/i, score: 125 },
      { pattern: /\bincome from operations\b/i, score: 122 },
      { pattern: /\bnet sales\b/i, score: 118 },
      { pattern: /\bturnover\b/i, score: 112 },
      { pattern: /\bsales\b/i, score: 90 },
      { pattern: /\brevenue\b/i, score: 88 },
    ],
    exclusions: [
      /segment revenue/i,
      /revenue recognition/i,
      /percentage/i,
      /ratio/i,
    ],
  },
  expenses: {
    categoryHints: ["expense", "cost"],
    patterns: [
      { pattern: /\btotal expenses?\b/i, score: 145 },
      { pattern: /\btotal expenditure\b/i, score: 142 },
      { pattern: /\btotal costs?\b/i, score: 138 },
      { pattern: /\bexpenses? before tax\b/i, score: 108 },
    ],
    exclusions: [/ratio/i, /percentage/i, /per share/i],
  },
  netIncome: {
    categoryHints: ["profit", "loss", "income"],
    patterns: [
      { pattern: /\bprofit\s*\/?\s*\(loss\)\s*for the (?:year|period)\b/i, score: 155 },
      { pattern: /\bprofit or loss for the (?:year|period)\b/i, score: 154 },
      { pattern: /\bnet profit\s*\/?\s*loss\b/i, score: 152 },
      { pattern: /\bprofit after tax\b/i, score: 150 },
      { pattern: /\bloss after tax\b/i, score: 150 },
      { pattern: /\bnet profit\b/i, score: 148 },
      { pattern: /\bnet loss\b/i, score: 148 },
      { pattern: /\bprofit for the (?:year|period)\b/i, score: 142 },
      { pattern: /\bloss for the (?:year|period)\b/i, score: 142 },
      { pattern: /\bprofit before tax\b/i, score: 112 },
      { pattern: /\bloss before tax\b/i, score: 112 },
    ],
    exclusions: [
      /other comprehensive income/i,
      /earnings per share/i,
      /per share/i,
      /attributable to/i,
      /before exceptional/i,
    ],
  },
  assets: {
    categoryHints: ["asset"],
    patterns: [
      { pattern: /^\s*total assets\b/i, score: 160 },
      { pattern: /\btotal assets\b/i, score: 150 },
    ],
    exclusions: [/liabilities/i, /ratio/i, /turnover/i],
  },
  liabilities: {
    categoryHints: ["liability"],
    patterns: [
      { pattern: /^\s*total liabilities\b/i, score: 160 },
      { pattern: /\btotal liabilities\b/i, score: 150 },
    ],
    exclusions: [
      /liabilities and equity/i,
      /equity and liabilities/i,
      /ratio/i,
    ],
  },
  equity: {
    categoryHints: ["equity", "capital"],
    patterns: [
      { pattern: /^\s*total equity\b/i, score: 160 },
      { pattern: /\btotal shareholders['’]? equity\b/i, score: 158 },
      { pattern: /\bshareholders['’]? funds\b/i, score: 150 },
      { pattern: /\bnet worth\b/i, score: 145 },
      { pattern: /\btotal equity\b/i, score: 140 },
    ],
    exclusions: [
      /liabilities and equity/i,
      /equity and liabilities/i,
      /ratio/i,
    ],
  },
  cash: {
    categoryHints: ["asset", "cash", "cash flow"],
    patterns: [
      { pattern: /\bcash and cash equivalents at (?:the )?end\b/i, score: 165 },
      { pattern: /\bclosing cash and cash equivalents\b/i, score: 162 },
      { pattern: /^\s*cash and cash equivalents\b/i, score: 150 },
      { pattern: /\bcash and bank balances\b/i, score: 145 },
      { pattern: /\bcash equivalents\b/i, score: 130 },
      { pattern: /\bbank balances?\b/i, score: 118 },
    ],
    exclusions: [
      /increase in cash/i,
      /decrease in cash/i,
      /cash generated/i,
      /cash used/i,
      /cash flow from/i,
      /ratio/i,
    ],
  },
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeText(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().toLowerCase()
    : "";
}

function periodPreferenceScore(
  item: FinancialLineItem,
  extracted: ExtractedDocumentData,
) {
  const description = normalizeText(item.description);
  let score = 0;

  if (/\bcurrent (?:year|period)\b/.test(description)) {
    score += 28;
  }

  if (/\bvalue 1\b/.test(description)) {
    // Deterministic table extraction emits the left-most/current-period value first.
    score += 18;
  }

  if (/\bprevious (?:year|period)\b|\bprior (?:year|period)\b/.test(description)) {
    score -= 35;
  }

  if (/\bvalue [2-9]\b/.test(description)) {
    score -= 18;
  }

  const currentYear = extracted.periodEnd?.match(/^\d{4}/)?.[0];

  if (currentYear && description.includes(currentYear)) {
    score += 24;
  }

  const itemYear = item.date?.match(/^\d{4}/)?.[0];

  if (currentYear && itemYear === currentYear) {
    score += 8;
  }

  if (description.includes("consolidated")) {
    score += 4;
  }

  return score;
}

function scoreCandidate(
  item: FinancialLineItem,
  metric: SummaryMetric,
  extracted: ExtractedDocumentData,
) {
  if (!isFiniteNumber(item.amount) || item.amount === 0) {
    return null;
  }

  const rule = METRIC_RULES[metric];
  const description = normalizeText(item.description);

  if (!description || rule.exclusions?.some((pattern) => pattern.test(description))) {
    return null;
  }

  let phraseScore = 0;

  for (const { pattern, score } of rule.patterns) {
    if (pattern.test(description)) {
      phraseScore = Math.max(phraseScore, score);
    }
  }

  if (phraseScore === 0) {
    return null;
  }

  const category = normalizeText(item.category);
  const categoryScore = rule.categoryHints.some((hint) => category.includes(hint))
    ? 10
    : 0;
  const aggregateScore = /\btotal\b|\bnet\b|\bclosing\b/.test(description)
    ? 8
    : 0;

  return phraseScore + categoryScore + aggregateScore + periodPreferenceScore(item, extracted);
}

function findBestCandidate(
  extracted: ExtractedDocumentData,
  metric: SummaryMetric,
): Candidate | null {
  const lineItems = Array.isArray(extracted.lineItems) ? extracted.lineItems : [];
  let best: Candidate | null = null;

  for (const item of lineItems) {
    const score = scoreCandidate(item, metric, extracted);

    if (score === null) {
      continue;
    }

    if (!best || score > best.score) {
      best = { item, score };
    }
  }

  return best;
}

function hasAnyNumber(data: ExtractedDocumentData, keys: string[]) {
  return keys.some((key) =>
    isFiniteNumber((data as unknown as Record<string, unknown>)[key]),
  );
}

export type FinancialSummaryBackfillResult = {
  data: ExtractedDocumentData;
  backfilledFields: string[];
};

/**
 * Promotes trusted aggregate rows into the top-level summary fields consumed by
 * the review screen, ledger summary postings, dashboard and AI context. Existing
 * Gemini values always win; this only fills fields that are absent.
 */
export function backfillFinancialStatementSummary(
  extracted: ExtractedDocumentData,
): FinancialSummaryBackfillResult {
  const data: ExtractedDocumentData = { ...extracted };
  const backfilledFields: string[] = [];

  if (!hasAnyNumber(data, ["revenue", "totalRevenue", "sales"])) {
    const candidate = findBestCandidate(data, "revenue");

    if (candidate) {
      data.revenue = Math.abs(candidate.item.amount);
      data.totalRevenue = Math.abs(candidate.item.amount);
      backfilledFields.push("revenue", "totalRevenue");
    }
  }

  if (!hasAnyNumber(data, ["expenses", "totalExpenses"])) {
    const candidate = findBestCandidate(data, "expenses");

    if (candidate) {
      data.expenses = Math.abs(candidate.item.amount);
      data.totalExpenses = Math.abs(candidate.item.amount);
      backfilledFields.push("expenses", "totalExpenses");
    }
  }

  if (!hasAnyNumber(data, ["netIncome", "profit", "loss"])) {
    const candidate = findBestCandidate(data, "netIncome");

    if (candidate) {
      const description = normalizeText(candidate.item.description);
      const isLoss = description.includes("loss") || candidate.item.amount < 0;
      const signedAmount = isLoss
        ? -Math.abs(candidate.item.amount)
        : Math.abs(candidate.item.amount);

      data.netIncome = signedAmount;

      if (isLoss) {
        data.loss = Math.abs(candidate.item.amount);
        data.profit = null;
        backfilledFields.push("netIncome", "loss");
      } else {
        data.profit = Math.abs(candidate.item.amount);
        data.loss = null;
        backfilledFields.push("netIncome", "profit");
      }
    }
  } else if (!isFiniteNumber(data.netIncome)) {
    if (isFiniteNumber(data.profit)) {
      data.netIncome = Math.abs(data.profit);
      backfilledFields.push("netIncome");
    } else if (isFiniteNumber(data.loss)) {
      data.netIncome = -Math.abs(data.loss);
      backfilledFields.push("netIncome");
    }
  }

  const directMetrics: Array<{
    metric: "assets" | "liabilities" | "equity" | "cash";
    keys: string[];
  }> = [
    { metric: "assets", keys: ["assets"] },
    { metric: "liabilities", keys: ["liabilities"] },
    { metric: "equity", keys: ["equity"] },
    { metric: "cash", keys: ["cash", "closingBalance", "balance"] },
  ];

  for (const { metric, keys } of directMetrics) {
    if (hasAnyNumber(data, keys)) {
      continue;
    }

    const candidate = findBestCandidate(data, metric);

    if (!candidate) {
      continue;
    }

    data[metric] = Math.abs(candidate.item.amount);
    backfilledFields.push(metric);
  }

  return {
    data,
    backfilledFields: [...new Set(backfilledFields)],
  };
}
