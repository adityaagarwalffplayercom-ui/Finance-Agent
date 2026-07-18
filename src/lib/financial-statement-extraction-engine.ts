import {
  extractDocumentData,
  extractDocumentLineItemsFromTextChunks,
  type ChunkedLineItemExtractionResult,
  type ExtractedDocumentData,
} from "./gemini";
import {
  extractFinancialStatementFromPdf,
  type DeterministicFinancialStatementResult,
} from "./financial-statement-table-parser";
import { sanitizeFinancialStatementExtraction } from "./financial-statement-sanitizer";
import type { RawFinancialLineItem } from "./raw-financial-line-items";

const METRIC_KEYS = [
  "revenue",
  "expenses",
  "netIncome",
  "cash",
  "assets",
  "liabilities",
  "equity",
] as const;

type MetricKey = (typeof METRIC_KEYS)[number];

export type ProductionFinancialStatementResult = {
  data: ExtractedDocumentData;
  rawLineItems: RawFinancialLineItem[];
  sourceText: string;
  metricEvidence: Record<string, string>;
  warning: string | null;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown extraction error";
  }
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metricValue(data: ExtractedDocumentData, key: MetricKey) {
  if (key === "revenue") {
    return finiteNumber(data.revenue) ?? finiteNumber(data.totalRevenue) ?? finiteNumber(data.sales);
  }
  if (key === "expenses") {
    return finiteNumber(data.expenses) ?? finiteNumber(data.totalExpenses);
  }
  if (key === "netIncome") {
    return (
      finiteNumber(data.netIncome) ??
      finiteNumber(data.profit) ??
      (finiteNumber(data.loss) !== null ? -Math.abs(finiteNumber(data.loss) as number) : null)
    );
  }
  if (key === "cash") {
    return finiteNumber(data.cash) ?? finiteNumber(data.closingBalance) ?? finiteNumber(data.balance);
  }
  return finiteNumber(data[key]);
}

function relativeDifference(left: number, right: number) {
  return Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), 1);
}

function normalizeAiFinancialStatement(data: ExtractedDocumentData) {
  const sanitized = sanitizeFinancialStatementExtraction(data);
  const netIncome = metricValue(sanitized, "netIncome");

  return {
    ...sanitized,
    revenue: metricValue(sanitized, "revenue"),
    totalRevenue: metricValue(sanitized, "revenue"),
    expenses: metricValue(sanitized, "expenses"),
    totalExpenses: metricValue(sanitized, "expenses"),
    netIncome,
    profit: netIncome !== null && netIncome >= 0 ? netIncome : null,
    loss: netIncome !== null && netIncome < 0 ? Math.abs(netIncome) : null,
    cash: metricValue(sanitized, "cash"),
    assets: metricValue(sanitized, "assets"),
    liabilities: metricValue(sanitized, "liabilities"),
    equity: metricValue(sanitized, "equity"),
    lineItems: Array.isArray(sanitized.lineItems)
      ? sanitized.lineItems.map((item) => ({
          ...item,
          extractionEngine: item.extractionEngine ?? "gemini_vision",
          confidence: typeof item.confidence === "number" ? item.confidence : 0.68,
        }))
      : [],
  } satisfies ExtractedDocumentData;
}

