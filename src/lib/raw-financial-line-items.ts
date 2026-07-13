import * as XLSX from "xlsx";
import type { ExtractedDocumentData } from "./gemini";

export type RawFinancialLineItem = {
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
};

type ExtractOptions = {
  documentDate?: string | null;
  scaleMultiplier?: number | null;
  defaultCategory?: string | null;
};

function cleanSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanDescription(value: string) {
  return cleanSpaces(
    value
      .replace(/[Rs. $£€]/g, "")
      .replace(/\bINR\b/gi, "")
      .replace(/\bUSD\b/gi, "")
      .replace(/\bGBP\b/gi, "")
      .replace(/\bEUR\b/gi, "")
      .replace(/\bRs\.?\b/gi, "")
      .replace(/\bNo\.?\b$/gi, "")
      .replace(/\bAmount\b$/gi, "")
      .replace(/\bCurrent Year\b/gi, "")
      .replace(/\bPrevious Year\b/gi, "")
      .replace(/\bAs at\b/gi, "")
      .replace(/[:|]+$/g, "")
      .replace(/^[.\-–—:|]+/g, "")
      .trim(),
  );
}

function normalizeDate(value?: string | null) {
  if (!value || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value.trim();
  }

  return parsed.toISOString().slice(0, 10);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  let text = value.trim();

  if (!text) {
    return null;
  }

  const isNegativeByBracket = /^\(.*\)$/.test(text);

  text = text
    .replace(/[Rs. $£€]/g, "")
    .replace(/\bINR\b/gi, "")
    .replace(/\bUSD\b/gi, "")
    .replace(/\bGBP\b/gi, "")
    .replace(/\bEUR\b/gi, "")
    .replace(/\bRs\.?\b/gi, "")
    .replace(/[(),]/g, "")
    .trim();

  if (!text || text === "-" || text === "." || text === "–" || text === "—") {
    return null;
  }

  const parsed = Number(text);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return isNegativeByBracket ? -Math.abs(parsed) : parsed;
}

function isProbablyYear(value: string) {
  const cleaned = value.replace(/[^0-9]/g, "");

  if (!/^\d{4}$/.test(cleaned)) {
    return false;
  }

  const year = Number(cleaned);

  return year >= 1900 && year <= 2099;
}

function detectScaleMultiplier(text: string) {
  const lower = text.toLowerCase().slice(0, 120_000);

  if (
    lower.includes("in crores") ||
    lower.includes("in crore") ||
    lower.includes("rs. in crores") ||
    lower.includes("Rs.  in crores") ||
    lower.includes("rupees in crores")
  ) {
    return 10_000_000;
  }

  if (
    lower.includes("in lakhs") ||
    lower.includes("in lakh") ||
    lower.includes("rs. in lakhs") ||
    lower.includes("Rs.  in lakhs") ||
    lower.includes("rupees in lakhs")
  ) {
    return 100_000;
  }

  if (
    lower.includes("in millions") ||
    lower.includes("in million") ||
    lower.includes("Rs.  million") ||
    lower.includes("inr million") ||
    lower.includes("amounts are in million") ||
    lower.includes("amounts in million")
  ) {
    return 1_000_000;
  }

  if (
    lower.includes("in billions") ||
    lower.includes("in billion") ||
    lower.includes("Rs.  billion") ||
    lower.includes("inr billion")
  ) {
    return 1_000_000_000;
  }

  if (
    lower.includes("in thousands") ||
    lower.includes("in thousand") ||
    lower.includes("rs. in thousands") ||
    lower.includes("Rs.  in thousands") ||
    lower.includes("rupees in thousands")
  ) {
    return 1_000;
  }

  return 1;
}

