import { GoogleGenAI } from "@google/genai";
import { ensureExtractedLineItems } from "./extracted-line-items";
import {
  buildFinancialCandidateText,
  normalizeAndDedupeFinancialLineItems,
  type FinancialLineItem,
} from "./financial-text-chunks";

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

const DEFAULT_CHUNK_TARGET_CHARS = 14_000;
const DEFAULT_MAX_DOCUMENT_CHUNKS = 24;
const ABSOLUTE_MAX_DOCUMENT_CHUNKS = 60;

const lineItemSchema = {
  type: "object",
  properties: {
    description: { type: "string" },
    amount: {
      type: "number",
      description: "Actual full currency value after applying scaleMultiplier.",
    },
    category: { type: "string", nullable: true },
    date: { type: "string", nullable: true },
  },
  required: ["description", "amount"],
};

const transactionSchema = {
  type: "object",
  properties: {
    date: { type: "string" },
    description: { type: "string" },
    amount: { type: "number" },
    direction: { type: "string", enum: ["credit", "debit"] },
  },
  required: ["date", "description", "amount", "direction"],
};

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    documentDate: { type: "string", nullable: true },
    periodStart: { type: "string", nullable: true },
    periodEnd: { type: "string", nullable: true },
    dueDate: { type: "string", nullable: true },
    documentNumber: { type: "string", nullable: true },
    referenceNumber: { type: "string", nullable: true },
    currency: { type: "string", nullable: true },
    reportedUnit: {
      type: "string",
      nullable: true,
      enum: [
        "actual",
        "thousands",
        "lakhs",
        "crores",
        "millions",
        "billions",
        "unknown",
      ],
    },
    scaleMultiplier: { type: "number", nullable: true },
    unitDetectionEvidence: { type: "string", nullable: true },
    vendorOrCounterparty: { type: "string", nullable: true },
    totalAmount: { type: "number", nullable: true },
    totalAmountLabel: { type: "string", nullable: true },
    subtotal: { type: "number", nullable: true },
    taxAmount: { type: "number", nullable: true },
    grossAmount: { type: "number", nullable: true },
    netAmount: { type: "number", nullable: true },
    revenue: { type: "number", nullable: true },
    totalRevenue: { type: "number", nullable: true },
    sales: { type: "number", nullable: true },
    expenses: { type: "number", nullable: true },
    totalExpenses: { type: "number", nullable: true },
    profit: { type: "number", nullable: true },
    loss: { type: "number", nullable: true },
    netIncome: { type: "number", nullable: true },
    assets: { type: "number", nullable: true },
    liabilities: { type: "number", nullable: true },
    equity: { type: "number", nullable: true },
    cash: { type: "number", nullable: true },
    closingBalance: { type: "number", nullable: true },
    openingBalance: { type: "number", nullable: true },
    balance: { type: "number", nullable: true },
    principalAmount: { type: "number", nullable: true },
    interestAmount: { type: "number", nullable: true },
    outstandingBalance: { type: "number", nullable: true },
    grossPay: { type: "number", nullable: true },
    netPay: { type: "number", nullable: true },
    employeeCount: { type: "number", nullable: true },
    premiumAmount: { type: "number", nullable: true },
    lineItems: {
      type: "array",
      description:
        "Every readable financial or commercial row with a description and amount. Return all rows, not only important rows.",
      items: lineItemSchema,
    },
    transactions: {
      type: "array",
      description: "Every individual posted bank transaction when applicable.",
      items: transactionSchema,
    },
  },
  required: ["summary"],
};

const SUMMARY_EXTRACTION_SCHEMA = {
  ...EXTRACTION_SCHEMA,
  properties: Object.fromEntries(
    Object.entries(EXTRACTION_SCHEMA.properties).filter(
      ([key]) => key !== "lineItems" && key !== "transactions",
    ),
  ),
};

const LINE_ITEM_ONLY_SCHEMA = {
  type: "object",
  properties: {
    lineItems: {
      type: "array",
      description: "Every readable row in this non-overlapping document chunk.",
      items: lineItemSchema,
    },
  },
  required: ["lineItems"],
};

