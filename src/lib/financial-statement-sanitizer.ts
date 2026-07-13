import type { ExtractedDocumentData } from "./gemini";

type FinancialLineItem = NonNullable<ExtractedDocumentData["lineItems"]>[number];

const FINANCIAL_TERMS = [
  "revenue",
  "income",
  "sales",
  "turnover",
  "expense",
  "expenditure",
  "cost",
  "profit",
  "loss",
  "asset",
  "liabilit",
  "equity",
  "capital",
  "reserve",
  "cash",
  "bank balance",
  "receivable",
  "payable",
  "borrowing",
  "debt",
  "inventory",
  "property",
  "plant",
  "equipment",
  "investment",
  "loan",
  "provision",
  "tax",
  "depreciation",
  "amorti",
  "employee",
  "finance",
  "dividend",
  "operating",
  "investing",
  "financing",
  "materials",
  "purchase",
  "goodwill",
  "intangible",
  "lease",
  "insurance",
  "exchange difference",
  "working capital",
  "share",
  "earnings per share",
];

const METADATA_TERMS = [
  "phone",
  "telephone",
  "email",
  "website",
  "registered office",
  "corporate office",
  "scrip code",
  "nse symbol",
  "bse code",
  "din",
  "cin",
  "audit committee",
  "board meeting",
  "record date",
  "sebi circular",
  "regulation",
  "pursuant to",
  "independent auditor",
  "for and on behalf",
  "signature",
  "signed",
];

const HEADER_ONLY_PATTERNS = [
  /^particulars?$/i,
  /^notes?$/i,
  /^note no\.?$/i,
  /^current year$/i,
  /^previous year$/i,
  /^quarter ended$/i,
  /^financial year ended$/i,
  /^year ended$/i,
  /^audited$/i,
  /^unaudited$/i,
  /^un-audited$/i,
];

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function compact(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function isFiniteAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasTrustedSource(item: FinancialLineItem) {
  return (
    item.extractionEngine === "pdf_layout" &&
    typeof (item.sourcePage ?? item.pageNumber) === "number" &&
    Boolean(clean(item.statementType))
  );
}

function isMetadataDescription(description: string) {
  const lower = description.toLowerCase();
  return METADATA_TERMS.some((term) => lower.includes(term));
}

function isUsableDescription(description: string) {
  const value = clean(description);
  const normalized = compact(value);

  if (!value || normalized.length < 2 || !/[a-z]/i.test(value)) return false;
  if (isMetadataDescription(value)) return false;
  if (HEADER_ONLY_PATTERNS.some((pattern) => pattern.test(value))) return false;
  if (/^\d+$/.test(normalized)) return false;
  return true;
}

function isFinancialDescription(item: FinancialLineItem) {
  const description = clean(item.description);
  if (!isUsableDescription(description)) return false;
  if (hasTrustedSource(item)) return true;

  const searchable = `${item.category ?? ""} ${description}`.toLowerCase();
  return FINANCIAL_TERMS.some((term) => searchable.includes(term));
}

function normalizeCategory(item: FinancialLineItem) {
  const text = compact(`${item.category ?? ""} ${item.description}`);

  if (/revenue|sales|turnover|incomefromoperation/.test(text)) return "Revenue";
  if (/otherincome|interestincome|totalincome/.test(text)) return "Income";
  if (/expense|expenditure|cost|purchase|depreciation|amorti|employeebenefit|materials/.test(text)) {
    return "Expense";
  }
  if (/profit|loss|comprehensiveincome|earningspershare/.test(text)) {
    return "Profit / Loss";
  }
  if (/cash|bankbalance/.test(text)) return "Cash";
  if (/asset|property|plant|equipment|inventory|receivable|investment|goodwill|intangible/.test(text)) {
    return "Asset";
  }
  if (/liabilit|payable|borrowing|debt|provision|lease/.test(text)) {
    return "Liability";
  }
  if (/equity|sharecapital|reserve|networth/.test(text)) return "Equity";
  if (/tax|gst|tds/.test(text)) return "Tax";
  if (/operatingactivit|investingactivit|financingactivit|cashflow/.test(text)) {
    return "Cash Flow";
  }
  if (/interest|financecost/.test(text)) return "Finance Cost";

  return item.category ?? "Other";
}

export function sanitizeFinancialStatementLineItems(
  items: ExtractedDocumentData["lineItems"],
): FinancialLineItem[] {
  if (!Array.isArray(items)) return [];

  const seen = new Set<string>();
  const result: FinancialLineItem[] = [];

  for (const item of items) {
    if (!item || !isFiniteAmount(item.amount) || !isFinancialDescription(item)) {
      continue;
    }

    const description = clean(item.description);
    const sourcePage = item.sourcePage ?? item.pageNumber ?? null;
    const key = [
      compact(description),
      Math.round(item.amount * 100) / 100,
      item.date ?? "",
      item.statementType ?? "",
      sourcePage ?? "",
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      ...item,
      description,
      category: normalizeCategory(item),
      sourcePage,
      pageNumber: item.pageNumber ?? sourcePage,
      confidence:
        typeof item.confidence === "number" && Number.isFinite(item.confidence)
          ? Math.max(0, Math.min(1, item.confidence))
          : null,
    });
  }

  return result;
}

export function sanitizeFinancialStatementExtraction(
  data: ExtractedDocumentData,
): ExtractedDocumentData {
  return {
    ...data,
    lineItems: sanitizeFinancialStatementLineItems(data.lineItems),
  };
}
