import { GoogleGenAI } from "@google/genai";
import type { ExtractedDocumentData } from "./gemini";

type BankTransaction = NonNullable<
  ExtractedDocumentData["transactions"]
>[number];

type BankChunkPayload = {
  currency?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  vendorOrCounterparty?: string | null;
  openingBalance?: number | null;
  closingBalance?: number | null;
  balance?: number | null;
  totalAmount?: number | null;
  transactions?: BankTransaction[];
};

type ChunkResult = {
  data: BankChunkPayload;
  sourceLabel: string;
};

type ExtractionStats = {
  completedSegments: number;
  failedSegments: number;
  splitRetries: number;
  deterministicFallbackSegments: number;
};

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const PRIMARY_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
const CONFIGURED_FALLBACK_MODELS =
  process.env.GEMINI_FALLBACK_MODELS?.split(",")
    .map((model) => model.trim())
    .filter(Boolean) ?? [];
const FALLBACK_MODELS = [PRIMARY_MODEL, ...CONFIGURED_FALLBACK_MODELS].filter(
  (model, index, models) => model && models.indexOf(model) === index,
);

const DEFAULT_TARGET_CHARS = 9_000;
const DEFAULT_MAX_CHUNKS = 32;
const ABSOLUTE_MAX_CHUNKS = 80;
const MIN_RETRY_SEGMENT_CHARS = 2_400;
const MAX_SPLIT_DEPTH = 4;

const BANK_TRANSACTION_CHUNK_SCHEMA = {
  type: "object",
  properties: {
    currency: { type: "string", nullable: true },
    periodStart: { type: "string", nullable: true },
    periodEnd: { type: "string", nullable: true },
    vendorOrCounterparty: { type: "string", nullable: true },
    openingBalance: { type: "number", nullable: true },
    closingBalance: { type: "number", nullable: true },
    balance: { type: "number", nullable: true },
    totalAmount: { type: "number", nullable: true },
    transactions: {
      type: "array",
      description:
        "Every posted transaction visible in this chunk body, in source order.",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          description: { type: "string" },
          amount: { type: "number" },
          direction: {
            type: "string",
            enum: ["credit", "debit"],
          },
        },
        required: ["date", "description", "amount", "direction"],
      },
    },
  },
  required: ["transactions"],
};

type GenerateContentRequest = Parameters<typeof ai.models.generateContent>[0];

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.replace(/\s+/g, " ").trim()
    : null;
}

function normalizeIsoDate(value: unknown) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const dayFirst = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);

  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    const rawYear = Number(dayFirst[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;

    if (
      day >= 1 &&
      day <= 31 &&
      month >= 1 &&
      month <= 12 &&
      year >= 1900 &&
      year <= 2200
    ) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(
        2,
        "0",
      )}-${String(day).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(text);

  return Number.isNaN(parsed.getTime())
    ? text
    : parsed.toISOString().slice(0, 10);
}

function configuredTargetChars() {
  const configured = Number(
    process.env.GEMINI_BANK_STATEMENT_CHUNK_TARGET_CHARS ??
      DEFAULT_TARGET_CHARS,
  );

  if (!Number.isFinite(configured)) {
    return DEFAULT_TARGET_CHARS;
  }

  return Math.min(14_000, Math.max(4_000, Math.trunc(configured)));
}

function configuredMaxChunks() {
  const configured = Number(
    process.env.GEMINI_MAX_BANK_STATEMENT_CHUNKS ?? DEFAULT_MAX_CHUNKS,
  );

  if (!Number.isFinite(configured)) {
    return DEFAULT_MAX_CHUNKS;
  }

  return Math.min(
    ABSOLUTE_MAX_CHUNKS,
    Math.max(1, Math.trunc(configured)),
  );
}

function configuredMaxOutputTokens() {
  const configured = Number(
    process.env.GEMINI_BANK_STATEMENT_MAX_OUTPUT_TOKENS ?? "8192",
  );

  if (!Number.isFinite(configured)) {
    return 8_192;
  }

  return Math.min(16_384, Math.max(4_096, Math.trunc(configured)));
}

function buildHeaderContext(text: string) {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30)
    .join("\n")
    .slice(0, 6_000);
}

function normalizeSourceText(text: string) {
  return text
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .trim();
}

