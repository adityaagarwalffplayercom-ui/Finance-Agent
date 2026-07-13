import type { ExtractedDocumentData } from "./gemini";
import type { RawFinancialLineItem } from "./raw-financial-line-items";

export type StatementScope = "standalone" | "consolidated" | "unspecified";
export type StatementSection =
  | "profit_and_loss"
  | "balance_sheet"
  | "cash_flow"
  | "changes_in_equity";

export type FinancialExtractionCheck = {
  key: string;
  passed: boolean;
  message: string;
  difference?: number | null;
};

export type FinancialExtractionDiagnostics = {
  engine: "pdf_layout";
  confidence: number;
  quality: "high" | "medium" | "low";
  requiresReview: boolean;
  textLayerAvailable: boolean;
  likelyScanned: boolean;
  selectedScope: StatementScope;
  statementPages: number[];
  detectedSections: StatementSection[];
  lineItemCount: number;
  currentPeriod: string | null;
  warnings: string[];
  checks: FinancialExtractionCheck[];
};

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

type PdfPageData = {
  pageIndex?: number;
  getTextContent: (options?: {
    normalizeWhitespace?: boolean;
    disableCombineTextItems?: boolean;
  }) => Promise<{ items?: PdfTextItem[] }>;
  getViewport?: (options: { scale: number }) => {
    width?: number;
    height?: number;
  };
};

type PositionedText = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  center: number;
};

type LayoutRow = {
  y: number;
  items: PositionedText[];
};

type PageClassification = {
  scope: StatementScope;
  section: StatementSection | null;
  confidence: number;
  explicitScope: boolean;
  explicitSection: boolean;
};

type ParsedPage = {
  pageNumber: number;
  width: number;
  height: number;
  text: string;
  rows: LayoutRow[];
  classification: PageClassification;
};

type NumericColumn = {
  center: number;
  count: number;
  headerText: string;
  period: string | null;
  year: number | null;
  annualScore: number;
  quarterScore: number;
  headerConfidence: number;
};

type SelectedColumn = NumericColumn & {
  selectionConfidence: number;
  fallbackUsed: boolean;
};

type ParsedStatementLine = RawFinancialLineItem & {
  baseDescription: string;
  displayedAmount: number;
  pageNumber: number;
  statementType: StatementSection;
  scope: StatementScope;
  sourceColumn: string | null;
  sourceText: string;
  confidence: number;
  isAggregate: boolean;
  rowIndex: number;
};

export type DeterministicFinancialStatementResult = {
  data: ExtractedDocumentData;
  rawLineItems: RawFinancialLineItem[];
  sourceText: string;
  metricEvidence: Record<string, string>;
  selectedScope: StatementScope;
  statementPages: number[];
  diagnostics: FinancialExtractionDiagnostics;
  usable: boolean;
};

const MONEY_TOKEN_PATTERN =
  /^(?:₹|Rs\.?|INR|USD|US\$|EUR|GBP|£|€)?\s*\(?\s*-?\d+(?:,\d{2,3})*(?:\.\d+)?\s*\)?$/i;
const INLINE_MONEY_PATTERN =
  /(?:₹|Rs\.?|INR|USD|US\$|EUR|GBP|£|€)?\s*\(?\s*-?\d+(?:,\d{2,3})*(?:\.\d+)?\s*\)?/gi;
const DATE_NUMERIC_PATTERN = /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/;
const YEAR_PATTERN = /\b(?:19|20)\d{2}\b/;
const MONTH_PATTERN =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;
const PERIOD_WORD_PATTERN =
  /year ended|financial year|fiscal year|twelve months|annual|quarter ended|three months|six months|nine months|as at|as of|fy\s*\d/i;
const METADATA_PATTERN =
  /registered office|corporate office|telephone|phone|e-?mail|website|www\.|https?:|cin\b|din\b|scrip code|nse symbol|bse code|board meeting|audit committee|for and on behalf|independent auditor|regulation|pursuant to|sebi|signed|signature|place\s*:/i;
const HEADER_PATTERN =
  /particulars|note\s*no|quarter ended|year ended|financial year|fiscal year|audited|unaudited|un-audited|amounts? in|currency in|statement of|financial results|balance sheet|financial position|statement of cash flows?|cash flow statement/i;
const GENERIC_SECTION_LABELS = new Set([
  "income",
  "expenses",
  "assets",
  "liabilities",
  "equity",
  "equityandliabilities",
  "currentassets",
  "noncurrentassets",
  "currentliabilities",
  "noncurrentliabilities",
  "taxexpense",
  "othercomprehensiveincome",
  "adjustmentsfor",
  "cashflowsfromoperatingactivities",
  "cashflowsfrominvestingactivities",
  "cashflowsfromfinancingactivities",
]);

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, " ").replace(/\s+/g, " ").trim()
    : "";
}

