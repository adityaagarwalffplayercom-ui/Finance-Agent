import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const prisma = new PrismaClient();

function cleanSpaces(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanDescription(value) {
  return cleanSpaces(
    String(value ?? "")
      .replace(/[₹$£€]/g, "")
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

function normalizeDate(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value.trim();
  }

  return parsed.toISOString().slice(0, 10);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value) {
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
    .replace(/[₹$£€]/g, "")
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

function isProbablyYear(value) {
  const cleaned = String(value ?? "").replace(/[^0-9]/g, "");

  if (!/^\d{4}$/.test(cleaned)) {
    return false;
  }

  const year = Number(cleaned);

  return year >= 1900 && year <= 2099;
}

function detectScaleMultiplier(text) {
  const lower = text.toLowerCase().slice(0, 120_000);

  if (
    lower.includes("in crores") ||
    lower.includes("in crore") ||
    lower.includes("rs. in crores") ||
    lower.includes("₹ in crores") ||
    lower.includes("rupees in crores")
  ) {
    return 10_000_000;
  }

  if (
    lower.includes("in lakhs") ||
    lower.includes("in lakh") ||
    lower.includes("rs. in lakhs") ||
    lower.includes("₹ in lakhs") ||
    lower.includes("rupees in lakhs")
  ) {
    return 100_000;
  }

  if (
    lower.includes("in millions") ||
    lower.includes("in million") ||
    lower.includes("₹ million") ||
    lower.includes("inr million") ||
    lower.includes("amounts are in million") ||
    lower.includes("amounts in million")
  ) {
    return 1_000_000;
  }

  if (
    lower.includes("in billions") ||
    lower.includes("in billion") ||
    lower.includes("₹ billion") ||
    lower.includes("inr billion")
  ) {
    return 1_000_000_000;
  }

  if (
    lower.includes("in thousands") ||
    lower.includes("in thousand") ||
    lower.includes("rs. in thousands") ||
    lower.includes("₹ in thousands") ||
    lower.includes("rupees in thousands")
  ) {
    return 1_000;
  }

  return 1;
}

function inferCategory(description, fallback) {
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

  return fallback || "Other";
}

function numberTokenRegex() {
  return /(?:₹|Rs\.?|INR|USD|US\$|GBP|EUR|£|\$)?\s*\(?-?\d{1,3}(?:,\d{2,3})+(?:\.\d+)?\)?|(?:₹|Rs\.?|INR|USD|US\$|GBP|EUR|£|\$)\s*\(?-?\d+(?:\.\d+)?\)?|\(\s*-?\d+(?:,\d{2,3})*(?:\.\d+)?\s*\)|-?\d+\.\d{1,4}|\b-?\d{2,}\b/g;
}

function getAmountMatches(line) {
  const matches = [];
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

function shouldSkipLine(line) {
  const clean = cleanSpaces(line);

  if (clean.length < 4) {
    return true;
  }

  if (!/[a-zA-Z]/.test(clean)) {
    return true;
  }

  const lower = clean.toLowerCase();

  return (
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
  );
}

function isLikelyTableFinancialLine(description) {
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

  return usefulWords.some((word) => text.includes(word));
}

function dedupeLineItems(items) {
  const seen = new Set();
  const deduped = [];

  for (const item of items) {
    const description = cleanDescription(item.description);

    if (!description || description.length < 2) {
      continue;
    }

    const key = [
      description.toLowerCase(),
      String(item.category ?? "").toLowerCase(),
      Math.round(item.amount * 100) / 100,
      item.date ?? "",
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    deduped.push({
      description,
      amount: item.amount,
      category: item.category ?? "Other",
      date: item.date ?? null,
    });
  }

  return deduped;
}

function extractLineItemsFromText(text, options = {}) {
  if (!text.trim()) {
    return [];
  }

  const multiplier =
    typeof options.scaleMultiplier === "number" && options.scaleMultiplier > 0
      ? options.scaleMultiplier
      : detectScaleMultiplier(text);

  const date = normalizeDate(options.documentDate);
  const lines = text.split(/\r?\n/g);
  const items = [];

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

      const description =
        matches.length > 1
          ? `${baseDescription} (value ${index + 1})`
          : baseDescription;

      items.push({
        description,
        amount: parsedAmount * multiplier,
        category: inferCategory(description, options.defaultCategory),
        date,
      });
    }
  }

  return dedupeLineItems(items);
}

function normalizeExistingLineItems(data) {
  if (!isRecord(data) || !Array.isArray(data.lineItems)) {
    return [];
  }

  return data.lineItems
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const amount = toNumber(item.amount);

      if (amount === null || amount === 0) {
        return null;
      }

      const description = cleanDescription(item.description || "Line item");

      return {
        description,
        amount,
        category: item.category ?? inferCategory(description, "Other"),
        date: normalizeDate(item.date),
      };
    })
    .filter(Boolean);
}

function mergeLineItems(existingData, rawLineItems) {
  const existing = normalizeExistingLineItems(existingData);
  return dedupeLineItems([...existing, ...rawLineItems]);
}

async function extractTextFromDocument(document) {
  const buffer = Buffer.from(document.content);

  if (document.mimeType === "application/pdf") {
    const result = await pdfParse(buffer);
    return result.text ?? "";
  }

  if (document.mimeType === "text/csv" || document.mimeType.startsWith("text/")) {
    return buffer.toString("utf-8");
  }

  if (
    document.mimeType === "application/vnd.ms-excel" ||
    document.mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    const workbook = XLSX.read(buffer, {
      type: "buffer",
    });

    return workbook.SheetNames.map(
      (name) =>
        `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`,
    ).join("\n\n");
  }

  return "";
}

async function main() {
  const documents = await prisma.document.findMany({
    where: {
      status: "PROCESSED",
    },
    orderBy: {
      uploadedAt: "desc",
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      category: true,
      content: true,
      extractedData: true,
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const document of documents) {
    const existingData = isRecord(document.extractedData)
      ? document.extractedData
      : {};

    const existingCount = Array.isArray(existingData.lineItems)
      ? existingData.lineItems.length
      : 0;

    let text = "";

    try {
      text = await extractTextFromDocument(document);
    } catch (error) {
      console.log(`Could not read ${document.fileName}:`, error.message);
      skipped += 1;
      continue;
    }

    if (!text.trim()) {
      console.log(`No readable text in ${document.fileName}`);
      skipped += 1;
      continue;
    }

    const rawItems = extractLineItemsFromText(text, {
      documentDate:
        existingData.documentDate || existingData.periodEnd || existingData.periodStart,
      scaleMultiplier: existingData.scaleMultiplier,
      defaultCategory: document.category,
    });

    const merged = mergeLineItems(existingData, rawItems);

    console.log(
      `${document.fileName}: text=${text.length} chars, existing=${existingCount}, raw=${rawItems.length}, merged=${merged.length}`,
    );

    if (merged.length <= existingCount) {
      skipped += 1;
      continue;
    }

    await prisma.document.update({
      where: {
        id: document.id,
      },
      data: {
        extractedData: {
          ...existingData,
          lineItems: merged,
        },
      },
    });

    updated += 1;
  }

  console.log("");
  console.log(`Done. Updated: ${updated}, skipped: ${skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