function splitTextByLines(text: string) {
  const normalized = normalizeSourceText(text);

  if (!normalized) {
    return [];
  }

  const targetChars = configuredTargetChars();
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const line of normalized.split("\n")) {
    const nextLength = currentLength + line.length + 1;

    if (current.length > 0 && nextLength > targetChars) {
      chunks.push(current.join("\n"));
      current = [];
      currentLength = 0;
    }

    current.push(line);
    currentLength += line.length + 1;
  }

  if (current.length > 0) {
    chunks.push(current.join("\n"));
  }

  const maxChunks = configuredMaxChunks();

  if (chunks.length > maxChunks) {
    throw new Error(
      [
        `Bank statement requires ${chunks.length} extraction chunks, but the configured maximum is ${maxChunks}.`,
        "Increase GEMINI_MAX_BANK_STATEMENT_CHUNKS so the complete statement is not truncated.",
      ].join(" "),
    );
  }

  return chunks;
}

function splitSegmentInHalf(text: string) {
  const lines = normalizeSourceText(text).split("\n");

  if (lines.length < 2) {
    return null;
  }

  const totalLength = lines.reduce((sum, line) => sum + line.length + 1, 0);
  const halfway = totalLength / 2;
  let running = 0;
  let splitIndex = 1;

  for (let index = 0; index < lines.length - 1; index += 1) {
    running += lines[index].length + 1;

    if (running >= halfway) {
      splitIndex = index + 1;
      break;
    }
  }

  const left = lines.slice(0, splitIndex).join("\n").trim();
  const right = lines.slice(splitIndex).join("\n").trim();

  return left && right ? [left, right] as const : null;
}

function buildChunkPrompt(params: {
  fileName: string;
  headerContext: string;
  chunk: string;
  sourceLabel: string;
}) {
  return `
You are Actic Finance's bank-statement transaction extraction engine.

File: "${params.fileName}"
Segment: ${params.sourceLabel}

Return one JSON object matching the supplied schema. Return transactions from
SEGMENT BODY only. The header context exists only to explain the bank, account,
column order, currency, and date format.

MANDATORY RULES:
- Extract EVERY posted transaction visible in SEGMENT BODY, in source order.
- Do not stop after an arbitrary number of rows.
- Do not return lineItems or a prose summary.
- Keep the complete transaction narration/description.
- Amount must be a positive number; direction must be credit or debit.
- Preserve genuine duplicate transactions. Equal amounts can be separate rows.
- Do not convert opening balance, closing balance, brought-forward/carried-forward
  balance, column headers, totals, page numbers, or footers into transactions.
- If debit and credit are separate columns, use the non-empty column.
- If the statement uses DR/CR markers, map DR to debit and CR to credit.
- Never invent a transaction or silently omit a readable posted row.
- Dates should be YYYY-MM-DD where determinable.
- Currency and balances may be returned only when explicitly visible.

HEADER CONTEXT — DO NOT EXTRACT TRANSACTIONS FROM THIS SECTION:
${params.headerContext || "Header unavailable"}

SEGMENT BODY:
${params.chunk}
`.trim();
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

function isRetryableGeminiError(error: unknown) {
  const text = errorToText(error).toLowerCase();

  return [
    "503",
    "500",
    "502",
    "504",
    "unavailable",
    "high demand",
    "overloaded",
    "temporarily",
    "resource_exhausted",
    "429",
    "quota",
    "rate limit",
  ].some((value) => text.includes(value));
}

function isQuotaLikeError(error: unknown) {
  const text = errorToText(error).toLowerCase();

  return ["429", "resource_exhausted", "quota", "rate limit"].some(
    (value) => text.includes(value),
  );
}

function getRetryDelayMs(error: unknown, attempt: number) {
  const text = errorToText(error);
  const retryInMatch = text.match(/retry in\s+([\d.]+)s/i);
  const retryDelayMatch = text.match(/"retryDelay"\s*:\s*"([\d.]+)s"/i);
  const secondsText = retryInMatch?.[1] ?? retryDelayMatch?.[1];

  if (secondsText) {
    const seconds = Number(secondsText);

    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds * 1_000) + 1_500;
    }
  }

  return Math.min(45_000, 3_000 * attempt);
}