export type ExtractedDocumentData = {
  summary: string;
  metricValidation?: {
    status: "verified" | "partial" | "needs_review";
    invalidatedFields: Array<
      | "revenue"
      | "expenses"
      | "netIncome"
      | "cash"
      | "assets"
      | "liabilities"
      | "equity"
    >;
    availableFields: Array<
      | "revenue"
      | "expenses"
      | "netIncome"
      | "cash"
      | "assets"
      | "liabilities"
      | "equity"
    >;
    warnings: string[];
  } | null;
  documentDate?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  dueDate?: string | null;
  documentNumber?: string | null;
  referenceNumber?: string | null;
  currency?: string | null;
  reportedUnit?:
    | "actual"
    | "thousands"
    | "lakhs"
    | "crores"
    | "millions"
    | "billions"
    | "unknown"
    | null;
  scaleMultiplier?: number | null;
  unitDetectionEvidence?: string | null;
  vendorOrCounterparty?: string | null;
  totalAmount?: number | null;
  totalAmountLabel?: string | null;
  subtotal?: number | null;
  taxAmount?: number | null;
  grossAmount?: number | null;
  netAmount?: number | null;
  revenue?: number | null;
  totalRevenue?: number | null;
  sales?: number | null;
  expenses?: number | null;
  totalExpenses?: number | null;
  profit?: number | null;
  loss?: number | null;
  netIncome?: number | null;
  assets?: number | null;
  liabilities?: number | null;
  equity?: number | null;
  cash?: number | null;
  closingBalance?: number | null;
  openingBalance?: number | null;
  balance?: number | null;
  principalAmount?: number | null;
  interestAmount?: number | null;
  outstandingBalance?: number | null;
  grossPay?: number | null;
  netPay?: number | null;
  employeeCount?: number | null;
  premiumAmount?: number | null;
  lineItems?: {
    description: string;
    amount: number;
    category?: string | null;
    date?: string | null;
    displayedAmount?: number | null;
    displayedUnit?: string | null;
    currency?: string | null;
    statementType?: string | null;
    scope?: string | null;
    pageNumber?: number | null;
    sourcePage?: number | null;
    sourceColumn?: string | null;
    sourceText?: string | null;
    sourceStatement?: string | null;
    extractionEngine?: string | null;
    confidence?: number | null;
    isAggregate?: boolean | null;
    section?: string | null;
  }[];
  extractionDiagnostics?: {
    engine: string;
    confidence: number;
    quality: "high" | "medium" | "low";
    requiresReview: boolean;
    textLayerAvailable?: boolean;
    likelyScanned?: boolean;
    selectedScope?: string | null;
    statementPages?: number[];
    detectedSections?: string[];
    lineItemCount?: number;
    currentPeriod?: string | null;
    candidateChunks?: number;
    completedChunks?: number;
    failedChunks?: number;
    warnings?: string[];
    checks?: {
      key: string;
      passed: boolean;
      message: string;
      difference?: number | null;
    }[];
    enginesAttempted?: string[];
    conflicts?: string[];
  } | null;
  transactions?: {
    date: string;
    description: string;
    amount: number;
    direction: "credit" | "debit";
  }[];
};