function compactText(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function roundConfidence(value: number) {
  return Math.round(clamp(value) * 100) / 100;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function isDateLike(value: string) {
  const text = cleanText(value);
  return (
    DATE_NUMERIC_PATTERN.test(text) ||
    (MONTH_PATTERN.test(text) && YEAR_PATTERN.test(text)) ||
    /^\(?\s*(?:19|20)\d{2}\s*\)?$/.test(text)
  );
}

function isPercentage(value: string) {
  return /%/.test(value);
}

function parseAmountToken(value: string) {
  const text = cleanText(value);

  if (
    !text ||
    text === "-" ||
    text === "–" ||
    text === "—" ||
    isDateLike(text) ||
    isPercentage(text) ||
    !MONEY_TOKEN_PATTERN.test(text)
  ) {
    return null;
  }

  const negative = /^\s*\(/.test(text) || /-\s*\d/.test(text);
  const numeric = text
    .replace(/₹|Rs\.?|INR|USD|US\$|EUR|GBP|£|€/gi, "")
    .replace(/[(),\s]/g, "")
    .replace(/^-/, "");
  const parsed = Number(numeric);

  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function amountFromItem(value: string) {
  const direct = parseAmountToken(value);
  if (direct !== null) return direct;

  const matches = cleanText(value).match(INLINE_MONEY_PATTERN) ?? [];
  const parsed = matches
    .map(parseAmountToken)
    .filter((candidate): candidate is number => candidate !== null);

  return parsed.length === 1 ? parsed[0] : null;
}

function stripNonLabelTokens(value: string) {
  return cleanText(value)
    .replace(DATE_NUMERIC_PATTERN, " ")
    .replace(INLINE_MONEY_PATTERN, " ")
    .replace(/^\s*(?:\(?[ivxlcdm]+\)?|\(?[a-z]\)?|\d+)[.)-]?\s+/i, "")
    .replace(/\bnote\s*(?:no\.?\s*)?\d+[a-z]?\b/gi, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/^[\s:;,.|/\\\-–—]+|[\s:;,.|/\\\-–—]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


function explodePdfTextItem(item: PdfTextItem) {
  const text = cleanText(item.str);
  const x = item.transform?.[4] ?? 0;
  const y = item.transform?.[5] ?? 0;
  const width = Math.max(0, item.width ?? 0);
  const height = Math.abs(item.transform?.[3] ?? item.height ?? 0);

  if (!text || isDateLike(text)) {
    return [{ text, x, y, width, height }];
  }

  const regex = new RegExp(INLINE_MONEY_PATTERN.source, "gi");
  const matches = [...text.matchAll(regex)].filter(
    (match) => match.index !== undefined && parseAmountToken(match[0]) !== null,
  );

  if (matches.length <= 1 || width <= 0 || text.length <= 1) {
    return [{ text, x, y, width, height }];
  }

  const result: Array<{ text: string; x: number; y: number; width: number; height: number }> = [];
  let cursor = 0;

  const pushSegment = (segment: string, start: number, end: number) => {
    const cleaned = cleanText(segment);
    if (!cleaned || end <= start) return;
    const segmentX = x + (start / text.length) * width;
    const segmentWidth = ((end - start) / text.length) * width;
    result.push({ text: cleaned, x: segmentX, y, width: segmentWidth, height });
  };

  for (const match of matches) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    pushSegment(text.slice(cursor, start), cursor, start);
    pushSegment(match[0], start, end);
    cursor = end;
  }
  pushSegment(text.slice(cursor), cursor, text.length);

  return result.length > 0 ? result : [{ text, x, y, width, height }];
}

function groupTextItems(items: PdfTextItem[]) {
  const heights = items
    .map((item) => Math.abs(item.transform?.[3] ?? item.height ?? 0))
    .filter((value) => value > 0 && value < 100);
  const rowTolerance = clamp(median(heights) * 0.32, 1.4, 3.6);
  const positioned = items
    .flatMap(explodePdfTextItem)
    .map((item) => ({
      ...item,
      right: item.x + item.width,
      center: item.x + item.width / 2,
    }))
    .filter((item) => item.text)
    .sort((left, right) => right.y - left.y || left.x - right.x);
  const rows: LayoutRow[] = [];

  for (const item of positioned) {
    let nearest: LayoutRow | null = null;
    let distance = Number.POSITIVE_INFINITY;

    for (const candidate of rows) {
      const currentDistance = Math.abs(candidate.y - item.y);
      if (currentDistance <= rowTolerance && currentDistance < distance) {
        nearest = candidate;
        distance = currentDistance;
      }
    }

    if (!nearest) {
      nearest = { y: item.y, items: [] };
      rows.push(nearest);
    }

    nearest.items.push(item);
  }

  rows.sort((left, right) => right.y - left.y);
  for (const row of rows) {
    row.items.sort((left, right) => left.x - right.x);
  }

  return rows;
}

function rowText(row: LayoutRow) {
  return cleanText(row.items.map((item) => item.text).join(" "));
}

function scoreTerms(text: string, terms: RegExp[]) {
  return terms.reduce((score, term) => score + (term.test(text) ? 1 : 0), 0);
}

function classifyPage(text: string): PageClassification {
  const normalized = cleanText(text).toLowerCase();
  const scope: StatementScope = /consolidated|group financial|group statement/i.test(
    normalized,
  )
    ? "consolidated"
    : /standalone|separate financial|company financial/i.test(normalized)
      ? "standalone"
      : "unspecified";
  const explicitScope = scope !== "unspecified";

  const scores: Record<StatementSection, number> = {
    profit_and_loss: scoreTerms(normalized, [
      /statement of profit and loss/,
      /profit and loss account/,
      /income statement/,
      /statement of operations/,
      /financial results/,
      /revenue from operations/,
      /profit before tax/,
      /profit for the (?:period|year)/,
      /earnings per share/,
    ]),
    balance_sheet: scoreTerms(normalized, [
      /balance sheet/,
      /statement of financial position/,
      /total assets/,
      /current assets/,
      /non-current assets/,
      /total equity/,
      /current liabilities/,
      /non-current liabilities/,
    ]),
    cash_flow: scoreTerms(normalized, [
      /statement of cash flows?/,
      /cash flow statement/,
      /cash flows? from operating activities/,
      /cash flows? from investing activities/,
      /cash flows? from financing activities/,
      /net increase.*cash/,
      /cash and cash equivalents at the (?:end|beginning)/,
    ]),
    changes_in_equity: scoreTerms(normalized, [
      /statement of changes in equity/,
      /changes in equity/,
      /other equity/,
      /balance at the beginning of the year/,
      /balance at the end of the year/,
    ]),
  };

  const ranked = (Object.entries(scores) as Array<[StatementSection, number]>).sort(
    (left, right) => right[1] - left[1],
  );
  const [section, topScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;
  const explicitSection =
    /statement of profit and loss|profit and loss account|income statement|statement of operations|financial results|balance sheet|statement of financial position|statement of cash flows?|cash flow statement|statement of changes in equity/i.test(
      normalized,
    );

  if (topScore < 2 && !explicitSection) {
    return {
      scope,
      section: null,
      confidence: explicitScope ? 0.35 : 0.2,
      explicitScope,
      explicitSection: false,
    };
  }

  const confidence = clamp(
    0.48 + Math.min(topScore, 5) * 0.09 + (topScore - secondScore) * 0.04,
    0,
    0.98,
  );

  return {
    scope,
    section,
    confidence,
    explicitScope,
    explicitSection,
  };
}

function inheritContinuationClassifications(pages: ParsedPage[]) {
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const previous = pages[index - 1];
    const next = pages[index + 1];
    const compact = compactText(page.text);
    const continuationSignal =
      /continued|cashflowsfrom|totalassets|totalequityandliabilities|profitfortheperiod|netcash/.test(
        compact,
      );

    // A statement can start near the bottom of one page and continue on the
    // next. The first page may contain too few table rows for a high score, so
    // promote it only when an adjacent page is an unmistakable continuation of
    // the same statement. This avoids admitting cover pages, audit reports and
    // press releases that merely mention financial results.
    if (
      page.classification.section &&
      page.classification.explicitSection &&
      page.classification.confidence < 0.72
    ) {
      const adjacentContinuation = [previous, next].find((candidate) => {
        if (!candidate) return false;
        const candidateCompact = compactText(candidate.text);
        const sameSection =
          candidate.classification.section === page.classification.section;
        const compatibleScope =
          candidate.classification.scope === page.classification.scope ||
          candidate.classification.scope === "unspecified";
        return (
          sameSection &&
          compatibleScope &&
          /continued|cashflowsfrom|netcash/.test(candidateCompact)
        );
      });

      if (adjacentContinuation) {
        page.classification = {
          ...page.classification,
          confidence: 0.74,
        };
      }
    }

    if (!continuationSignal) continue;

    if (
      page.classification.section &&
      page.classification.scope === "unspecified"
    ) {
      const source = [previous, next].find(
        (candidate) =>
          candidate?.classification.section === page.classification.section &&
          candidate.classification.scope !== "unspecified",
      );

      if (source) {
        page.classification = {
          ...page.classification,
          scope: source.classification.scope,
          confidence: Math.max(
            page.classification.confidence,
            Math.min(0.78, source.classification.confidence * 0.86),
          ),
          explicitScope: false,
        };
      }
      continue;
    }

    if (page.classification.section) continue;

    const source = previous?.classification.section
      ? previous
      : next?.classification.section
        ? next
        : null;

    if (!source) continue;

    page.classification = {
      scope:
        page.classification.scope !== "unspecified"
          ? page.classification.scope
          : source.classification.scope,
      section: source.classification.section,
      confidence: Math.min(0.72, source.classification.confidence * 0.82),
      explicitScope: page.classification.explicitScope,
      explicitSection: false,
    };
  }
}

function parseDateParts(day: number, month: number, year: number) {
  if (
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function parsePeriodCandidates(text: string) {
  const results: string[] = [];
  const normalized = cleanText(text);

  for (const match of normalized.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g)) {
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    const parsed = parseDateParts(Number(match[1]), Number(match[2]), year);
    if (parsed) results.push(parsed);
  }

  for (const match of normalized.matchAll(
    /\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})\b/gi,
  )) {
    const month = MONTHS[match[2].toLowerCase()];
    const parsed = parseDateParts(Number(match[1]), month, Number(match[3]));
    if (parsed) results.push(parsed);
  }

  for (const match of normalized.matchAll(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
  )) {
    const month = MONTHS[match[1].toLowerCase()];
    const parsed = parseDateParts(Number(match[2]), month, Number(match[3]));
    if (parsed) results.push(parsed);
  }

  const fyMatch = normalized.match(/\bFY\s*(\d{4})\s*[-/]\s*(\d{2,4})\b/i);
  if (fyMatch) {
    const endYear = Number(fyMatch[2]) < 100 ? Math.floor(Number(fyMatch[1]) / 100) * 100 + Number(fyMatch[2]) : Number(fyMatch[2]);
    const parsed = parseDateParts(31, 3, endYear);
    if (parsed) results.push(parsed);
  }

  return [...new Set(results)].sort();
}

function detectUnitAndCurrency(text: string): {
  reportedUnit: NonNullable<ExtractedDocumentData["reportedUnit"]>;
  scaleMultiplier: number;
  evidence: string;
  currency: string;
  confidence: number;
} {
  const value = cleanText(text).toLowerCase();
  const currency = /\busd\b|us\$|\$/.test(value)
    ? "USD"
    : /\beur\b|€/.test(value)
      ? "EUR"
      : /\bgbp\b|£/.test(value)
        ? "GBP"
        : /\binr\b|₹|\brs\.?\b|rupees?/.test(value)
          ? "INR"
          : "INR";

  const unitCandidates: Array<{
    pattern: RegExp;
    reportedUnit: NonNullable<ExtractedDocumentData["reportedUnit"]>;
    scaleMultiplier: number;
    evidence: string;
  }> = [
    {
      pattern: /(?:amounts?|figures?|currency|₹|rs\.?|inr|rupees?)\s*(?:are\s*)?(?:in\s*)?billions?|\bin billions?\b/i,
      reportedUnit: "billions",
      scaleMultiplier: 1_000_000_000,
      evidence: "Amounts reported in billions",
    },
    {
      pattern: /(?:amounts?|figures?|currency|₹|rs\.?|inr|rupees?)\s*(?:are\s*)?(?:in\s*)?millions?|\bin millions?\b/i,
      reportedUnit: "millions",
      scaleMultiplier: 1_000_000,
      evidence: "Amounts reported in millions",
    },
    {
      pattern: /(?:amounts?|figures?|currency|₹|rs\.?|inr|rupees?)\s*(?:are\s*)?(?:in\s*)?crores?|\bin crores?\b/i,
      reportedUnit: "crores",
      scaleMultiplier: 10_000_000,
      evidence: "Amounts reported in crores",
    },
    {
      pattern: /(?:amounts?|figures?|currency|₹|rs\.?|inr|rupees?)\s*(?:are\s*)?(?:in\s*)?lakhs?|\bin lakhs?\b/i,
      reportedUnit: "lakhs",
      scaleMultiplier: 100_000,
      evidence: "Amounts reported in lakhs",
    },
    {
      pattern: /(?:amounts?|figures?|currency|₹|rs\.?|inr|rupees?)\s*(?:are\s*)?(?:in\s*)?thousands?|\bin thousands?\b/i,
      reportedUnit: "thousands",
      scaleMultiplier: 1_000,
      evidence: "Amounts reported in thousands",
    },
  ];

  const detected = unitCandidates.find((candidate) => candidate.pattern.test(value));
  if (detected) {
    return { ...detected, currency, confidence: 0.98 };
  }

  return {
    reportedUnit: "actual",
    scaleMultiplier: 1,
    evidence: "No explicit reporting scale detected; values kept as displayed",
    currency,
    confidence: 0.45,
  };
}

function numericCell(item: PositionedText) {
  const amount = amountFromItem(item.text);
  if (amount === null) return null;
  return { item, amount };
}

function clusterNumericColumns(page: ParsedPage) {
  const candidates = page.rows.flatMap((row, rowIndex) =>
    row.items.flatMap((item) => {
      const parsed = numericCell(item);
      if (!parsed) return [];
      if (rowIndex < 2 && isDateLike(item.text)) return [];
      return [{ center: item.center, rowIndex }];
    }),
  );
  const tolerance = Math.max(8, page.width * 0.018);
  const clusters: Array<{ centers: number[]; rows: Set<number> }> = [];

  for (const candidate of candidates.sort((left, right) => left.center - right.center)) {
    let nearest: (typeof clusters)[number] | null = null;
    let distance = Number.POSITIVE_INFINITY;

    for (const cluster of clusters) {
      const clusterCenter = median(cluster.centers);
      const currentDistance = Math.abs(clusterCenter - candidate.center);
      if (currentDistance <= tolerance && currentDistance < distance) {
        nearest = cluster;
        distance = currentDistance;
      }
    }

    if (!nearest) {
      nearest = { centers: [], rows: new Set() };
      clusters.push(nearest);
    }

    nearest.centers.push(candidate.center);
    nearest.rows.add(candidate.rowIndex);
  }

  const compactPageText = compactText(page.text);
  const minimumRows =
    page.classification.explicitSection ||
    /continued|cashflowsfrom|profitfortheperiod|totalassets/.test(compactPageText)
      ? 2
      : 3;

  return clusters
    .map((cluster) => ({ center: median(cluster.centers), count: cluster.rows.size }))
    .filter((cluster) => cluster.count >= minimumRows)
    .sort((left, right) => left.center - right.center);
}

function headerContextForColumn(page: ParsedPage, center: number) {
  const headerRowLimit = Math.min(
    page.rows.length,
    Math.max(8, Math.ceil(page.rows.length * 0.34)),
  );
  const maxDistance = Math.max(28, page.width * 0.14);
  const parts: string[] = [];

  for (let rowIndex = 0; rowIndex < headerRowLimit; rowIndex += 1) {
    const row = page.rows[rowIndex];
    const periodish = row.items.filter((item) =>
      PERIOD_WORD_PATTERN.test(item.text) ||
      isDateLike(item.text) ||
      YEAR_PATTERN.test(item.text) ||
      /quarter|annual|audited|unaudited/i.test(item.text),
    );

    if (periodish.length === 0) continue;

    const nearest = [...periodish].sort(
      (left, right) => Math.abs(left.center - center) - Math.abs(right.center - center),
    )[0];

    if (nearest && Math.abs(nearest.center - center) <= maxDistance) {
      parts.push(nearest.text);
    }
  }

  return cleanText(parts.join(" | "));
}

function enrichColumnsWithHeaders(page: ParsedPage) {
  return clusterNumericColumns(page).map<NumericColumn>((cluster) => {
    const headerText = headerContextForColumn(page, cluster.center);
    const periods = parsePeriodCandidates(headerText);
    const period = periods.at(-1) ?? null;
    const yearMatch = headerText.match(YEAR_PATTERN);
    const year = period ? Number(period.slice(0, 4)) : yearMatch ? Number(yearMatch[0]) : null;
    const annualScore = scoreTerms(headerText.toLowerCase(), [
      /year ended/,
      /financial year/,
      /fiscal year/,
      /twelve months/,
      /annual/,
      /\bfy\b/,
    ]);
    const quarterScore = scoreTerms(headerText.toLowerCase(), [
      /quarter ended/,
      /three months/,
      /six months/,
      /nine months/,
    ]);
    const headerConfidence = period
      ? annualScore > 0 || quarterScore > 0
        ? 0.98
        : 0.88
      : year
        ? 0.7
        : 0.25;

    return {
      ...cluster,
      headerText,
      period,
      year,
      annualScore,
      quarterScore,
      headerConfidence,
    };
  });
}

function selectCurrentColumn(page: ParsedPage): SelectedColumn | null {
  const columns = enrichColumnsWithHeaders(page);
  if (columns.length === 0) return null;

  const section = page.classification.section;
  const withPeriod = columns.filter((column) => column.period || column.year);

  if (withPeriod.length > 0) {
    const ranked = [...withPeriod].sort((left, right) => {
      const leftKey = left.period ?? `${left.year}-12-31`;
      const rightKey = right.period ?? `${right.year}-12-31`;
      if (leftKey !== rightKey) return rightKey.localeCompare(leftKey);

      if (section === "profit_and_loss") {
        const leftAnnual = left.annualScore - left.quarterScore;
        const rightAnnual = right.annualScore - right.quarterScore;
        if (leftAnnual !== rightAnnual) return rightAnnual - leftAnnual;
      }

      return left.center - right.center;
    });
    const selected = ranked[0];
    const annualBoost =
      section === "profit_and_loss" && selected.annualScore > selected.quarterScore
        ? 0.05
        : 0;

    return {
      ...selected,
      selectionConfidence: clamp(selected.headerConfidence + annualBoost),
      fallbackUsed: false,
    };
  }

  const selected =
    section === "profit_and_loss" && columns.length >= 4
      ? columns.at(-2) ?? columns[0]
      : columns[0];

  return {
    ...selected,
    selectionConfidence: columns.length >= 2 ? 0.42 : 0.3,
    fallbackUsed: true,
  };
}

function isValidLabel(value: string) {
  const label = cleanText(value);
  const compact = compactText(label);

  if (!label || compact.length < 2 || !/[a-z]/i.test(label)) return false;
  if (METADATA_PATTERN.test(label)) return false;
  if (isDateLike(label)) return false;
  if (/^(?:particulars?|notes?|note no|current year|previous year)$/i.test(label)) {
    return false;
  }
  if (/^[a-z]$/i.test(label) || /^[ivxlcdm]+$/i.test(label)) return false;
  return true;
}

function isSectionHeading(value: string) {
  const compact = compactText(value);
  return (
    GENERIC_SECTION_LABELS.has(compact) ||
    /cashflowsfrom(?:operating|investing|financing)activities/.test(compact) ||
    /^(?:income|expenses|assets|liabilities|equity|adjustmentsfor)$/.test(compact)
  );
}

function inferCategory(description: string, section: StatementSection) {
  const value = compactText(description);

  if (/revenue|sales|turnover|saleofproducts|incomefromoperations/.test(value)) {
    return "Revenue";
  }
  if (/otherincome|interestincome|totalincome/.test(value)) return "Income";
  if (/profit|loss|comprehensiveincome|earningspershare/.test(value)) {
    return "Profit / Loss";
  }
  if (/tax|gst|deferredtax|currenttax/.test(value)) return "Tax";
  if (/cash|bankbalance/.test(value)) return "Cash";
  if (/equity|sharecapital|reserve|networth/.test(value)) return "Equity";
  if (/liabilit|payable|borrow|debt|provision|creditor|leaseobligation/.test(value)) {
    return "Liability";
  }
  if (/asset|property|plant|equipment|inventor|receivable|investment|goodwill|intangible|rightofuse|capitalwork/.test(value)) {
    return "Asset";
  }
  if (/interest|financecost/.test(value)) return "Finance Cost";
  if (/expense|cost|purchase|materials|employee|depreciation|amorti|consumption/.test(value)) {
    return "Expense";
  }
  if (section === "cash_flow") return "Cash Flow";
  if (section === "balance_sheet") return "Balance Sheet";
  if (section === "changes_in_equity") return "Equity";
  return "Profit & Loss";
}

function isAggregateLabel(description: string) {
  const compact = compactText(description);
  return (
    /^(?:total|subtotal|gross|net|profit|loss|equity|assets|liabilities)/.test(compact) ||
    /(?:total|subtotal|profitforthe|lossforthe|netcash|closingbalance|openingbalance|attheendoftheperiod)$/.test(
      compact,
    )
  );
}

function statementTypeLabel(section: StatementSection) {
  if (section === "profit_and_loss") return "Profit & Loss";
  if (section === "balance_sheet") return "Balance Sheet";
  if (section === "cash_flow") return "Cash Flow";
  return "Changes in Equity";
}

function scopeLabel(scope: StatementScope) {
  if (scope === "consolidated") return "Consolidated";
  if (scope === "standalone") return "Standalone";
  return "Unspecified scope";
}

function extractPageLines(params: {
  page: ParsedPage;
  selectedColumn: SelectedColumn;
  scaleMultiplier: number;
  periodEnd: string | null;
  currency: string;
  reportedUnit: NonNullable<ExtractedDocumentData["reportedUnit"]>;
}) {
  const { page, selectedColumn, scaleMultiplier, periodEnd, currency, reportedUnit } =
    params;
  const section = page.classification.section;
  if (!section) return [];

  const result: ParsedStatementLine[] = [];
  const amountTolerance = Math.max(14, page.width * 0.035);
  const labelBoundary = selectedColumn.center - Math.max(8, page.width * 0.012);
  let pendingLabel: string | null = null;
  let currentSection: string | null = null;

  for (let rowIndex = 0; rowIndex < page.rows.length; rowIndex += 1) {
    const row = page.rows[rowIndex];
    const sourceText = rowText(row);

    if (!sourceText || METADATA_PATTERN.test(sourceText)) {
      pendingLabel = null;
      continue;
    }

    if (
      parsePeriodCandidates(sourceText).length > 0 &&
      row.items.some((item) => isDateLike(item.text))
    ) {
      pendingLabel = null;
      continue;
    }

    const candidates = row.items
      .map((item) => ({ item, amount: amountFromItem(item.text) }))
      .filter(
        (candidate): candidate is { item: PositionedText; amount: number } =>
          candidate.amount !== null &&
          Math.abs(candidate.item.center - selectedColumn.center) <= amountTolerance,
      )
      .sort(
        (left, right) =>
          Math.abs(left.item.center - selectedColumn.center) -
          Math.abs(right.item.center - selectedColumn.center),
      );
    const selectedAmount = candidates[0] ?? null;
    const labelText = stripNonLabelTokens(
      row.items
        .filter((item) => item.right < labelBoundary)
        .map((item) => item.text)
        .join(" "),
    );

    if (!selectedAmount) {
      if (!isValidLabel(labelText) || HEADER_PATTERN.test(sourceText)) {
        if (HEADER_PATTERN.test(sourceText)) pendingLabel = null;
        continue;
      }

      if (isSectionHeading(labelText)) {
        currentSection = labelText;
        pendingLabel = null;
      } else {
        pendingLabel = pendingLabel
          ? cleanText(`${pendingLabel} ${labelText}`)
          : labelText;
      }
      continue;
    }

    let baseDescription = labelText;
    if ((!baseDescription || compactText(baseDescription).length < 3) && pendingLabel) {
      baseDescription = pendingLabel;
    } else if (
      pendingLabel &&
      baseDescription &&
      compactText(baseDescription).length < 18 &&
      !isSectionHeading(pendingLabel)
    ) {
      baseDescription = cleanText(`${pendingLabel} ${baseDescription}`);
    }
    pendingLabel = null;

    if (!isValidLabel(baseDescription) || HEADER_PATTERN.test(baseDescription)) {
      continue;
    }

    const rowConfidence = roundConfidence(
      0.55 +
        selectedColumn.selectionConfidence * 0.25 +
        page.classification.confidence * 0.15 +
        (Math.abs(selectedAmount.item.center - selectedColumn.center) <= amountTolerance / 2
          ? 0.05
          : 0),
    );
    const category = inferCategory(baseDescription, section);
    const statementLabel = statementTypeLabel(section);
    const scopeText = scopeLabel(page.classification.scope);

    result.push({
      baseDescription,
      description: baseDescription,
      displayedAmount: selectedAmount.amount,
      amount: selectedAmount.amount * scaleMultiplier,
      category,
      date: periodEnd,
      pageNumber: page.pageNumber,
      statementType: section,
      scope: page.classification.scope,
      sourceColumn:
        selectedColumn.headerText || selectedColumn.period || periodEnd || null,
      sourceText,
      confidence: rowConfidence,
      isAggregate: isAggregateLabel(baseDescription),
      rowIndex,
      displayedUnit: reportedUnit,
      currency,
      section: currentSection,
      extractionEngine: "pdf_layout",
      sourcePage: page.pageNumber,
      sourceStatement: `${scopeText} ${statementLabel}`,
    });
  }

  return result;
}

function chooseScope(pages: ParsedPage[]) {
  const scopes: StatementScope[] = ["consolidated", "standalone", "unspecified"];
  const scored = scopes.map((scope) => {
    const scopedPages = pages.filter((page) => page.classification.scope === scope);
    const sections = new Set(
      scopedPages
        .map((page) => page.classification.section)
        .filter((section): section is StatementSection => Boolean(section)),
    );
    const core = sections.has("profit_and_loss") && sections.has("balance_sheet");
    const score =
      (core ? 100 : 0) +
      sections.size * 12 +
      scopedPages.length +
      (scope === "consolidated" ? 8 : scope === "standalone" ? 4 : 0);

    return { scope, score, pages: scopedPages, sections };
  });

  return scored.sort((left, right) => right.score - left.score)[0];
}

function findBestLine(
  lines: ParsedStatementLine[],
  section: StatementSection,
  scorer: (compactDescription: string, line: ParsedStatementLine) => number,
) {
  return lines
    .filter((line) => line.statementType === section)
    .map((line) => ({ line, score: scorer(compactText(line.baseDescription), line) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || right.line.confidence - left.line.confidence)[0]
    ?.line ?? null;
}

function selectHeadlineMetrics(lines: ParsedStatementLine[]) {
  const revenue = findBestLine(lines, "profit_and_loss", (description) => {
    if (description === "revenuefromoperations") return 100;
    if (/^(?:total)?revenue$/.test(description)) return 95;
    if (/^netsales|^salesrevenue|^operatingrevenue/.test(description)) return 90;
    if (/totalincome/.test(description)) return 65;
    if (/otherincome|financeincome/.test(description)) return -1;
    return /revenue|sales|turnover/.test(description) ? 45 : 0;
  });
  const expenses = findBestLine(lines, "profit_and_loss", (description) => {
    if (description === "totalexpenses") return 100;
    if (/^totaloperatingexpenses/.test(description)) return 92;
    return /total.*expense|expenses.*total/.test(description) ? 80 : 0;
  });
  const netIncome = findBestLine(lines, "profit_and_loss", (description) => {
    if (/profitfortheperiod|profitfortheyear|netprofitaftertax|netincomeforthe/.test(description)) {
      return 100;
    }
    if (/lossfortheperiod|lossfortheyear|netlossaftertax/.test(description)) return 98;
    if (/profitaftertax|netprofit|netincome/.test(description)) return 92;
    if (/beforetax|comprehensiveincome|earningspershare|attributable/.test(description)) return -1;
    return /^profit$|^loss$/.test(description) ? 70 : 0;
  });
  const assets = findBestLine(lines, "balance_sheet", (description) =>
    description === "totalassets" ? 100 : /total.*assets/.test(description) ? 85 : 0,
  );
  const equity = findBestLine(lines, "balance_sheet", (description) => {
    if (description === "totalequity") return 100;
    if (description === "equity") return 94;
    if (/totalequityattributable|shareholdersequity|ownersfunds/.test(description)) return 90;
    return 0;
  });
  const totalLiabilities = findBestLine(lines, "balance_sheet", (description) => {
    if (description === "totalliabilities") return 100;
    if (/equityandliabilities/.test(description)) return 0;
    return /^totalliabilities/.test(description) ? 90 : 0;
  });
  const currentLiabilities = findBestLine(lines, "balance_sheet", (description) =>
    description === "currentliabilities" || description === "totalcurrentliabilities"
      ? 100
      : 0,
  );
  const nonCurrentLiabilities = findBestLine(lines, "balance_sheet", (description) =>
    description === "noncurrentliabilities" ||
    description === "totalnoncurrentliabilities"
      ? 100
      : 0,
  );
  const cash =
    findBestLine(lines, "cash_flow", (description) => {
      if (/cashandcashequivalentsattheendofthe/.test(description)) return 100;
      if (/closingcashandcashequivalents|closingbalanceofcash/.test(description)) return 96;
      return 0;
    }) ??
    findBestLine(lines, "balance_sheet", (description) =>
      description === "cashandcashequivalents" ? 92 : /cashandcashequivalents/.test(description) ? 80 : 0,
    );

  const assetAmount = assets?.amount ?? null;
  const equityAmount = equity?.amount ?? null;
  const liabilitiesFromRows =
    currentLiabilities && nonCurrentLiabilities
      ? currentLiabilities.amount + nonCurrentLiabilities.amount
      : null;
  const liabilities =
    totalLiabilities?.amount ??
    liabilitiesFromRows ??
    (assetAmount !== null && equityAmount !== null ? assetAmount - equityAmount : null);

  return {
    revenue,
    expenses,
    netIncome,
    assets,
    equity,
    cash,
    liabilities,
    liabilitiesEvidence:
      totalLiabilities?.baseDescription ??
      (liabilitiesFromRows !== null
        ? "Current liabilities + non-current liabilities"
        : liabilities !== null
          ? "Derived as total assets - total equity"
          : null),
  };
}

function relativeDifference(left: number, right: number) {
  const denominator = Math.max(Math.abs(left), Math.abs(right), 1);
  return Math.abs(left - right) / denominator;
}

function buildChecks(params: {
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  revenue: number | null;
  expenses: number | null;
  netIncome: number | null;
}) {
  const checks: FinancialExtractionCheck[] = [];
  const { assets, liabilities, equity, revenue, expenses, netIncome } = params;

  if (assets !== null && liabilities !== null && equity !== null) {
    const difference = assets - (liabilities + equity);
    const passed = relativeDifference(assets, liabilities + equity) <= 0.015;
    checks.push({
      key: "balance_sheet_equation",
      passed,
      difference,
      message: passed
        ? "Assets reconcile with liabilities plus equity."
        : "Assets do not reconcile with liabilities plus equity within tolerance.",
    });
  }

  if (revenue !== null && expenses !== null && netIncome !== null) {
    const implied = revenue - expenses;
    const difference = implied - netIncome;
    const passed = relativeDifference(implied, netIncome) <= 0.35;
    checks.push({
      key: "profit_reasonableness",
      passed,
      difference,
      message: passed
        ? "Net result is directionally consistent with revenue and expenses."
        : "Net result differs materially from revenue minus expenses; taxes or non-operating lines may explain it.",
    });
  }

  return checks;
}

function dedupeLines(lines: ParsedStatementLine[]) {
  const seen = new Set<string>();
  const result: RawFinancialLineItem[] = [];

  for (const line of lines) {
    const key = [
      line.scope,
      line.statementType,
      line.pageNumber,
      line.rowIndex,
      compactText(line.baseDescription),
      Math.round(line.amount * 100) / 100,
      line.date ?? "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      description: line.description,
      amount: line.amount,
      category: line.category,
      date: line.date,
      displayedAmount: line.displayedAmount,
      displayedUnit: line.displayedUnit,
      currency: line.currency,
      statementType: line.statementType,
      scope: line.scope,
      pageNumber: line.pageNumber,
      sourcePage: line.sourcePage,
      sourceColumn: line.sourceColumn,
      sourceText: line.sourceText,
      sourceStatement: line.sourceStatement,
      extractionEngine: line.extractionEngine,
      confidence: line.confidence,
      isAggregate: line.isAggregate,
      section: line.section,
    });
  }

  return result;
}

export async function extractFinancialStatementFromPdf(
  buffer: Buffer,
  fileName: string,
): Promise<DeterministicFinancialStatementResult> {
  const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
  const pages: ParsedPage[] = [];
  let totalTextItems = 0;

  await pdfParseModule.default(buffer, {
    pagerender: async (pageData: PdfPageData) => {
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      });
      const rawItems = textContent.items ?? [];
      totalTextItems += rawItems.length;
      const rows = groupTextItems(rawItems);
      const text = rows.map(rowText).join("\n");
      const rawViewport = pageData.getViewport?.({ scale: 1 });
      const viewportWidth =
        typeof rawViewport?.width === "number" && Number.isFinite(rawViewport.width)
          ? rawViewport.width
          : 0;
      const viewportHeight =
        typeof rawViewport?.height === "number" && Number.isFinite(rawViewport.height)
          ? rawViewport.height
          : 0;
      const measuredWidth = rawItems.reduce((maximum, item) => {
        const x = item.transform?.[4] ?? 0;
        return Math.max(maximum, x + Math.max(0, item.width ?? 0));
      }, 0);
      const measuredHeight = rawItems.reduce(
        (maximum, item) => Math.max(maximum, item.transform?.[5] ?? 0),
        0,
      );
      const pageNumber = (pageData.pageIndex ?? pages.length) + 1;

      pages[pageNumber - 1] = {
        pageNumber,
        width: Math.max(viewportWidth, measuredWidth, 1),
        height: Math.max(viewportHeight, measuredHeight, 1),
        text,
        rows,
        classification: classifyPage(text),
      };
      return "";
    },
  });

  inheritContinuationClassifications(pages);

  const textLayerAvailable = totalTextItems >= Math.max(20, pages.length * 8);
  const likelyScanned = !textLayerAvailable || pages.every((page) => page.text.length < 120);
  const statementPages = pages.filter(
    (page) =>
      page.classification.section && page.classification.confidence >= 0.72,
  );

  if (statementPages.length === 0) {
    throw new Error(
      likelyScanned
        ? `No usable PDF text layer was found in ${fileName}; vision extraction is required.`
        : `No financial statement pages could be classified in ${fileName}.`,
    );
  }

  const scopeChoice = chooseScope(statementPages);
  const selectedPages = scopeChoice.pages.sort(
    (left, right) => left.pageNumber - right.pageNumber,
  );
  const sourceText = selectedPages.map((page) => page.text).join("\n\n");
  const unit = detectUnitAndCurrency(sourceText || pages.map((page) => page.text).join("\n"));
  const allPeriods = parsePeriodCandidates(sourceText);
  const periodEnd = allPeriods.at(-1) ?? null;
  const warnings: string[] = [];
  const selectedColumns = new Map<number, SelectedColumn>();
  const parsedLines: ParsedStatementLine[] = [];

  for (const page of selectedPages) {
    const selectedColumn = selectCurrentColumn(page);
    if (!selectedColumn) {
      warnings.push(`No numeric period column could be selected on page ${page.pageNumber}.`);
      continue;
    }
    selectedColumns.set(page.pageNumber, selectedColumn);
    if (selectedColumn.fallbackUsed) {
      warnings.push(
        `Page ${page.pageNumber} used a positional column fallback because no readable period header was found.`,
      );
    }

    parsedLines.push(
      ...extractPageLines({
        page,
        selectedColumn,
        scaleMultiplier: unit.scaleMultiplier,
        periodEnd: selectedColumn.period ?? periodEnd,
        currency: unit.currency,
        reportedUnit: unit.reportedUnit,
      }),
    );
  }

  const metrics = selectHeadlineMetrics(parsedLines);
  const revenue = metrics.revenue?.amount ?? null;
  const expenses = metrics.expenses?.amount ?? null;
  const netIncome = metrics.netIncome?.amount ?? null;
  const assets = metrics.assets?.amount ?? null;
  const equity = metrics.equity?.amount ?? null;
  const cash = metrics.cash?.amount ?? null;
  const liabilities = metrics.liabilities;
  const checks = buildChecks({
    assets,
    liabilities,
    equity,
    revenue,
    expenses,
    netIncome,
  });
  const failedChecks = checks.filter((check) => !check.passed);
  const detectedSections = [...scopeChoice.sections];
  const hasCoreStatements =
    scopeChoice.sections.has("profit_and_loss") &&
    scopeChoice.sections.has("balance_sheet");
  const coreMetricCount = [revenue, expenses, netIncome, assets, equity, cash].filter(
    (value) => value !== null,
  ).length;
  const averagePageConfidence =
    selectedPages.reduce(
      (sum, page) => sum + page.classification.confidence,
      0,
    ) / Math.max(selectedPages.length, 1);
  const averageColumnConfidence =
    [...selectedColumns.values()].reduce(
      (sum, column) => sum + column.selectionConfidence,
      0,
    ) / Math.max(selectedColumns.size, 1);
  const lineCountScore = clamp(parsedLines.length / 35);
  const checkScore = checks.length === 0 ? 0.55 : 1 - failedChecks.length / checks.length;
  const confidence = roundConfidence(
    (textLayerAvailable ? 0.1 : 0) +
      averagePageConfidence * 0.18 +
      averageColumnConfidence * 0.22 +
      (hasCoreStatements ? 0.14 : 0.04) +
      (coreMetricCount / 6) * 0.24 +
      lineCountScore * 0.07 +
      checkScore * 0.05,
  );
  const usable =
    parsedLines.length >= 5 &&
    coreMetricCount >= 3 &&
    assets !== null &&
    equity !== null;
  const requiresReview =
    confidence < 0.82 ||
    !usable ||
    failedChecks.some((check) => check.key === "balance_sheet_equation");

  if (!textLayerAvailable) warnings.push("The PDF has little or no selectable text.");
  if (!hasCoreStatements) warnings.push("A complete P&L and balance sheet pair was not detected.");
  if (coreMetricCount < 6) warnings.push("One or more headline metrics were not found by the layout engine.");
  for (const check of failedChecks) warnings.push(check.message);

  const diagnostics: FinancialExtractionDiagnostics = {
    engine: "pdf_layout",
    confidence,
    quality: confidence >= 0.9 ? "high" : confidence >= 0.72 ? "medium" : "low",
    requiresReview,
    textLayerAvailable,
    likelyScanned,
    selectedScope: scopeChoice.scope,
    statementPages: selectedPages.map((page) => page.pageNumber),
    detectedSections,
    lineItemCount: parsedLines.length,
    currentPeriod: periodEnd,
    warnings: [...new Set(warnings)],
    checks,
  };
  const finalLineItems = dedupeLines(parsedLines);
  const metricEvidence: Record<string, string> = {};

  const addEvidence = (key: string, line: ParsedStatementLine | null) => {
    if (!line) return;
    metricEvidence[key] = `${line.baseDescription}, page ${line.pageNumber}, ${line.sourceColumn ?? "selected current-period column"}`;
  };
  addEvidence("revenue", metrics.revenue);
  addEvidence("expenses", metrics.expenses);
  addEvidence("netIncome", metrics.netIncome);
  addEvidence("assets", metrics.assets);
  addEvidence("equity", metrics.equity);
  addEvidence("cash", metrics.cash);
  if (liabilities !== null && metrics.liabilitiesEvidence) {
    metricEvidence.liabilities = metrics.liabilitiesEvidence;
  }

  const scopeDisplay = scopeLabel(scopeChoice.scope);
  const data: ExtractedDocumentData = {
    summary: `${scopeDisplay} financial statements were read using dynamic PDF layout detection. ${finalLineItems.length} current-period numeric rows were captured from pages ${diagnostics.statementPages.join(", ") || "not identified"}.`,
    documentDate: periodEnd,
    periodStart:
      periodEnd?.slice(5) === "03-31"
        ? `${String(Number(periodEnd.slice(0, 4)) - 1)}-04-01`
        : null,
    periodEnd,
    currency: unit.currency,
    reportedUnit: unit.reportedUnit,
    scaleMultiplier: unit.scaleMultiplier,
    unitDetectionEvidence: unit.evidence,
    revenue,
    totalRevenue: revenue,
    expenses,
    totalExpenses: expenses,
    netIncome,
    profit: netIncome !== null && netIncome >= 0 ? netIncome : null,
    loss: netIncome !== null && netIncome < 0 ? Math.abs(netIncome) : null,
    cash,
    assets,
    liabilities,
    equity,
    lineItems: finalLineItems,
    transactions: [],
    extractionDiagnostics: diagnostics,
  };

  return {
    data,
    rawLineItems: finalLineItems,
    sourceText,
    metricEvidence,
    selectedScope: scopeChoice.scope,
    statementPages: diagnostics.statementPages,
    diagnostics,
    usable,
  };
}

export const __financialParserTestables = {
  classifyPage,
  parsePeriodCandidates,
  detectUnitAndCurrency,
  amountFromItem,
  groupTextItems,
  clusterNumericColumns,
  selectCurrentColumn,
  isValidLabel,
  isAggregateLabel,
  relativeDifference,
};