function buildRequestWithModel(
  request: GenerateContentRequest,
  model: string,
): GenerateContentRequest {
  return {
    ...request,
    model,
  };
}

async function generateContentWithRetry(request: GenerateContentRequest) {
  const maxAttemptsPerModel = 3;
  let lastError: unknown = null;
  let lastModel = PRIMARY_MODEL;

  for (const model of FALLBACK_MODELS) {
    lastModel = model;

    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt += 1) {
      try {
        return await ai.models.generateContent(
          buildRequestWithModel(request, model),
        );
      } catch (error) {
        lastError = error;
        const retryable = isRetryableGeminiError(error);
        const quotaLike = isQuotaLikeError(error);

        console.warn(
          `Bank extraction failed on ${model}, attempt ${attempt}/${maxAttemptsPerModel}: ${errorToText(
            error,
          )}`,
        );

        if (!retryable) {
          throw error;
        }

        if (attempt === maxAttemptsPerModel || (quotaLike && attempt >= 2)) {
          break;
        }

        await sleep(getRetryDelayMs(error, attempt));
      }
    }
  }

  throw new Error(
    [
      "Gemini bank-statement extraction is temporarily unavailable.",
      `Tried models: ${FALLBACK_MODELS.join(", ")}`,
      `Last model: ${lastModel}`,
      `Original error: ${errorToText(lastError)}`,
    ].join("\n"),
  );
}

function stripJsonCodeFence(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function findBalancedJsonObject(text: string) {
  const start = text.indexOf("{");

  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function repairTruncatedJsonObject(text: string) {
  const start = text.indexOf("{");

  if (start < 0) {
    return null;
  }

  let candidate = text.slice(start).trim();
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of candidate) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      stack.push("}");
    } else if (char === "[") {
      stack.push("]");
    } else if ((char === "}" || char === "]") && stack.at(-1) === char) {
      stack.pop();
    }
  }

  if (inString) {
    candidate += '"';
  }

  candidate = candidate.replace(/,\s*$/, "");

  return candidate + stack.reverse().join("");
}

function extractCompleteTransactionObjects(text: string) {
  const transactionsKey = text.search(/"transactions"\s*:/i);

  if (transactionsKey < 0) {
    return [];
  }

  const arrayStart = text.indexOf("[", transactionsKey);

  if (arrayStart < 0) {
    return [];
  }

  const transactions: BankTransaction[] = [];
  let objectStart = -1;
  let objectDepth = 0;
  let inString = false;
  let escaped = false;

  for (let index = arrayStart + 1; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (objectDepth === 0) {
        objectStart = index;
      }
      objectDepth += 1;
    } else if (char === "}" && objectDepth > 0) {
      objectDepth -= 1;

      if (objectDepth === 0 && objectStart >= 0) {
        const candidate = text.slice(objectStart, index + 1);

        try {
          const parsed = JSON.parse(candidate) as BankTransaction;
          transactions.push(parsed);
        } catch {
          // Ignore an individual malformed transaction and continue salvaging.
        }

        objectStart = -1;
      }
    } else if (char === "]" && objectDepth === 0) {
      break;
    }
  }

  return transactions;
}

function parseChunkResponse(text: string): BankChunkPayload {
  const cleaned = stripJsonCodeFence(text);
  const candidates = [
    cleaned,
    findBalancedJsonObject(cleaned),
    repairTruncatedJsonObject(cleaned),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as BankChunkPayload;
    } catch {
      try {
        return JSON.parse(
          candidate.replace(/,\s*([}\]])/g, "$1"),
        ) as BankChunkPayload;
      } catch {
        // Try the next recovery strategy.
      }
    }
  }

  const salvagedTransactions = extractCompleteTransactionObjects(cleaned);

  if (salvagedTransactions.length > 0) {
    return {
      transactions: salvagedTransactions,
    };
  }

  throw new Error("Gemini returned invalid JSON.");
}

function normalizeTransaction(
  transaction: BankTransaction,
): BankTransaction | null {
  const date = normalizeIsoDate(transaction.date);
  const description = cleanText(transaction.description);
  const amount = finiteNumber(transaction.amount);
  const direction =
    transaction.direction === "credit" || transaction.direction === "debit"
      ? transaction.direction
      : null;

  if (
    !date ||
    !description ||
    amount === null ||
    amount === 0 ||
    !direction
  ) {
    return null;
  }

  return {
    date,
    description,
    amount: Math.abs(amount),
    direction,
  };
}