const CATEGORY_GUIDANCE: Record<string, string> = {
  BANK_STATEMENT: `
This is a bank statement. Extract every posted transaction with date, full description, amount, and credit/debit direction. Set totalAmount to the ending balance and extract opening and closing balances.
`,
  FINANCIAL_STATEMENT: `
This is a financial statement, annual report, profit and loss statement, balance sheet, or cash-flow statement. Extract revenue, expenses, net income, assets, liabilities, equity, cash, and every readable table row from every statement and note. Preserve current and comparative periods as separate line items.
`,
  SALES_INVOICE: `
This is a sales invoice. Extract invoice number, invoice date, due date, customer, subtotal, tax, grand total, and every product/service line. Set revenue to the invoice subtotal or total as supported by the source.
`,
  PURCHASE_INVOICE: `
This is a supplier bill or purchase invoice. Extract bill number, dates, vendor, subtotal, tax, amount due, and every product/service line. Set expenses to the supported invoice total or subtotal.
`,
  RECEIPT: `
This is a receipt. Extract merchant, receipt number, date, subtotal, taxes, total paid, and every purchased item or charge.
`,
  CREDIT_NOTE: `
This is a credit note. Extract document number, linked invoice/reference, date, counterparty, tax adjustment, total credit, and every credited or returned line.
`,
  DEBIT_NOTE: `
This is a debit note. Extract document number, linked invoice/reference, date, counterparty, tax adjustment, total debit, and every additional charge line.
`,
  PAYROLL: `
This is payroll. Extract payroll period, employee count, gross pay, deductions, employer contributions, taxes, net pay, and every employee-level or payroll-component row.
`,
  UTILITY_BILL: `
This is a utility bill. Extract provider, account/reference number, billing period, due date, usage charges, taxes, arrears, adjustments, and amount due. Return every bill component.
`,
  TAX_DOCUMENT: `
This is an income-tax or tax-computation document. Extract assessment period, reference number, taxable income, deductions, tax, surcharge, cess, credits, payments, refund or amount due, and every readable tax computation row.
`,
  GST_RETURN: `
This is a GST return. Extract return period, GSTIN, outward supplies, inward supplies, taxable value, IGST, CGST, SGST/UTGST, cess, input tax credit, tax paid, balance, and every table row.
`,
  LOAN_STATEMENT: `
This is a loan statement or repayment schedule. Extract account number, period, principal, interest, fees, EMI, repayments, opening balance, closing/outstanding balance, and every instalment or movement row.
`,
  RENT_LEASE: `
This is a rent or lease document. Extract parties, property/reference, lease period, rent, deposit, escalation, maintenance, taxes, due dates, and every monetary clause or schedule row.
`,
  INSURANCE_DOCUMENT: `
This is an insurance policy, premium notice, or claim document. Extract insurer, policy/reference number, coverage period, sum insured, premium, taxes, deductible, claim amount, and every coverage or charge row.
`,
  INVENTORY_REPORT: `
This is an inventory report. Extract period/date, SKU or item descriptions, quantities where embedded in descriptions, unit values, stock value, opening/closing stock, movements, write-downs, and every item row with an amount.
`,
  PURCHASE_ORDER: `
This is a purchase order. Extract order number, supplier, order date, expected date, subtotal, taxes, total commitment, and every ordered item or service line.
`,
  SALES_ORDER: `
This is a sales order. Extract order number, customer, order date, expected date, subtotal, taxes, total order value, and every ordered item or service line.
`,
  OTHER: `
Extract every identifiable financial field and every readable row containing a meaningful description and amount. Do not stop at the first table.
`,
};

type ExtractionContent =
  | { kind: "inline"; mimeType: string; base64Data: string }
  | { kind: "text"; text: string };

type GenerateContentRequest = Parameters<typeof ai.models.generateContent>[0];

type ChunkLineItemResponse = {
  lineItems?: FinancialLineItem[];
};

export type ChunkedLineItemExtractionResult = {
  lineItems: FinancialLineItem[];
  candidateChunks: number;
  completedChunks: number;
  failedChunks: number;
  warnings: string[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorToText(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
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
  return ["429", "resource_exhausted", "quota", "rate limit"].some((value) =>
    text.includes(value),
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
      return Math.ceil(seconds * 1000) + 1_500;
    }
  }

  return Math.min(45_000, 3_000 * attempt);
}

function buildRequestWithModel(
  request: GenerateContentRequest,
  model: string,
): GenerateContentRequest {
  return { ...request, model };
}

async function generateContentWithRetry(request: GenerateContentRequest) {
  const maxAttemptsPerModel = 3;
  let lastError: unknown = null;
  let lastModel = PRIMARY_MODEL;

  for (const model of FALLBACK_MODELS) {
    lastModel = model;

    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt += 1) {
      try {
        return await ai.models.generateContent(buildRequestWithModel(request, model));
      } catch (error) {
        lastError = error;
        const retryable = isRetryableGeminiError(error);
        const quotaLike = isQuotaLikeError(error);

        console.warn(
          `Gemini extraction failed on ${model}, attempt ${attempt}/${maxAttemptsPerModel}: ${errorToText(error)}`,
        );

        if (!retryable) throw error;
        if (attempt === maxAttemptsPerModel || (quotaLike && attempt >= 2)) break;
        await sleep(getRetryDelayMs(error, attempt));
      }
    }
  }

  throw new Error(
    [
      "Gemini extraction is temporarily unavailable due to model demand or quota pressure.",
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
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
}

function repairTruncatedJsonObject(text: string) {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let candidate = text.slice(start).trim();
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of candidate) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") stack.push("}");
    else if (char === "[") stack.push("]");
    else if ((char === "}" || char === "]") && stack.at(-1) === char) stack.pop();
  }

  if (inString) candidate += '"';
  candidate = candidate.replace(/,\s*$/, "");
  return candidate + stack.reverse().join("");
}