function inferCategory(description: string, fallback?: string | null) {
  const text = description.toLowerCase();

  if (
    text.includes("revenue") ||
    text.includes("sales") ||
    text.includes("turnover") ||
    text.includes("income from operations") ||
    text.includes("other income") ||
    text.includes("sale of products") ||
    text.includes("sale of services")
  ) {
    return "Revenue";
  }

  if (
    text.includes("expense") ||
    text.includes("expenses") ||
    text.includes("cost") ||
    text.includes("purchase") ||
    text.includes("salary") ||
    text.includes("salaries") ||
    text.includes("employee benefit") ||
    text.includes("rent") ||
    text.includes("depreciation") ||
    text.includes("amortisation") ||
    text.includes("amortization") ||
    text.includes("finance cost") ||
    text.includes("tax expense") ||
    text.includes("other expenses") ||
    text.includes("raw materials") ||
    text.includes("consumption") ||
    text.includes("power and fuel")
  ) {
    return "Expense";
  }

  if (
    text.includes("asset") ||
    text.includes("assets") ||
    text.includes("property") ||
    text.includes("plant") ||
    text.includes("equipment") ||
    text.includes("inventory") ||
    text.includes("inventories") ||
    text.includes("receivable") ||
    text.includes("cash and cash") ||
    text.includes("bank balance") ||
    text.includes("investments") ||
    text.includes("loans")
  ) {
    return "Asset";
  }

  if (
    text.includes("liabilit") ||
    text.includes("payable") ||
    text.includes("borrowings") ||
    text.includes("debt") ||
    text.includes("provision") ||
    text.includes("lease liabilities")
  ) {
    return "Liability";
  }

  if (
    text.includes("equity") ||
    text.includes("share capital") ||
    text.includes("reserves") ||
    text.includes("net worth") ||
    text.includes("other equity")
  ) {
    return "Equity";
  }

  if (
    text.includes("cash flow") ||
    text.includes("operating activities") ||
    text.includes("investing activities") ||
    text.includes("financing activities")
  ) {
    return "Cash Flow";
  }

  if (text.includes("tax") || text.includes("gst") || text.includes("tds")) {
    return "Tax";
  }

  if (fallback && fallback.trim()) {
    return fallback.trim();
  }

  return "Other";
}

function numberTokenRegex() {
  return /(?:Rs. |Rs\.?|INR|USD|US\$|GBP|EUR|£|\$)?\s*\(?-?\d{1,3}(?:,\d{2,3})+(?:\.\d+)?\)?|(?:Rs. |Rs\.?|INR|USD|US\$|GBP|EUR|£|\$)\s*\(?-?\d+(?:\.\d+)?\)?|\(\s*-?\d+(?:,\d{2,3})*(?:\.\d+)?\s*\)|-?\d+\.\d{1,4}|\b-?\d{2,}\b/g;
}

function getAmountMatches(line: string) {
  const matches: { value: string; index: number }[] = [];
  const regex = numberTokenRegex();

  let match = regex.exec(line);

  while (match) {
    const value = match[0];
    const nextChar = line[match.index + value.length];

    if (nextChar !== "%") {
      matches.push({
        value,
        index: match.index,
      });
    }

    match = regex.exec(line);
  }

  return matches;
}

function shouldSkipLine(line: string) {
  const clean = cleanSpaces(line);

  if (clean.length < 4) {
    return true;
  }

  if (!/[a-zA-Z]/.test(clean)) {
    return true;
  }

  const lower = clean.toLowerCase();

  if (
    lower.includes("page ") ||
    lower.includes("www.") ||
    lower.includes("http") ||
    lower.includes("registered office") ||
    lower.includes("corporate office") ||
    lower.includes("cin:") ||
    lower.includes("email:") ||
    lower.includes("telephone") ||
    lower.includes("board of directors") ||
    lower.includes("independent auditor") ||
    lower.includes("annual report") ||
    lower.includes("contents")
  ) {
    return true;
  }

  return false;
}

function isLikelyTableFinancialLine(description: string) {
  const text = description.toLowerCase();

  if (description.length < 2) {
    return false;
  }

  const usefulWords = [
    "revenue",
    "income",
    "sales",
    "expense",
    "expenses",
    "cost",
    "profit",
    "loss",
    "asset",
    "assets",
    "liability",
    "liabilities",
    "equity",
    "capital",
    "reserve",
    "cash",
    "inventory",
    "inventories",
    "receivable",
    "payable",
    "borrowings",
    "tax",
    "depreciation",
    "amortisation",
    "amortization",
    "employee",
    "benefit",
    "finance",
    "other",
    "total",
    "current",
    "non-current",
    "property",
    "plant",
    "equipment",
    "investment",
    "loan",
    "provision",
    "operating",
    "investing",
    "financing",
    "materials",
    "consumption",
    "power",
    "fuel",
  ];

  if (usefulWords.some((word) => text.includes(word))) {
    return true;
  }

  return /^[A-Z][A-Za-z\s,&()/-]{3,}$/.test(description);
}

