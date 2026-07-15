import {
  extractDocumentData,
  type ExtractedDocumentData,
} from "./gemini";

type BankTransaction = NonNullable<
  ExtractedDocumentData["transactions"]
>[number];

type ChunkResult = {
  data: ExtractedDocumentData;
  chunkIndex: number;
};

const DEFAULT_TARGET_CHARS = 24_000;
const DEFAULT_MAX_CHUNKS = 12;
const ABSOLUTE_MAX_CHUNKS = 20;

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

  const parsed = new Date(text);

  return Number.isNaN(parsed.getTime())
    ? text
    : parsed.toISOString().slice(0, 10);
}

function configuredMaxChunks() {
  const configured = Number(
    process.env.GEMINI_MAX_BANK_STATEMENT_CHUNKS ??
      DEFAULT_MAX_CHUNKS,
  );

  if (!Number.isFinite(configured)) {
    return DEFAULT_MAX_CHUNKS;
  }

  return Math.min(
    ABSOLUTE_MAX_CHUNKS,
    Math.max(1, Math.trunc(configured)),
  );
}

function buildHeaderContext(text: string) {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24)
    .join("\n")
    .slice(0, 5_000);
}

function splitTextByLines(text: string) {
  const normalized = text
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .trim();

  if (!normalized) {
    return [];
  }

  const maxChunks = configuredMaxChunks();
  const desiredChunks = Math.max(
    1,
    Math.ceil(normalized.length / DEFAULT_TARGET_CHARS),
  );
  const plannedChunks = Math.min(maxChunks, desiredChunks);
  const targetChars = Math.max(
    DEFAULT_TARGET_CHARS,
    Math.ceil(normalized.length / plannedChunks) + 2_000,
  );

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const line of normalized.split("\n")) {
    const nextLength = currentLength + line.length + 1;

    if (
      current.length > 0 &&
      nextLength > targetChars &&
      chunks.length < plannedChunks - 1
    ) {
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

  return chunks;
}

function buildChunkText(params: {
  headerContext: string;
  chunk: string;
  chunkIndex: number;
  chunkCount: number;
}) {
  return `
BANK STATEMENT CHUNK ${params.chunkIndex + 1} OF ${params.chunkCount}

This request is one non-overlapping section of a larger bank statement.

Mandatory extraction rules:
- Extract EVERY individual posted transaction visible in CHUNK BODY.
- Return transactions from CHUNK BODY only.
- Do not stop after an arbitrary number of transactions.
- Preserve real duplicate transactions; two equal payments may both be valid.
- Do not convert opening balance, closing balance, carried-forward balance,
  column headings, totals, or page footers into transactions unless the
  statement clearly presents them as posted transaction rows.
- Use credit for money entering the account and debit for money leaving it.
- Keep the complete transaction description available in the row.
- Amount must be positive; direction carries the sign.
- Never invent missing transactions.

STATEMENT HEADER CONTEXT
The following header is supplied only to explain column order and account
format. Do not extract transactions from this header context:
${params.headerContext || "Header unavailable"}

CHUNK BODY
${params.chunk}
`.trim();
}

function normalizeTransaction(
  transaction: BankTransaction,
): BankTransaction | null {
  const date = normalizeIsoDate(transaction.date);
  const description = cleanText(transaction.description);
  const amount = finiteNumber(transaction.amount);
  const direction =
    transaction.direction === "credit" ||
    transaction.direction === "debit"
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

function firstText(
  results: ChunkResult[],
  getter: (data: ExtractedDocumentData) => unknown,
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
  getter: (data: ExtractedDocumentData) => unknown,
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
  getter: (data: ExtractedDocumentData) => unknown,
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
  const chunks = splitTextByLines(params.text);

  if (chunks.length === 0) {
    throw new Error(
      "No readable bank statement text was available for transaction extraction.",
    );
  }

  const headerContext = buildHeaderContext(params.text);
  const completed: ChunkResult[] = [];
  const failures: string[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    try {
      const data = await extractDocumentData({
        fileName: params.fileName,
        category: "BANK_STATEMENT",
        content: {
          kind: "text",
          text: buildChunkText({
            headerContext,
            chunk: chunks[index],
            chunkIndex: index,
            chunkCount: chunks.length,
          }),
        },
      });

      completed.push({
        data,
        chunkIndex: index,
      });
    } catch (error) {
      failures.push(
        `Chunk ${index + 1}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (completed.length === 0) {
    throw new Error(
      `Bank statement extraction failed for all ${chunks.length} chunks. ${failures.join(
        " | ",
      )}`,
    );
  }

  completed.sort((a, b) => a.chunkIndex - b.chunkIndex);

  const transactions = completed.flatMap((result) =>
    (result.data.transactions ?? [])
      .map(normalizeTransaction)
      .filter(
        (transaction): transaction is BankTransaction =>
          transaction !== null,
      ),
  );

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
    firstText(completed, (data) => data.currency)?.toUpperCase() ??
    "INR";
  const periodStart =
    firstText(completed, (data) => data.periodStart) ??
    dateRange.periodStart;
  const periodEnd =
    [...completed]
      .reverse()
      .map((result) => cleanText(result.data.periodEnd))
      .find(Boolean) ??
    dateRange.periodEnd;

  const allChunksCompleted = completed.length === chunks.length;
  const quality =
    allChunksCompleted && transactions.length > 0
      ? "high"
      : transactions.length > 0
        ? "medium"
        : "low";

  return {
    summary: [
      `Bank statement processed in ${completed.length} of ${chunks.length} chunks.`,
      `${transactions.length.toLocaleString(
        "en-IN",
      )} individual transactions were extracted.`,
      failures.length > 0
        ? `${failures.length} chunk${
            failures.length === 1 ? "" : "s"
          } require retry.`
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
      firstText(
        completed,
        (data) => data.vendorOrCounterparty,
      ) ?? "Bank",
    totalAmount: closingBalance,
    totalAmountLabel:
      closingBalance === null ? null : "Ending balance",
    openingBalance,
    closingBalance,
    balance: closingBalance,
    lineItems: [],
    transactions,
    extractionDiagnostics: {
      engine: "chunked-gemini-bank-statement-v1",
      confidence:
        transactions.length > 0
          ? allChunksCompleted
            ? 0.96
            : 0.82
          : 0.35,
      quality,
      requiresReview: !allChunksCompleted || transactions.length === 0,
      textLayerAvailable: true,
      likelyScanned: false,
      selectedScope: "bank-statement-transactions",
      detectedSections: completed.map(
        (result) =>
          `chunk-${result.chunkIndex + 1}`,
      ),
      lineItemCount: transactions.length,
      currentPeriod: periodEnd,
      warnings: failures,
      enginesAttempted: [
        "pdf-text-layer",
        "chunked-gemini-transaction-extraction",
      ],
      conflicts: [],
    },
  };
}