function mergeLineItems(
  ...groups: Array<ExtractedDocumentData["lineItems"] | undefined>
) {
  const items = groups.flatMap((group) => (Array.isArray(group) ? group : []));
  const seen = new Set<string>();

  return items.filter((item) => {
    if (!item || typeof item.amount !== "number" || !Number.isFinite(item.amount)) {
      return false;
    }

    const key = [
      item.description.toLowerCase().replace(/[^a-z0-9]/g, ""),
      Math.round(item.amount * 100) / 100,
      item.date ?? "",
      item.statementType ?? "",
      item.sourcePage ?? item.pageNumber ?? "",
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeHeadlineMetrics(params: {
  deterministic: ExtractedDocumentData;
  ai: ExtractedDocumentData;
}) {
  const conflicts: string[] = [];
  const merged: ExtractedDocumentData = {
    ...params.ai,
    ...params.deterministic,
  };

  for (const key of METRIC_KEYS) {
    const deterministicValue = metricValue(params.deterministic, key);
    const aiValue = metricValue(params.ai, key);

    if (
      deterministicValue !== null &&
      aiValue !== null &&
      relativeDifference(deterministicValue, aiValue) > 0.05
    ) {
      conflicts.push(`${key}: layout ${deterministicValue} vs AI ${aiValue}`);
    }

    const selected = deterministicValue ?? aiValue;

    if (key === "revenue") {
      merged.revenue = selected;
      merged.totalRevenue = selected;
    } else if (key === "expenses") {
      merged.expenses = selected;
      merged.totalExpenses = selected;
    } else if (key === "netIncome") {
      merged.netIncome = selected;
      merged.profit = selected !== null && selected >= 0 ? selected : null;
      merged.loss = selected !== null && selected < 0 ? Math.abs(selected) : null;
    } else {
      merged[key] = selected;
    }
  }

  return { merged, conflicts };
}

function toRawLineItems(data: ExtractedDocumentData): RawFinancialLineItem[] {
  if (!Array.isArray(data.lineItems)) return [];

  return data.lineItems
    .filter(
      (item) =>
        item &&
        typeof item.amount === "number" &&
        Number.isFinite(item.amount) &&
        typeof item.description === "string" &&
        item.description.trim(),
    )
    .map((item) => ({ ...item }));
}

function coreMetricCount(data: ExtractedDocumentData) {
  return METRIC_KEYS.filter((key) => metricValue(data, key) !== null).length;
}

function shouldRequestAiSummary(result: DeterministicFinancialStatementResult | null) {
  if (!result) return true;
  return (
    !result.usable ||
    result.diagnostics.likelyScanned ||
    result.diagnostics.confidence < 0.9 ||
    coreMetricCount(result.data) < 5
  );
}

function emptyChunkResult(): ChunkedLineItemExtractionResult {
  return {
    lineItems: [],
    candidateChunks: 0,
    completedChunks: 0,
    failedChunks: 0,
    warnings: [],
  };
}

function buildDiagnostics(params: {
  deterministic: DeterministicFinancialStatementResult | null;
  aiData: ExtractedDocumentData | null;
  chunks: ChunkedLineItemExtractionResult;
  conflicts: string[];
  lineItemCount: number;
  warnings: string[];
}) {
  const deterministicConfidence = params.deterministic?.diagnostics.confidence ?? 0;
  const chunkCompleteness =
    params.chunks.candidateChunks === 0
      ? 0
      : params.chunks.completedChunks / params.chunks.candidateChunks;
  const baseConfidence = Math.max(
    params.aiData ? 0.68 : 0,
    deterministicConfidence,
    chunkCompleteness > 0 ? 0.62 + chunkCompleteness * 0.3 : 0,
  );
  const conflictPenalty = Math.min(0.24, params.conflicts.length * 0.04);
  const confidence = Math.max(0.4, Math.min(0.98, baseConfidence - conflictPenalty));
  const chunksComplete =
    params.chunks.candidateChunks === 0 || params.chunks.failedChunks === 0;
  const requiresReview =
    Boolean(params.deterministic?.diagnostics.requiresReview) ||
    params.conflicts.length > 0 ||
    !chunksComplete;

  const enginesAttempted = [
    params.deterministic ? "pdf_layout" : null,
    params.aiData ? "gemini_summary_vision" : null,
    params.chunks.candidateChunks > 0 ? "gemini_complete_text_chunks" : null,
  ].filter((value): value is string => Boolean(value));

  return {
    ...(params.deterministic?.diagnostics ?? {}),
    engine:
      enginesAttempted.length > 1
        ? "hybrid-complete-financial-statement-v2"
        : enginesAttempted[0] ?? "unknown",
    confidence: Math.round(confidence * 100) / 100,
    quality: confidence >= 0.9 ? ("high" as const) : confidence >= 0.7 ? ("medium" as const) : ("low" as const),
    requiresReview,
    lineItemCount: params.lineItemCount,
    candidateChunks: params.chunks.candidateChunks,
    completedChunks: params.chunks.completedChunks,
    failedChunks: params.chunks.failedChunks,
    warnings: [...new Set(params.warnings)],
    enginesAttempted,
    conflicts: params.conflicts,
  };
}

export async function extractFinancialStatementProduction(params: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<ProductionFinancialStatementResult> {
  let deterministic: DeterministicFinancialStatementResult | null = null;
  let deterministicError: string | null = null;

  try {
    deterministic = await extractFinancialStatementFromPdf(
      params.buffer,
      params.fileName,
    );
  } catch (error) {
    deterministicError = getErrorMessage(error);
  }

  let aiData: ExtractedDocumentData | null = null;
  let aiError: string | null = null;

  if (shouldRequestAiSummary(deterministic)) {
    try {
      aiData = normalizeAiFinancialStatement(
        await extractDocumentData({
          fileName: params.fileName,
          category: "FINANCIAL_STATEMENT",
          content: {
            kind: "inline",
            mimeType: params.mimeType,
            base64Data: params.buffer.toString("base64"),
          },
          summaryOnly: true,
        }),
      );
    } catch (error) {
      aiError = getErrorMessage(error);
    }
  }

  let chunks = emptyChunkResult();
  let chunkError: string | null = null;
  const sourceText = deterministic?.sourceText ?? "";

  if (sourceText.trim().length > 200) {
    const metadataSource = deterministic?.data ?? aiData;

    try {
      chunks = await extractDocumentLineItemsFromTextChunks({
        fileName: params.fileName,
        category: "FINANCIAL_STATEMENT",
        text: sourceText,
        reportedUnit: metadataSource?.reportedUnit,
        scaleMultiplier: metadataSource?.scaleMultiplier,
        documentDate:
          metadataSource?.documentDate ??
          metadataSource?.periodEnd ??
          metadataSource?.periodStart ??
          null,
      });
    } catch (error) {
      chunkError = getErrorMessage(error);
    }
  }

  const deterministicData = deterministic
    ? sanitizeFinancialStatementExtraction(deterministic.data)
    : null;

  let baseData: ExtractedDocumentData | null = deterministicData ?? aiData;
  let conflicts: string[] = [];

  if (deterministicData && aiData) {
    const merged = mergeHeadlineMetrics({
      deterministic: deterministicData,
      ai: aiData,
    });
    baseData = merged.merged;
    conflicts = merged.conflicts;
  }

  if (!baseData) {
    // No readable text layer and summary-only vision failed. Make one final
    // full vision attempt so scanned statements still return the maximum data
    // the model can read, while marking the result for human review.
    try {
      const visionData = normalizeAiFinancialStatement(
        await extractDocumentData({
          fileName: params.fileName,
          category: "FINANCIAL_STATEMENT",
          content: {
            kind: "inline",
            mimeType: params.mimeType,
            base64Data: params.buffer.toString("base64"),
          },
          summaryOnly: false,
        }),
      );
      aiData = visionData;
      baseData = visionData;
    } catch (error) {
      aiError = aiError ?? getErrorMessage(error);
    }
  }

  if (!baseData) {
    throw new Error(
      [
        "Financial statement extraction failed in layout, chunk, and vision engines.",
        deterministicError ? `Layout engine: ${deterministicError}` : null,
        chunkError ? `Chunk engine: ${chunkError}` : null,
        aiError ? `Vision engine: ${aiError}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const lineItems = mergeLineItems(
    deterministicData?.lineItems,
    aiData?.lineItems,
    chunks.lineItems,
    baseData.lineItems,
  );
  const warnings = [
    ...(deterministic?.diagnostics.warnings ?? []),
    ...chunks.warnings,
    deterministicError ? `Layout engine warning: ${deterministicError}` : null,
    aiError ? `AI summary warning: ${aiError}` : null,
    chunkError ? `Chunk engine warning: ${chunkError}` : null,
    ...conflicts.map((conflict) => `Cross-engine conflict: ${conflict}`),
  ].filter((value): value is string => Boolean(value));

  const finalData: ExtractedDocumentData = {
    ...baseData,
    summary:
      deterministicData?.summary ||
      aiData?.summary ||
      baseData.summary ||
      "Financial statement extracted using layout, summary, and complete detail engines.",
    lineItems,
    transactions: [],
    extractionDiagnostics: buildDiagnostics({
      deterministic,
      aiData,
      chunks,
      conflicts,
      lineItemCount: lineItems.length,
      warnings,
    }),
  };
  const sanitized = sanitizeFinancialStatementExtraction(finalData);
  const chunksIncomplete = chunks.candidateChunks > 0 && chunks.failedChunks > 0;
  const warning =
    conflicts.length > 0
      ? "Layout and AI extraction disagreed on some headline metrics. Review is required before approval."
      : chunksIncomplete
        ? `${chunks.failedChunks} of ${chunks.candidateChunks} detail chunks did not finish. Retry analysis before approval.`
        : aiError && deterministic
          ? "The layout and complete text engines finished, but AI summary verification was unavailable. Review the source before approval."
          : deterministicError && aiData
            ? "The PDF text layout could not be read. Vision extraction was used and requires source review."
            : null;

  return {
    data: sanitized,
    rawLineItems: toRawLineItems(sanitized),
    sourceText,
    metricEvidence: deterministic?.metricEvidence ?? {},
    warning,
  };
}
