import type { ExtractedDocumentData } from "./gemini";

export type FinancialLineItem = NonNullable<
  ExtractedDocumentData["lineItems"]
>[number];

const FINANCIAL_HEADING_WORDS = [
  "balance sheet",
  "statement of financial position",
  "statement of profit",
  "profit and loss",
  "income statement",
  "cash flow",
  "revenue",
  "income",
  "expense",
  "asset",
  "liabilit",
  "equity",
  "capital",
  "reserve",
  "inventory",
  "receivable",
  "payable",
  "borrowings",
  "tax",
  "depreciation",
  "finance cost",
  "employee benefit",
  "operating activities",
  "investing activities",
  "financing activities",
];

const OBVIOUS_NOISE = [
  "registered office",
  "corporate office",
  "board of directors",
  "independent auditor",
  "www.",
  "http://",
  "https://",
  "email:",
  "telephone",
  "cin:",
];

function cleanLine(value: string) {
  return value
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasLetters(value: string) {
  return /[A-Za-z]/.test(value);
}

function hasFinancialNumber(value: string) {
  return /(?:\(?-?\d[\d,]*(?:\.\d+)?\)?)/.test(value);
}

function isNoiseLine(value: string) {
  const lower = value.toLowerCase();

  return OBVIOUS_NOISE.some((phrase) => lower.includes(phrase));
}


function isNumericTableLine(value: string) {
  if (
    !value ||
    value.length > 220 ||
    hasLetters(value) ||
    !hasFinancialNumber(value)
  ) {
    return false;
  }

  const compact = value.replace(/[(),.\s-]/g, "");

  if (!compact || /^\d{4}$/.test(compact)) {
    return false;
  }

  const numberCount = value.match(/\(?-?\d[\d,]*(?:\.\d+)?\)?/g)?.length ?? 0;

  return numberCount > 0;
}

function isLabelContextLine(value: string) {
  return (
    value.length >= 2 &&
    value.length <= 240 &&
    hasLetters(value) &&
    !isNoiseLine(value)
  );
}

function isUsefulHeading(value: string) {
  if (!hasLetters(value) || value.length > 180 || isNoiseLine(value)) {
    return false;
  }

  const lower = value.toLowerCase();

  return FINANCIAL_HEADING_WORDS.some((word) => lower.includes(word));
}

function isFinancialCandidate(value: string) {
  if (
    value.length < 3 ||
    value.length > 500 ||
    isNoiseLine(value) ||
    !hasLetters(value) ||
    !hasFinancialNumber(value)
  ) {
    return false;
  }

  const lower = value.toLowerCase();

  if (/^page\s+\d+/i.test(value) || lower === "annual report") {
    return false;
  }

  return true;
}

/**
 * Reduces a long PDF text dump to table-like financial rows plus nearby section
 * headings. This keeps all pages in consideration while cutting narrative text
 * that tends to make extraction models skip later tables.
 */
export function buildFinancialCandidateText(text: string) {
  const lines = text.split(/\r?\n/g).map(cleanLine);
  const selected = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (isFinancialCandidate(line)) {
      selected.add(index);

      for (
        let context = Math.max(0, index - 2);
        context < index;
        context += 1
      ) {
        if (isLabelContextLine(lines[context])) {
          selected.add(context);
        }
      }

      continue;
    }

    if (isNumericTableLine(line)) {
      for (
        let context = Math.max(0, index - 2);
        context <= Math.min(lines.length - 1, index + 1);
        context += 1
      ) {
        if (context === index || isLabelContextLine(lines[context])) {
          selected.add(context);
        }
      }

      continue;
    }

    if (isUsefulHeading(line)) {
      selected.add(index);
    }
  }

  return [...selected]
    .sort((left, right) => left - right)
    .map((index) => lines[index])
    .filter(Boolean)
    .join("\n");
}

function scoreChunk(chunk: string) {
  const lower = chunk.toLowerCase();
  const lines = chunk.split("\n");
  let score = lines.filter(
    (line) => hasLetters(line) && hasFinancialNumber(line),
  ).length;

  const highValuePhrases = [
    "statement of profit",
    "profit and loss",
    "balance sheet",
    "statement of financial position",
    "cash flow",
    "total revenue",
    "total income",
    "total expenses",
    "total assets",
    "total liabilities",
    "shareholders' equity",
    "profit after tax",
    "loss after tax",
  ];

  for (const phrase of highValuePhrases) {
    if (lower.includes(phrase)) {
      score += 30;
    }
  }

  return score;
}

function chunkByLines(text: string, maxChars: number) {
  const chunks: string[] = [];
  const lines = text.split(/\r?\n/g);
  let current: string[] = [];
  let currentLength = 0;

  for (const line of lines) {
    const nextLength = currentLength + line.length + 1;

    if (current.length > 0 && nextLength > maxChars) {
      chunks.push(current.join("\n"));

      // A small overlap preserves section headings and split table boundaries.
      current = current.slice(-4);
      currentLength = current.reduce(
        (total, item) => total + item.length + 1,
        0,
      );
    }

    current.push(line);
    currentLength += line.length + 1;
  }

  if (current.length > 0) {
    chunks.push(current.join("\n"));
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
}

export function splitFinancialTextIntoChunks(
  text: string,
  options: {
    maxChars?: number;
    maxChunks?: number;
  } = {},
) {
  const maxChars = Math.max(8_000, options.maxChars ?? 42_000);
  const maxChunks = Math.max(1, options.maxChunks ?? 8);
  const candidateText = buildFinancialCandidateText(text);
  const chunks = chunkByLines(candidateText, maxChars);

  if (chunks.length <= maxChunks) {
    return chunks;
  }

  return chunks
    .map((chunk, index) => ({ chunk, index, score: scoreChunk(chunk) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, maxChunks)
    .sort((left, right) => left.index - right.index)
    .map(({ chunk }) => chunk);
}

function normalizeDescription(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? value.trim()
    : parsed.toISOString().slice(0, 10);
}

export function normalizeAndDedupeFinancialLineItems(
  items: unknown[],
): FinancialLineItem[] {
  const seen = new Set<string>();
  const result: FinancialLineItem[] = [];

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
      continue;
    }

    const item = rawItem as Record<string, unknown>;
    const description = normalizeDescription(item.description);
    const amount =
      typeof item.amount === "number"
        ? item.amount
        : typeof item.amount === "string"
          ? Number(item.amount.replace(/,/g, ""))
          : Number.NaN;

    if (!description || !Number.isFinite(amount) || amount === 0) {
      continue;
    }

    const category = normalizeDescription(item.category) || "Other";
    const date = normalizeDate(item.date);
    const key = [
      description.toLowerCase(),
      category.toLowerCase(),
      Math.round(amount * 100) / 100,
      date ?? "",
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({ description, amount, category, date });
  }

  return result;
}