function dedupeLineItems(items: RawFinancialLineItem[]) {
  const seen = new Set<string>();
  const deduped: RawFinancialLineItem[] = [];

  for (const item of items) {
    const description = cleanDescription(item.description);

    if (!description || description.length < 2) {
      continue;
    }

    const key = [
      description.toLowerCase(),
      item.category?.toLowerCase() ?? "",
      Math.round(item.amount * 100) / 100,
      item.date ?? "",
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    deduped.push({
      ...item,
      description,
      amount: item.amount,
      category: item.category ?? "Other",
      date: item.date ?? null,
    });
  }

  return deduped;
}

export function extractLineItemsFromText(
  text: string,
  options: ExtractOptions = {},
): RawFinancialLineItem[] {
  if (!text.trim()) {
    return [];
  }

  const multiplier =
    typeof options.scaleMultiplier === "number" && options.scaleMultiplier > 0
      ? options.scaleMultiplier
      : detectScaleMultiplier(text);

  const date = normalizeDate(options.documentDate);
  const lines = text.split(/\r?\n/g);
  const items: RawFinancialLineItem[] = [];

  for (const rawLine of lines) {
    const line = cleanSpaces(rawLine);

    if (shouldSkipLine(line)) {
      continue;
    }

    const matches = getAmountMatches(line);

    if (matches.length === 0) {
      continue;
    }

    const firstAmountIndex = matches[0].index;
    const baseDescription = cleanDescription(line.slice(0, firstAmountIndex));

    if (!isLikelyTableFinancialLine(baseDescription)) {
      continue;
    }

    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];

      if (isProbablyYear(match.value)) {
        continue;
      }

      const parsedAmount = toNumber(match.value);

      if (parsedAmount === null || parsedAmount === 0) {
        continue;
      }

      const amount = parsedAmount * multiplier;

      const description =
        matches.length > 1
          ? `${baseDescription} (value ${index + 1})`
          : baseDescription;

      items.push({
        description,
        amount,
        category: inferCategory(description, options.defaultCategory),
        date,
      });
    }
  }

  return dedupeLineItems(items);
}

function cellToString(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return cleanSpaces(String(value));
}

function findHeaderForColumn(
  rows: unknown[][],
  rowIndex: number,
  columnIndex: number,
) {
  for (let index = rowIndex - 1; index >= Math.max(0, rowIndex - 6); index -= 1) {
    const row = rows[index];
    const value = cellToString(row?.[columnIndex]);

    if (value && /[a-zA-Z]/.test(value) && value.length <= 50) {
      return value;
    }
  }

  return "";
}

export function extractLineItemsFromWorkbook(
  workbook: XLSX.WorkBook,
  options: ExtractOptions = {},
): RawFinancialLineItem[] {
  const items: RawFinancialLineItem[] = [];
  const date = normalizeDate(options.documentDate);
  const multiplier =
    typeof options.scaleMultiplier === "number" && options.scaleMultiplier > 0
      ? options.scaleMultiplier
      : 1;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: true,
    });

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];

      if (!Array.isArray(row)) {
        continue;
      }

      let label = "";

      for (const cell of row) {
        const value = cellToString(cell);

        if (value && /[a-zA-Z]/.test(value)) {
          label = cleanDescription(value);
          break;
        }
      }

      if (!isLikelyTableFinancialLine(label)) {
        continue;
      }

      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        const rawCell = row[columnIndex];
        const amount = toNumber(rawCell);

        if (amount === null || amount === 0) {
          continue;
        }

        const cellText = cellToString(rawCell);

        if (isProbablyYear(cellText)) {
          continue;
        }

        const header = findHeaderForColumn(rows, rowIndex, columnIndex);
        const description = cleanDescription(
          `${sheetName} · ${label}${header ? ` · ${header}` : ""}`,
        );

        items.push({
          description,
          amount: amount * multiplier,
          category: inferCategory(label, options.defaultCategory),
          date,
        });
      }
    }
  }

  return dedupeLineItems(items);
}

function normalizeExistingLineItems(data: ExtractedDocumentData) {
  if (!Array.isArray(data.lineItems)) {
    return [];
  }

  return data.lineItems
    .map((item) => {
      const amount = toNumber(item.amount);

      if (amount === null || amount === 0) {
        return null;
      }

      const description = cleanDescription(item.description || "Line item");

      if (!description || description.length < 2) {
        return null;
      }

      return {
        ...item,
        description,
        amount,
        category: item.category ?? inferCategory(description, "Other"),
        date: normalizeDate(item.date),
      };
    })
    .filter(Boolean) as RawFinancialLineItem[];
}

export function mergeExtractedLineItems(
  extracted: ExtractedDocumentData,
  rawLineItems: RawFinancialLineItem[],
): ExtractedDocumentData {
  const existing = normalizeExistingLineItems(extracted);
  const merged = dedupeLineItems([...existing, ...rawLineItems]);

  return {
    ...extracted,
    lineItems: merged,
    transactions: Array.isArray(extracted.transactions)
      ? extracted.transactions
      : [],
  };
}