function safeJsonParse<T>(text: string): T {
  const cleaned = stripJsonCodeFence(text);
  const candidates = [
    cleaned,
    findBalancedJsonObject(cleaned),
    repairTruncatedJsonObject(cleaned),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      try {
        return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1")) as T;
      } catch {
        // Try next repair strategy.
      }
    }
  }

  throw new Error("Gemini returned invalid JSON.");
}

function configuredMaxDocumentChunks() {
  const configured = Number(
    process.env.GEMINI_MAX_DOCUMENT_CHUNKS ??
      process.env.GEMINI_MAX_PDF_CHUNKS ??
      DEFAULT_MAX_DOCUMENT_CHUNKS,
  );

  if (!Number.isFinite(configured)) return DEFAULT_MAX_DOCUMENT_CHUNKS;
  return Math.min(
    ABSOLUTE_MAX_DOCUMENT_CHUNKS,
    Math.max(1, Math.trunc(configured)),
  );
}

function normalizeSourceText(text: string) {
  return text.replace(/\u0000/g, " ").replace(/\r\n/g, "\n").trim();
}

function buildDocumentChunkSource(category: string, text: string) {
  if (category === "FINANCIAL_STATEMENT") {
    return buildFinancialCandidateText(text) || text;
  }
  return text;
}

function splitCompleteTextIntoChunks(text: string) {
  const normalized = normalizeSourceText(text);
  if (!normalized) return [];

  const maxChunks = configuredMaxDocumentChunks();
  const desiredChunks = Math.max(
    1,
    Math.ceil(normalized.length / DEFAULT_CHUNK_TARGET_CHARS),
  );
  const plannedChunks = Math.min(maxChunks, desiredChunks);
  const targetChars = Math.max(
    DEFAULT_CHUNK_TARGET_CHARS,
    Math.ceil(normalized.length / plannedChunks) + 1_000,
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
      current = current.slice(-3);
      currentLength = current.reduce((sum, item) => sum + item.length + 1, 0);
    }

    current.push(line);
    currentLength += line.length + 1;
  }

  if (current.length > 0) chunks.push(current.join("\n"));
  return chunks.filter((chunk) => chunk.trim().length > 0);
}

function buildHeaderContext(text: string) {
  const lines = normalizeSourceText(text).split("\n");
  const selected = new Set<number>();

  for (let index = 0; index < Math.min(lines.length, 40); index += 1) {
    if (lines[index].trim()) selected.add(index);
  }

  const contextPattern =
    /(amounts?|figures?).*(thousand|lakh|crore|million|billion)|gstin|invoice|statement period|for the year|as at|account number|policy number/i;

  for (let index = 0; index < lines.length; index += 1) {
    if (contextPattern.test(lines[index])) selected.add(index);
  }

  return [...selected]
    .sort((a, b) => a - b)
    .map((index) => lines[index])
    .filter(Boolean)
    .join("\n")
    .slice(0, 8_000);
}