function normalizeChunkPayload(data: BankChunkPayload): BankChunkPayload {
  return {
    currency: cleanText(data.currency)?.toUpperCase() ?? null,
    periodStart: normalizeIsoDate(data.periodStart),
    periodEnd: normalizeIsoDate(data.periodEnd),
    vendorOrCounterparty: cleanText(data.vendorOrCounterparty),
    openingBalance: finiteNumber(data.openingBalance),
    closingBalance: finiteNumber(data.closingBalance),
    balance: finiteNumber(data.balance),
    totalAmount: finiteNumber(data.totalAmount),
    transactions: (data.transactions ?? [])
      .map(normalizeTransaction)
      .filter(
        (transaction): transaction is BankTransaction => transaction !== null,
      ),
  };
}

function looksLikeTransactionText(text: string) {
  const lines = normalizeSourceText(text).split("\n");
  const datePattern =
    /(?:^|\s)(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})(?:\s|$)/;
  const amountPattern = /\(?\d[\d,]*(?:\.\d{1,2})?\)?/;

  return lines.some(
    (line) => datePattern.test(line) && amountPattern.test(line),
  );
}

function parseAmount(value: string) {
  const negative = /^\(.*\)$/.test(value.trim());
  const parsed = Number(value.replace(/[(),]/g, "").trim());

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return negative ? -Math.abs(parsed) : parsed;
}

function extractExplicitDrCrTransactions(text: string) {
  const transactions: BankTransaction[] = [];
  const datePrefix =
    /^(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})\s+(.+)$/i;
  const amountThenDirection =
    /(?:₹|Rs\.?|INR|\$)?\s*(\(?\d[\d,]*(?:\.\d+)?\)?)\s*(CR|DR|CREDIT|DEBIT)\b/i;
  const directionThenAmount =
    /\b(CR|DR|CREDIT|DEBIT)\s*(?:₹|Rs\.?|INR|\$)?\s*(\(?\d[\d,]*(?:\.\d+)?\)?)/i;

  for (const rawLine of normalizeSourceText(text).split("\n")) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    const dateMatch = line.match(datePrefix);

    if (!dateMatch) {
      continue;
    }

    const date = normalizeIsoDate(dateMatch[1]);
    const body = dateMatch[2];
    const firstMatch = body.match(amountThenDirection);
    const secondMatch = firstMatch ? null : body.match(directionThenAmount);

    const amountText = firstMatch?.[1] ?? secondMatch?.[2] ?? null;
    const directionText = firstMatch?.[2] ?? secondMatch?.[1] ?? null;

    if (!date || !amountText || !directionText) {
      continue;
    }

    const parsedAmount = parseAmount(amountText);

    if (parsedAmount === null || parsedAmount === 0) {
      continue;
    }

    const direction = /^(CR|CREDIT)$/i.test(directionText)
      ? "credit"
      : "debit";
    const matchedText = firstMatch?.[0] ?? secondMatch?.[0] ?? "";
    const description = cleanText(body.replace(matchedText, " "));

    if (!description) {
      continue;
    }

    transactions.push({
      date,
      description,
      amount: Math.abs(parsedAmount),
      direction,
    });
  }

  return transactions;
}

