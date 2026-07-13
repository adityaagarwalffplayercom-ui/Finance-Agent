import { extractDocumentData, type ExtractedDocumentData } from "./gemini";
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
          confidence:
            typeof item.confidence === "number" ? item.confidence : 0.68,
        }))
      : [],
  } satisfies ExtractedDocumentData;
}

function mergeLineItems(
  deterministic: ExtractedDocumentData["lineItems"],
  ai: ExtractedDocumentData["lineItems"],
) {
  const items = [
    ...(Array.isArray(deterministic) ? deterministic : []),
    ...(Array.isArray(ai) ? ai : []),
  ];
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
      conflicts.push(
        `${key}: layout ${deterministicValue} vs AI ${aiValue}`,
      );
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

function shouldUseAi(result: DeterministicFinancialStatementResult | null) {
  if (!result) return true;
  return (
    !result.usable ||
    result.diagnostics.likelyScanned ||
    result.diagnostics.confidence < 0.82 ||
    result.rawLineItems.length < 8
  );
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

  if (!shouldUseAi(deterministic)) {
    return {
      data: sanitizeFinancialStatementExtraction(deterministic!.data),
      rawLineItems: deterministic!.rawLineItems,
      sourceText: deterministic!.sourceText,
      metricEvidence: deterministic!.metricEvidence,
      warning: null,
    };
  }

  let aiData: ExtractedDocumentData | null = null;
  let aiError: string | null = null;

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
        summaryOnly: false,
      }),
    );
  } catch (error) {
    aiError = getErrorMessage(error);
  }

  if (deterministic && aiData) {
    const { merged, conflicts } = mergeHeadlineMetrics({
      deterministic: deterministic.data,
      ai: aiData,
    });
    const deterministicDiagnostics = deterministic.diagnostics;
    const confidencePenalty = conflicts.length > 0 ? Math.min(0.25, conflicts.length * 0.04) : 0;
    const confidence = Math.max(
      0.45,
      Math.min(0.98, deterministicDiagnostics.confidence + 0.08 - confidencePenalty),
    );
    const warnings = [
      ...deterministicDiagnostics.warnings,
      ...conflicts.map((conflict) => `Cross-engine conflict: ${conflict}`),
    ];
    const lineItems = mergeLineItems(
      deterministic.data.lineItems,
      aiData.lineItems,
    );
    const finalData: ExtractedDocumentData = {
      ...merged,
      summary:
        deterministic.data.summary ||
        aiData.summary ||
        "Financial statement extracted using layout and vision engines.",
      lineItems,
      transactions: [],
      extractionDiagnostics: {
        ...deterministicDiagnostics,
        engine: "hybrid",
        confidence: Math.round(confidence * 100) / 100,
        quality: confidence >= 0.9 ? "high" : confidence >= 0.72 ? "medium" : "low",
        requiresReview:
          deterministicDiagnostics.requiresReview || conflicts.length > 0,
        lineItemCount: lineItems.length,
        warnings: [...new Set(warnings)],
        enginesAttempted: ["pdf_layout", "gemini_vision"],
        conflicts,
      },
    };

    return {
      data: sanitizeFinancialStatementExtraction(finalData),
      rawLineItems: toRawLineItems(finalData),
      sourceText: deterministic.sourceText,
      metricEvidence: deterministic.metricEvidence,
      warning:
        conflicts.length > 0
          ? "Layout and AI extraction disagreed on some metrics. Review is required before approval."
          : null,
    };
  }

  if (deterministic) {
    const warnings = [
      ...deterministic.diagnostics.warnings,
      aiError ? `AI fallback unavailable: ${aiError}` : "AI fallback was unavailable.",
    ];
    const finalData: ExtractedDocumentData = {
      ...deterministic.data,
      extractionDiagnostics: {
        ...deterministic.diagnostics,
        requiresReview: true,
        warnings: [...new Set(warnings)],
        enginesAttempted: ["pdf_layout", "gemini_vision"],
        conflicts: [],
      },
    };

    return {
      data: sanitizeFinancialStatementExtraction(finalData),
      rawLineItems: deterministic.rawLineItems,
      sourceText: deterministic.sourceText,
      metricEvidence: deterministic.metricEvidence,
      warning:
        "The layout engine completed, but AI verification was unavailable. Review the source before approval.",
    };
  }

  if (aiData && coreMetricCount(aiData) >= 2) {
    const lineItems = Array.isArray(aiData.lineItems) ? aiData.lineItems : [];
    const finalData: ExtractedDocumentData = {
      ...aiData,
      lineItems,
      extractionDiagnostics: {
        engine: "gemini_vision",
        confidence: coreMetricCount(aiData) >= 5 ? 0.76 : 0.62,
        quality: coreMetricCount(aiData) >= 5 ? "medium" : "low",
        requiresReview: true,
        textLayerAvailable: false,
        likelyScanned: true,
        selectedScope: null,
        statementPages: [],
        detectedSections: [],
        lineItemCount: lineItems.length,
        currentPeriod: aiData.periodEnd ?? aiData.documentDate ?? null,
        warnings: [
          deterministicError ?? "The PDF layout engine could not read this document.",
          "Values were extracted with the vision model and require source review.",
        ],
        checks: [],
        enginesAttempted: ["pdf_layout", "gemini_vision"],
        conflicts: [],
      },
    };

    return {
      data: sanitizeFinancialStatementExtraction(finalData),
      rawLineItems: toRawLineItems(finalData),
      sourceText: "",
      metricEvidence: {},
      warning: "Vision fallback was used. Review the extracted values before approval.",
    };
  }

  throw new Error(
    [
      "Financial statement extraction failed in both layout and vision engines.",
      deterministicError ? `Layout engine: ${deterministicError}` : null,
      aiError ? `Vision engine: ${aiError}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}
