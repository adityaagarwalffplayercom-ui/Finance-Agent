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
  amount: number;
  description: string;
  score: number;
  source: "line-item" | "raw-text";
};

type NumericToken = {
  raw: string;
  value: number;
  index: number;
  noteLike: boolean;
};

export type FinancialSummaryBackfillOptions = {
  rawText?: string | null;
};

const METRIC_RULES: Record<SummaryMetric, MetricRule> = {
  revenue: {
    categoryHints: ["revenue", "income"],
    patterns: [
      { pattern: /\btotal revenue\b/i, score: 170 },
      { pattern: /\btotal income\b/i, score: 166 },
      { pattern: /\brevenue from operations\b/i, score: 160 },
      { pattern: /\bincome from operations\b/i, score: 158 },
      { pattern: /\bnet sales\b/i, score: 154 },
      { pattern: /\bturnover\b/i, score: 142 },
      { pattern: /^\s*sales\b/i, score: 124 },
      { pattern: /^\s*revenue\b/i, score: 120 },
    ],
    exclusions: [
      /segment revenue/i,
      /revenue recognition/i,
      /\bpercentage\b/i,
      /\bratio\b/i,
      /per share/i,
    ],
  },
  expenses: {
    categoryHints: ["expense", "cost"],
    patterns: [
      { pattern: /\btotal expenses?\b/i, score: 175 },
      { pattern: /\btotal expenditure\b/i, score: 172 },
      { pattern: /\btotal operating expenses?\b/i, score: 168 },
      { pattern: /\btotal costs?\b/i, score: 165 },
      { pattern: /\bexpenses? before tax\b/i, score: 132 },
      { pattern: /^\s*expenses?\b/i, score: 108 },
    ],
    exclusions: [/\bratio\b/i, /\bpercentage\b/i, /per share/i, /tax expense/i],
  },
  netIncome: {
    categoryHints: ["profit", "loss", "income"],
    patterns: [
      {
        pattern: /\bprofit\s*\/?\s*\(?loss\)?\s*for the (?:year|period)\b/i,
        score: 185,
      },
      { pattern: /\bprofit or loss for the (?:year|period)\b/i, score: 184 },
      { pattern: /\bnet profit\s*\/?\s*loss\b/i, score: 182 },
      { pattern: /\bprofit after tax\b/i, score: 180 },
      { pattern: /\bloss after tax\b/i, score: 180 },
      { pattern: /\bnet profit\b/i, score: 176 },
      { pattern: /\bnet loss\b/i, score: 176 },
      { pattern: /\bprofit for the (?:year|period)\b/i, score: 170 },
      { pattern: /\bloss for the (?:year|period)\b/i, score: 170 },
      { pattern: /\bprofit before tax\b/i, score: 132 },
      { pattern: /\bloss before tax\b/i, score: 132 },
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
      { pattern: /^\s*total assets\b/i, score: 190 },
      { pattern: /\btotal assets\b/i, score: 184 },
      { pattern: /\bassets total\b/i, score: 170 },
    ],
    exclusions: [/liabilities/i, /\bratio\b/i, /turnover ratio/i],
  },
  liabilities: {
    categoryHints: ["liability"],
    patterns: [
      { pattern: /^\s*total liabilities\b/i, score: 190 },
      { pattern: /\btotal liabilities excluding equity\b/i, score: 188 },
      { pattern: /\btotal liabilities\b/i, score: 184 },
      { pattern: /\bliabilities total\b/i, score: 170 },
    ],
    exclusions: [
      /liabilities and equity/i,
      /equity and liabilities/i,
      /\bratio\b/i,
    ],
  },
  equity: {
    categoryHints: ["equity", "capital"],
    patterns: [
      { pattern: /^\s*total equity\b/i, score: 190 },
      { pattern: /\btotal shareholders['’]? equity\b/i, score: 188 },
      { pattern: /\bshareholders['’]? funds\b/i, score: 184 },
      { pattern: /\bequity attributable to owners\b/i, score: 180 },
      { pattern: /\bowners['’]? equity\b/i, score: 178 },
      { pattern: /\bcapital and reserves\b/i, score: 172 },
      { pattern: /\bnet worth\b/i, score: 170 },
      { pattern: /\btotal equity\b/i, score: 166 },
    ],
    exclusions: [
      /liabilities and equity/i,
      /equity and liabilities/i,
      /\bratio\b/i,
    ],
  },
  cash: {
    categoryHints: ["asset", "cash", "cash flow"],
    patterns: [
      { pattern: /\bcash and cash equivalents at (?:the )?end\b/i, score: 195 },
      { pattern: /\bclosing cash and cash equivalents\b/i, score: 192 },
      { pattern: /^\s*cash and cash equivalents\b/i, score: 184 },
      { pattern: /\bcash\s*&\s*cash equivalents\b/i, score: 182 },
      { pattern: /\bcash and bank balances\b/i, score: 180 },
      { pattern: /\bcash in hand and bank balances\b/i, score: 176 },
      { pattern: /\bcash equivalents\b/i, score: 168 },
      { pattern: /\bbank balances?\b/i, score: 150 },
    ],
    exclusions: [
      /increase in cash/i,
      /decrease in cash/i,
      /cash generated/i,
      /cash used/i,
      /cash flow from/i,
      /\bratio\b/i,
    ],
  },
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeText(value: unknown) {
  return typeof value === "string"
    ? value
        .replace(/\u0000/g, " ")
        .replace(/&/g, " and ")
        .replace(/[‐‑‒–—]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
    : "";
}

function periodPreferenceScore(
  descriptionValue: unknown,
  dateValue: unknown,
  extracted: ExtractedDocumentData,
) {
  const description = normalizeText(descriptionValue);
  let score = 0;

  if (/\bcurrent (?:year|period)\b/.test(description)) {
    score += 28;
  }

  if (/\bvalue 1\b/.test(description)) {
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

  const itemYear =
    typeof dateValue === "string" ? dateValue.match(/^\d{4}/)?.[0] : null;

  if (currentYear && itemYear === currentYear) {
    score += 8;
  }

  if (description.includes("consolidated")) {
    score += 4;
  }

  return score;
}

function scoreLineItemCandidate(
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

  return (
    phraseScore +
    categoryScore +
    aggregateScore +
    periodPreferenceScore(item.description, item.date, extracted)
  );
}

function findBestLineItemCandidate(
  extracted: ExtractedDocumentData,
  metric: SummaryMetric,
): Candidate | null {
  const lineItems = Array.isArray(extracted.lineItems) ? extracted.lineItems : [];
  let best: Candidate | null = null;

  for (const item of lineItems) {
    const score = scoreLineItemCandidate(item, metric, extracted);

    if (score === null) {
      continue;
    }

    const candidate: Candidate = {
      amount: item.amount,
      description: item.description,
      score,
      source: "line-item",
    };

    if (!best || candidate.score > best.score) {
      best = candidate;
    }
  }

  return best;
}

function parseNumericToken(raw: string) {
  const negativeByBrackets = /^\s*\(.*\)\s*$/.test(raw);
  const cleaned = raw
    .replace(/₹|Rs\.?|INR|USD|US\$|GBP|EUR|CHF|£|\$/gi, "")
    .replace(/[(),\s]/g, "")
    .trim();

  if (!cleaned || cleaned === "-" || cleaned === ".") {
    return null;
  }

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return negativeByBrackets ? -Math.abs(parsed) : parsed;
}

function numericTokens(value: string): NumericToken[] {
  const tokens: NumericToken[] = [];
  const regex =
    /(?:₹|Rs\.?|INR|USD|US\$|GBP|EUR|CHF|£|\$)?\s*\(?\s*-?\d[\d,]*(?:\.\d+)?\s*\)?/gi;
  let match = regex.exec(value);

  while (match) {
    const raw = match[0];
    const parsed = parseNumericToken(raw);
    const nextCharacter = value[match.index + raw.length];

    if (parsed !== null && nextCharacter !== "%") {
      const absoluteInteger = Math.abs(parsed);
      const simpleInteger = /^\s*\d{1,2}\s*$/.test(raw);
      const yearLike =
        /^\s*\d{4}\s*$/.test(raw) &&
        absoluteInteger >= 1900 &&
        absoluteInteger <= 2099;

      if (!yearLike) {
        tokens.push({
          raw,
          value: parsed,
          index: match.index,
          noteLike: simpleInteger && absoluteInteger <= 99,
        });
      }
    }

    match = regex.exec(value);
  }

  return tokens;
}

function chooseCurrentPeriodToken(tokens: NumericToken[]) {
  if (tokens.length === 0) {
    return null;
  }

  const candidates = [...tokens];

  while (
    candidates.length > 1 &&
    candidates[0].noteLike &&
    candidates.slice(1).some((token) => {
      const raw = token.raw;
      return (
        /[,().₹$£€]/.test(raw) ||
        /Rs\.?|INR|USD|GBP|EUR|CHF/i.test(raw) ||
        Math.abs(token.value) >= 100
      );
    })
  ) {
    candidates.shift();
  }

  return candidates[0] ?? null;
}


function detectScaleMultiplier(
  rawText: string,
  extracted: ExtractedDocumentData,
) {
  if (
    isFiniteNumber(extracted.scaleMultiplier) &&
    extracted.scaleMultiplier > 0
  ) {
    return extracted.scaleMultiplier;
  }

  const lower = rawText.toLowerCase().slice(0, 300_000);

  if (/\b(?:figures?|amounts?)\s+(?:are\s+)?in\s+(?:inr\s+|rs\.?\s+)?crores?\b/.test(lower)) {
    return 10_000_000;
  }

  if (/\b(?:figures?|amounts?)\s+(?:are\s+)?in\s+(?:inr\s+|rs\.?\s+)?lakhs?\b/.test(lower)) {
    return 100_000;
  }

  if (/\b(?:figures?|amounts?)\s+(?:are\s+)?in\s+(?:inr\s+|rs\.?\s+)?millions?\b/.test(lower)) {
    return 1_000_000;
  }

  if (/\b(?:figures?|amounts?)\s+(?:are\s+)?in\s+(?:inr\s+|rs\.?\s+)?billions?\b/.test(lower)) {
    return 1_000_000_000;
  }

  if (/\b(?:figures?|amounts?)\s+(?:are\s+)?in\s+(?:inr\s+|rs\.?\s+)?thousands?\b/.test(lower)) {
    return 1_000;
  }

  return 1;
}

function rawTextLines(rawText: string) {
  return rawText
    .replace(/\u0000/g, " ")
    .split(/\r?\n/g)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function findBestRawTextCandidate(
  extracted: ExtractedDocumentData,
  metric: SummaryMetric,
  rawText: string,
): Candidate | null {
  if (!rawText.trim()) {
    return null;
  }

  const rule = METRIC_RULES[metric];
  const lines = rawTextLines(rawText);
  const multiplier = detectScaleMultiplier(rawText, extracted);
  let best: Candidate | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const windows = Array.from({ length: 6 }, (_, offset) =>
      lines
        .slice(lineIndex, lineIndex + offset + 1)
        .filter(Boolean)
        .join(" "),
    ).filter(Boolean);

    for (const window of windows) {
      const normalizedWindow = normalizeText(window);

      if (
        !normalizedWindow ||
        rule.exclusions?.some((pattern) => pattern.test(normalizedWindow))
      ) {
        continue;
      }

      for (const { pattern, score: phraseScore } of rule.patterns) {
        const match = pattern.exec(normalizedWindow);

        if (!match || match.index === undefined) {
          continue;
        }

        const afterLabel = normalizedWindow.slice(match.index + match[0].length);
        const tokens = numericTokens(afterLabel);
        const selectedToken = chooseCurrentPeriodToken(tokens);

        if (!selectedToken || selectedToken.value === 0) {
          continue;
        }

        const formattedAmountBonus = /[,().₹$£€]/.test(selectedToken.raw)
          ? 12
          : 0;
        const multipleValuesBonus = tokens.length > 1 ? 18 : 0;
        const magnitudeBonus = Math.abs(selectedToken.value) >= 100 ? 8 : 0;
        const notePenalty = selectedToken.noteLike ? -45 : 0;
        const periodScore = periodPreferenceScore(window, null, extracted);
        const candidate: Candidate = {
          amount: selectedToken.value * multiplier,
          description: window,
          score:
            phraseScore +
            formattedAmountBonus +
            multipleValuesBonus +
            magnitudeBonus +
            notePenalty +
            periodScore,
          source: "raw-text",
        };

        if (!best || candidate.score > best.score) {
          best = candidate;
        }
      }
    }
  }

  return best;
}

function findBestCandidate(
  extracted: ExtractedDocumentData,
  metric: SummaryMetric,
  rawText: string,
) {
  const lineCandidate = findBestLineItemCandidate(extracted, metric);
  const rawCandidate = findBestRawTextCandidate(extracted, metric, rawText);

  if (!lineCandidate) {
    return rawCandidate;
  }

  if (!rawCandidate) {
    return lineCandidate;
  }

  // Prefer a strong exact aggregate line already extracted into structured data.
  return lineCandidate.score + 6 >= rawCandidate.score
    ? lineCandidate
    : rawCandidate;
}

function hasAnyNumber(data: ExtractedDocumentData, keys: string[]) {
  return keys.some((key) =>
    isFiniteNumber((data as unknown as Record<string, unknown>)[key]),
  );
}

function setEvidence(
  evidence: Record<string, string>,
  key: string,
  candidate: Candidate,
) {
  evidence[key] = `${candidate.source}: ${candidate.description}`.slice(0, 300);
}

function deriveMissingMetrics(
  data: ExtractedDocumentData,
  backfilledFields: string[],
  evidence: Record<string, string>,
) {
  const revenue = isFiniteNumber(data.revenue)
    ? data.revenue
    : isFiniteNumber(data.totalRevenue)
      ? data.totalRevenue
      : isFiniteNumber(data.sales)
        ? data.sales
        : null;
  const expenses = isFiniteNumber(data.expenses)
    ? data.expenses
    : isFiniteNumber(data.totalExpenses)
      ? data.totalExpenses
      : null;
  const netIncome = isFiniteNumber(data.netIncome)
    ? data.netIncome
    : isFiniteNumber(data.profit)
      ? Math.abs(data.profit)
      : isFiniteNumber(data.loss)
        ? -Math.abs(data.loss)
        : null;

  if (expenses === null && revenue !== null && netIncome !== null) {
    const derived = revenue - netIncome;

    if (Number.isFinite(derived) && derived >= 0) {
      data.expenses = derived;
      data.totalExpenses = derived;
      backfilledFields.push("expenses", "totalExpenses");
      evidence.expenses = "derived from revenue - net income";
    }
  }

  if (netIncome === null && revenue !== null && expenses !== null) {
    const derived = revenue - expenses;

    if (Number.isFinite(derived)) {
      data.netIncome = derived;
      backfilledFields.push("netIncome");
      evidence.netIncome = "derived from revenue - expenses";
    }
  }

  const finalNetIncome = isFiniteNumber(data.netIncome) ? data.netIncome : null;

  if (finalNetIncome !== null) {
    if (finalNetIncome < 0) {
      if (!isFiniteNumber(data.loss)) {
        data.loss = Math.abs(finalNetIncome);
        backfilledFields.push("loss");
      }
      data.profit = null;
    } else {
      if (!isFiniteNumber(data.profit)) {
        data.profit = finalNetIncome;
        backfilledFields.push("profit");
      }
      data.loss = null;
    }
  }

  const assets = isFiniteNumber(data.assets) ? data.assets : null;
  const liabilities = isFiniteNumber(data.liabilities) ? data.liabilities : null;
  const equity = isFiniteNumber(data.equity) ? data.equity : null;

  if (liabilities === null && assets !== null && equity !== null) {
    const derived = assets - equity;

    if (Number.isFinite(derived) && derived >= 0) {
      data.liabilities = derived;
      backfilledFields.push("liabilities");
      evidence.liabilities = "derived from assets - equity";
    }
  }

  if (equity === null && assets !== null && liabilities !== null) {
    const derived = assets - liabilities;

    if (Number.isFinite(derived)) {
      data.equity = derived;
      backfilledFields.push("equity");
      evidence.equity = "derived from assets - liabilities";
    }
  }

  if (assets === null && liabilities !== null && equity !== null) {
    const derived = liabilities + equity;

    if (Number.isFinite(derived)) {
      data.assets = derived;
      backfilledFields.push("assets");
      evidence.assets = "derived from liabilities + equity";
    }
  }
}

export type FinancialSummaryBackfillResult = {
  data: ExtractedDocumentData;
  backfilledFields: string[];
  evidence: Record<string, string>;
};

/**
 * Promotes aggregate rows and raw statement text into the top-level summary
 * fields consumed by the review screen, ledger, dashboard and AI context.
 * Existing Gemini values always win. Accounting-identity derivations are used
 * only after direct extraction has failed.
 */
export function backfillFinancialStatementSummary(
  extracted: ExtractedDocumentData,
  options: FinancialSummaryBackfillOptions = {},
): FinancialSummaryBackfillResult {
  const data: ExtractedDocumentData = { ...extracted };
  const backfilledFields: string[] = [];
  const evidence: Record<string, string> = {};
  const rawText = options.rawText ?? "";

  if (!hasAnyNumber(data, ["revenue", "totalRevenue", "sales"])) {
    const candidate = findBestCandidate(data, "revenue", rawText);

    if (candidate) {
      data.revenue = Math.abs(candidate.amount);
      data.totalRevenue = Math.abs(candidate.amount);
      backfilledFields.push("revenue", "totalRevenue");
      setEvidence(evidence, "revenue", candidate);
    }
  }

  if (!hasAnyNumber(data, ["expenses", "totalExpenses"])) {
    const candidate = findBestCandidate(data, "expenses", rawText);

    if (candidate) {
      data.expenses = Math.abs(candidate.amount);
      data.totalExpenses = Math.abs(candidate.amount);
      backfilledFields.push("expenses", "totalExpenses");
      setEvidence(evidence, "expenses", candidate);
    }
  }

  if (!hasAnyNumber(data, ["netIncome", "profit", "loss"])) {
    const candidate = findBestCandidate(data, "netIncome", rawText);

    if (candidate) {
      const description = normalizeText(candidate.description);
      const isLoss = description.includes("loss") || candidate.amount < 0;
      const signedAmount = isLoss
        ? -Math.abs(candidate.amount)
        : Math.abs(candidate.amount);

      data.netIncome = signedAmount;
      if (isLoss) {
        data.loss = Math.abs(candidate.amount);
        data.profit = null;
        backfilledFields.push("netIncome", "loss");
      } else {
        data.profit = Math.abs(candidate.amount);
        data.loss = null;
        backfilledFields.push("netIncome", "profit");
      }
      setEvidence(evidence, "netIncome", candidate);
    }
  } else if (!isFiniteNumber(data.netIncome)) {
    if (isFiniteNumber(data.profit)) {
      data.netIncome = Math.abs(data.profit);
      backfilledFields.push("netIncome");
      evidence.netIncome = "normalized from existing profit";
    } else if (isFiniteNumber(data.loss)) {
      data.netIncome = -Math.abs(data.loss);
      backfilledFields.push("netIncome");
      evidence.netIncome = "normalized from existing loss";
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

    const candidate = findBestCandidate(data, metric, rawText);

    if (!candidate) {
      continue;
    }

    data[metric] = Math.abs(candidate.amount);
    backfilledFields.push(metric);
    setEvidence(evidence, metric, candidate);
  }

  deriveMissingMetrics(data, backfilledFields, evidence);

  return {
    data,
    backfilledFields: [...new Set(backfilledFields)],
    evidence,
  };
}