async function extractChunkOnce(params: {
  fileName: string;
  headerContext: string;
  chunk: string;
  sourceLabel: string;
}) {
  const response = await generateContentWithRetry({
    model: PRIMARY_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: buildChunkPrompt(params),
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: BANK_TRANSACTION_CHUNK_SCHEMA,
      temperature: 0,
      maxOutputTokens: configuredMaxOutputTokens(),
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned an empty response.");
  }

  return normalizeChunkPayload(parseChunkResponse(response.text));
}

async function processSegment(params: {
  fileName: string;
  headerContext: string;
  chunk: string;
  sourceLabel: string;
  depth: number;
  completed: ChunkResult[];
  failures: string[];
  stats: ExtractionStats;
}) {
  try {
    const data = await extractChunkOnce(params);
    const transactions = data.transactions ?? [];

    if (
      transactions.length === 0 &&
      looksLikeTransactionText(params.chunk) &&
      params.depth < MAX_SPLIT_DEPTH &&
      params.chunk.length >= MIN_RETRY_SEGMENT_CHARS
    ) {
      const halves = splitSegmentInHalf(params.chunk);

      if (halves) {
        params.stats.splitRetries += 1;

        await processSegment({
          ...params,
          chunk: halves[0],
          sourceLabel: `${params.sourceLabel}.1`,
          depth: params.depth + 1,
        });
        await processSegment({
          ...params,
          chunk: halves[1],
          sourceLabel: `${params.sourceLabel}.2`,
          depth: params.depth + 1,
        });
        return;
      }
    }

    params.completed.push({
      data,
      sourceLabel: params.sourceLabel,
    });
    params.stats.completedSegments += 1;
  } catch (error) {
    if (
      !isQuotaLikeError(error) &&
      params.depth < MAX_SPLIT_DEPTH &&
      params.chunk.length >= MIN_RETRY_SEGMENT_CHARS
    ) {
      const halves = splitSegmentInHalf(params.chunk);

      if (halves) {
        params.stats.splitRetries += 1;

        await processSegment({
          ...params,
          chunk: halves[0],
          sourceLabel: `${params.sourceLabel}.1`,
          depth: params.depth + 1,
        });
        await processSegment({
          ...params,
          chunk: halves[1],
          sourceLabel: `${params.sourceLabel}.2`,
          depth: params.depth + 1,
        });
        return;
      }
    }

    const deterministicTransactions = extractExplicitDrCrTransactions(
      params.chunk,
    );

    if (deterministicTransactions.length > 0) {
      params.completed.push({
        data: {
          transactions: deterministicTransactions,
        },
        sourceLabel: params.sourceLabel,
      });
      params.stats.completedSegments += 1;
      params.stats.deterministicFallbackSegments += 1;
      params.failures.push(
        `${params.sourceLabel}: AI response failed (${errorToText(
          error,
        )}); recovered ${deterministicTransactions.length} explicit DR/CR transactions deterministically.`,
      );
      return;
    }

    params.stats.failedSegments += 1;
    params.failures.push(
      `${params.sourceLabel}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function firstText(
  results: ChunkResult[],
  getter: (data: BankChunkPayload) => unknown,
) {
  for (const result of results) {
    const value = cleanText(getter(result.data));

    if (value) {
      return value;
    }
  }

  return null;
}

function firstNumber(
  results: ChunkResult[],
  getter: (data: BankChunkPayload) => unknown,
) {
  for (const result of results) {
    const value = finiteNumber(getter(result.data));

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function lastNumber(
  results: ChunkResult[],
  getter: (data: BankChunkPayload) => unknown,
) {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const value = finiteNumber(getter(results[index].data));

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function transactionDateRange(transactions: BankTransaction[]) {
  const isoDates = transactions
    .map((transaction) => normalizeIsoDate(transaction.date))
    .filter(
      (date): date is string =>
        Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date)),
    )
    .sort();

  return {
    periodStart: isoDates.at(0) ?? null,
    periodEnd: isoDates.at(-1) ?? null,
  };
}

export async function extractBankStatementDataFromText(params: {
  fileName: string;
  text: string;
}): Promise<ExtractedDocumentData> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const chunks = splitTextByLines(params.text);

  if (chunks.length === 0) {
    throw new Error(
      "No readable bank statement text was available for transaction extraction.",
    );
  }

  const headerContext = buildHeaderContext(params.text);
  const completed: ChunkResult[] = [];
  const failures: string[] = [];
  const stats: ExtractionStats = {
    completedSegments: 0,
    failedSegments: 0,
    splitRetries: 0,
    deterministicFallbackSegments: 0,
  };

  for (let index = 0; index < chunks.length; index += 1) {
    await processSegment({
      fileName: params.fileName,
      headerContext,
      chunk: chunks[index],
      sourceLabel: `Chunk ${index + 1}`,
      depth: 0,
      completed,
      failures,
      stats,
    });

    if (failures.some((failure) => failure.toLowerCase().includes("quota"))) {
      const remaining = chunks.length - index - 1;

      if (remaining > 0) {
        stats.failedSegments += remaining;
        failures.push(
          `${remaining} remaining original chunk${
            remaining === 1 ? "" : "s"
          } skipped after Gemini quota exhaustion.`,
        );
      }

      break;
    }
  }

  if (completed.length === 0) {
    throw new Error(
      `Bank statement extraction failed for every segment. ${failures.join(
        " | ",
      )}`,
    );
  }

  const transactions = completed.flatMap((result) =>
    (result.data.transactions ?? [])
      .map(normalizeTransaction)
      .filter(
        (transaction): transaction is BankTransaction =>
          transaction !== null,
      ),
  );

  const terminalSegments =
    stats.completedSegments + stats.failedSegments;
  const allSegmentsCompleted =
    terminalSegments > 0 && stats.failedSegments === 0;
  const dateRange = transactionDateRange(transactions);
  const openingBalance = firstNumber(
    completed,
    (data) => data.openingBalance,
  );
  const closingBalance =
    lastNumber(completed, (data) => data.closingBalance) ??
    lastNumber(completed, (data) => data.balance) ??
    lastNumber(completed, (data) => data.totalAmount);
  const currency =
    firstText(completed, (data) => data.currency)?.toUpperCase() ?? "INR";
  const periodStart =
    firstText(completed, (data) => data.periodStart) ?? dateRange.periodStart;
  const periodEnd =
    [...completed]
      .reverse()
      .map((result) => normalizeIsoDate(result.data.periodEnd))
      .find(Boolean) ?? dateRange.periodEnd;
  const quality =
    allSegmentsCompleted && transactions.length > 0
      ? "high"
      : transactions.length > 0
        ? "medium"
        : "low";
  const confidence =
    transactions.length === 0
      ? 0.35
      : allSegmentsCompleted
        ? stats.deterministicFallbackSegments > 0
          ? 0.88
          : 0.97
        : 0.74;

  return {
    summary: [
      `Bank statement processed in ${stats.completedSegments} of ${terminalSegments} terminal extraction segments.`,
      `${transactions.length.toLocaleString(
        "en-IN",
      )} individual transactions were extracted.`,
      stats.splitRetries > 0
        ? `${stats.splitRetries} oversized or malformed segment${
            stats.splitRetries === 1 ? " was" : "s were"
          } automatically split and retried.`
        : "",
      stats.deterministicFallbackSegments > 0
        ? `${stats.deterministicFallbackSegments} segment${
            stats.deterministicFallbackSegments === 1 ? " used" : "s used"
          } deterministic DR/CR recovery.`
        : "",
      stats.failedSegments > 0
        ? `${stats.failedSegments} terminal segment${
            stats.failedSegments === 1 ? " requires" : "s require"
          } retry.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    documentDate: periodEnd,
    periodStart,
    periodEnd,
    currency,
    reportedUnit: "actual",
    scaleMultiplier: 1,
    unitDetectionEvidence:
      "Bank statement transaction amounts are stored in actual currency units.",
    vendorOrCounterparty:
      firstText(completed, (data) => data.vendorOrCounterparty) ?? "Bank",
    totalAmount: closingBalance,
    totalAmountLabel:
      closingBalance === null ? null : "Ending balance",
    openingBalance,
    closingBalance,
    balance: closingBalance,
    lineItems: [],
    transactions,
    extractionDiagnostics: {
      engine: "adaptive-chunked-gemini-bank-statement-v2",
      confidence,
      quality,
      requiresReview:
        !allSegmentsCompleted ||
        transactions.length === 0 ||
        stats.deterministicFallbackSegments > 0,
      textLayerAvailable: true,
      likelyScanned: false,
      selectedScope: "bank-statement-transactions",
      detectedSections: completed.map((result) => result.sourceLabel),
      lineItemCount: transactions.length,
      currentPeriod: periodEnd,
      candidateChunks: terminalSegments,
      completedChunks: stats.completedSegments,
      failedChunks: stats.failedSegments,
      warnings: failures,
      enginesAttempted: [
        "pdf-text-layer",
        "dedicated-gemini-bank-transaction-schema",
        "adaptive-segment-split-retry",
        ...(stats.deterministicFallbackSegments > 0
          ? ["deterministic-explicit-dr-cr-recovery"]
          : []),
      ],
      conflicts: [],
    },
  };
}
