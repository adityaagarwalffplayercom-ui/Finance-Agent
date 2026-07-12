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
  "bankbalance",
  "receivable",
  "payable",
  "borrowing",
  "debt",
  "inventory",
  "inventor",
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
  "financecost",
  "dividend",
  "operatingactivit",
  "investingactivit",
  "financingactivit",
  "comprehensiveincome",
  "earningspershare",
];

const METADATA_TERMS = [
  "phone",
  "telephone",
  "email",
  "website",
  "registeredoffice",
  "corporateoffice",
  "gurugram",
  "gurgaon",
  "mumbai",
  "newdelhi",
  "sandraeast",
  "plot",
  "sector",
  "scripcode",
  "bsescrip",
  "nsesymbol",
  "bse500",
  "din",
  "cin",
  "llpidentity",
  "limitedliabilitypartnership",
  "auditcommittee",
  "boardmeeting",
  "recorddate",
  "agmandrecorddate",
  "sebibircular",
  "seb icircular",
  "regulation",
  "pursuantto",
  "independentauditor",
  "datevalue",
  "marchvalue",
  "aprilvalue",
  "sectionvalue",
  "comparisionwithreference",
  "businesscomment",
  "keyhighlights",
];

const HEADING_ONLY_TERMS = [
  "standalonefinancialresultsforthequarter",
  "consolidatedfinancialresultsforthequarter",
  "statementofunauditedfinancialresults",
  "standalonebalancesheetasat",
  "consolidatedbalancesheetasat",
  "standalonestatementofcashflow",
  "consolidatedstatementofcashflow",
  "financialyearended",
  "quarterended",
];

function compact(value: unknown) {
  return typeof value === "string"
    ? value
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]/g, "")
    : "";
}

function isFiniteAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value !== 0;
}

function isFinancialDescription(description: string) {
  const value = compact(description);

  if (!value || value.length < 5) {
    return false;
  }

  if (METADATA_TERMS.some((term) => value.includes(compact(term)))) {
    return false;
  }

  if (
    HEADING_ONLY_TERMS.some((term) => value.includes(compact(term))) &&
    !/total|revenue|income|expense|profit|loss|asset|liabilit|equity|cash/.test(value)
  ) {
    return false;
  }

  return FINANCIAL_TERMS.some((term) => value.includes(compact(term)));
}

function normalizeCategory(item: FinancialLineItem) {
  const text = compact(`${item.category ?? ""} ${item.description}`);

  if (/revenue|sales|turnover|incomefromoperation/.test(text)) return "Revenue";
  if (/expense|expenditure|cost|depreciation|amorti|employeebenefit/.test(text)) {
    return "Expense";
  }
  if (/profit|loss|comprehensiveincome/.test(text)) return "Profit / Loss";
  if (/cash|bankbalance/.test(text)) return "Cash";
  if (/asset|property|plant|equipment|inventory|receivable|investment/.test(text)) {
    return "Asset";
  }
  if (/liabilit|payable|borrowing|debt|provision/.test(text)) return "Liability";
  if (/equity|sharecapital|reserve|networth/.test(text)) return "Equity";
  if (/tax/.test(text)) return "Tax";

  return item.category ?? "Other";
}

/**
 * Annual-report PDFs contain phone numbers, dates, stock codes, addresses and
 * note references beside financial tables. This firewall keeps only rows whose
 * labels are financially meaningful before they can reach review, ledger or AI.
 */
export function sanitizeFinancialStatementLineItems(
  items: ExtractedDocumentData["lineItems"],
): FinancialLineItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const seen = new Set<string>();
  const result: FinancialLineItem[] = [];

  for (const item of items) {
    if (!item || !isFiniteAmount(item.amount) || !isFinancialDescription(item.description)) {
      continue;
    }

    const description = item.description.replace(/\s+/g, " ").trim();
    const key = `${compact(description)}|${Math.round(item.amount * 100) / 100}|${item.date ?? ""}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({
      ...item,
      description,
      category: normalizeCategory(item),
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