function buildPrompt(
  category: string,
  fileName: string,
  options: { summaryOnly?: boolean } = {},
) {
  const guidance = CATEGORY_GUIDANCE[category] ?? CATEGORY_GUIDANCE.OTHER;
  const mode = options.summaryOnly
    ? `
SUMMARY MODE:
- Return metadata and high-level totals only.
- Do not return lineItems or transactions.
- Keep the response compact and source-grounded.
`
    : `
FULL MODE:
- Extract every readable row, not only headline figures.
- Do not cap rows and do not stop at the first table.
- Preserve subtotals, totals, adjustments, comparative periods, and detail rows.
`;

  return `
You are the full-document extraction engine for Actic Finance.

Filename: "${fileName}"
Category: ${category}

CATEGORY RULES:
${guidance}

UNIT RULES:
- Detect actual, thousands, lakhs, crores, millions, or billions from the source.
- Return reportedUnit, scaleMultiplier, and short unitDetectionEvidence.
- Convert every returned monetary number to actual full currency units.
- Never invent a number. Use null or omit a field when unsupported.
- Preserve losses as negative netIncome and as a positive loss field.
- Dates should use YYYY-MM-DD when determinable.
- Numbers must not contain currency symbols or commas.

${mode}
`.trim();
}

function buildLineItemChunkPrompt(params: {
  fileName: string;
  category: string;
  chunkIndex: number;
  chunkCount: number;
  headerContext: string;
  reportedUnit?: string | null;
  scaleMultiplier?: number | null;
  documentDate?: string | null;
}) {
  const multiplier =
    typeof params.scaleMultiplier === "number" &&
    Number.isFinite(params.scaleMultiplier) &&
    params.scaleMultiplier > 0
      ? params.scaleMultiplier
      : 1;

  return `
You are extracting detail rows from non-overlapping chunk ${params.chunkIndex + 1} of ${params.chunkCount} of "${params.fileName}".
Document category: ${params.category}
Reported unit: ${params.reportedUnit ?? "unknown"}
Scale multiplier: ${multiplier}
Fallback date: ${params.documentDate ?? "unknown"}

HEADER CONTEXT (context only; do not duplicate rows from it):
${params.headerContext || "Unavailable"}

Return JSON containing lineItems only.

MANDATORY RULES:
- Extract EVERY readable commercial or financial row in the chunk that has a meaningful description and monetary amount.
- Include product/service lines, employees, taxes, deductions, instalments, stock rows, charges, adjustments, subtotals, and totals where present.
- For financial statements include every statement/note row and return comparative columns as separate items with the period in the description.
- Apply scale multiplier ${multiplier} before returning amount.
- Preserve negative values shown with minus signs or parentheses.
- Ignore page numbers, percentages without money, bare years, note-reference numbers, and narrative prose.
- Do not invent missing rows.
`.trim();
}

async function extractDocumentDataOnce(params: {
  fileName: string;
  category: string;
  content: ExtractionContent;
  summaryOnly?: boolean;
}): Promise<ExtractedDocumentData> {
  const { fileName, category, content, summaryOnly = false } = params;

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const contentPart =
    content.kind === "inline"
      ? {
          inlineData: {
            mimeType: content.mimeType,
            data: content.base64Data,
          },
        }
      : { text: `Document contents:\n\n${content.text}` };

  const response = await generateContentWithRetry({
    model: PRIMARY_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(category, fileName, { summaryOnly }) },
          contentPart,
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: summaryOnly
        ? SUMMARY_EXTRACTION_SCHEMA
        : EXTRACTION_SCHEMA,
      temperature: 0.05,
      maxOutputTokens: summaryOnly ? 4_096 : 8_192,
    },
  });

  if (!response.text) throw new Error("Gemini returned an empty response.");
  return ensureExtractedLineItems(
    safeJsonParse<ExtractedDocumentData>(response.text),
  );
}

export async function extractDocumentLineItemsFromTextChunks(params: {
  fileName: string;
  category: string;
  text: string;
  reportedUnit?: string | null;
  scaleMultiplier?: number | null;
  documentDate?: string | null;
}): Promise<ChunkedLineItemExtractionResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const source = buildDocumentChunkSource(params.category, params.text);
  const chunks = splitCompleteTextIntoChunks(source);
  const headerContext = buildHeaderContext(params.text);
  const collected: FinancialLineItem[] = [];
  const warnings: string[] = [];
  let completedChunks = 0;
  let failedChunks = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    try {
      const response = await generateContentWithRetry({
        model: PRIMARY_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildLineItemChunkPrompt({
                  ...params,
                  headerContext,
                  chunkIndex: index,
                  chunkCount: chunks.length,
                }),
              },
              { text: `CHUNK BODY:\n\n${chunks[index]}` },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: LINE_ITEM_ONLY_SCHEMA,
          temperature: 0,
          maxOutputTokens: 8_192,
        },
      });

      if (!response.text) {
        failedChunks += 1;
        warnings.push(`Chunk ${index + 1} returned an empty response.`);
        continue;
      }

      const parsed = safeJsonParse<ChunkLineItemResponse>(response.text);
      collected.push(
        ...normalizeAndDedupeFinancialLineItems(
          Array.isArray(parsed.lineItems) ? parsed.lineItems : [],
        ),
      );
      completedChunks += 1;
    } catch (error) {
      failedChunks += 1;
      warnings.push(`Chunk ${index + 1}: ${errorToText(error)}`);

      if (isQuotaLikeError(error)) {
        const remaining = chunks.length - index - 1;
        failedChunks += remaining;
        if (remaining > 0) {
          warnings.push(
            `${remaining} remaining chunk${remaining === 1 ? "" : "s"} skipped after quota exhaustion.`,
          );
        }
        break;
      }
    }
  }

  return {
    lineItems: normalizeAndDedupeFinancialLineItems(collected),
    candidateChunks: chunks.length,
    completedChunks,
    failedChunks,
    warnings,
  };
}

/**
 * Full extraction entrypoint.
 *
 * Text documents always use a compact whole-document summary pass followed by
 * complete chunk-by-chunk detail extraction. Inline images/PDFs use one vision
 * pass because a page-level text layer is not available here. Bank statement
 * text is already split by bank-statement-chunk-extraction.ts and therefore
 * intentionally stays as one request per supplied transaction chunk.
 */
export async function extractDocumentData(params: {
  fileName: string;
  category: string;
  content: ExtractionContent;
  summaryOnly?: boolean;
}): Promise<ExtractedDocumentData> {
  const { fileName, category, content } = params;

  if (content.kind === "inline" || category === "BANK_STATEMENT") {
    return extractDocumentDataOnce(params);
  }

  const normalizedText = normalizeSourceText(content.text);
  if (!normalizedText) {
    throw new Error("No readable document text was available for extraction.");
  }

  const summary = await extractDocumentDataOnce({
    fileName,
    category,
    content: { kind: "text", text: normalizedText },
    summaryOnly: true,
  });

  const chunks = await extractDocumentLineItemsFromTextChunks({
    fileName,
    category,
    text: normalizedText,
    reportedUnit: summary.reportedUnit,
    scaleMultiplier: summary.scaleMultiplier,
    documentDate:
      summary.documentDate ?? summary.periodEnd ?? summary.periodStart ?? null,
  });

  const complete =
    chunks.candidateChunks > 0 &&
    chunks.completedChunks === chunks.candidateChunks &&
    chunks.failedChunks === 0;
  const lineItems = normalizeAndDedupeFinancialLineItems([
    ...(summary.lineItems ?? []),
    ...chunks.lineItems,
  ]);
  const confidence = complete
    ? lineItems.length > 0
      ? 0.94
      : 0.82
    : lineItems.length > 0
      ? 0.72
      : 0.45;

  return ensureExtractedLineItems({
    ...summary,
    lineItems,
    transactions: Array.isArray(summary.transactions) ? summary.transactions : [],
    extractionDiagnostics: {
      engine: "gemini-summary-plus-complete-chunks-v2",
      confidence,
      quality: confidence >= 0.9 ? "high" : confidence >= 0.7 ? "medium" : "low",
      requiresReview: !complete,
      textLayerAvailable: true,
      likelyScanned: false,
      selectedScope: "complete-document-detail-rows",
      detectedSections: Array.from(
        { length: chunks.completedChunks },
        (_, index) => `chunk-${index + 1}`,
      ),
      lineItemCount: lineItems.length,
      currentPeriod:
        summary.periodEnd ?? summary.documentDate ?? summary.periodStart ?? null,
      candidateChunks: chunks.candidateChunks,
      completedChunks: chunks.completedChunks,
      failedChunks: chunks.failedChunks,
      warnings: chunks.warnings,
      enginesAttempted: [
        "gemini-whole-document-summary",
        "gemini-complete-chunk-detail-extraction",
      ],
      conflicts: [],
    },
  });
}
