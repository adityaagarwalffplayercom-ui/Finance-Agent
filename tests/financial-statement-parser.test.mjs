import assert from "node:assert/strict";
import { test } from "node:test";
import { jsPDF } from "jspdf";
import {
  __financialParserTestables,
  extractFinancialStatementFromPdf,
} from "../src/lib/financial-statement-table-parser.ts";
import { sanitizeFinancialStatementLineItems } from "../src/lib/financial-statement-sanitizer.ts";
import { mergeExtractedLineItems } from "../src/lib/raw-financial-line-items.ts";

const {
  classifyPage,
  parsePeriodCandidates,
  detectUnitAndCurrency,
  isValidLabel,
  isAggregateLabel,
} = __financialParserTestables;

function toBuffer(doc) {
  return Buffer.from(doc.output("arraybuffer"));
}

function addTwoColumnStatement(doc, options) {
  const { title, rows, currentHeader = "31 March 2026", priorHeader = "31 March 2025" } = options;
  doc.setFontSize(13);
  doc.text(title, 40, 42);
  doc.setFontSize(9);
  doc.text(options.unitText ?? "Amounts in INR millions", 40, 58);
  doc.text(currentHeader, 360, 72);
  doc.text(priorHeader, 470, 72);

  let y = 94;
  for (const row of rows) {
    doc.text(row[0], 50, y);
    doc.text(String(row[1]), 360, y, { align: "right" });
    doc.text(String(row[2]), 470, y, { align: "right" });
    y += 18;
  }
}

function makeCoreStatementPdf() {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  addTwoColumnStatement(doc, {
    title: "Consolidated Statement of Profit and Loss for the year ended 31 March 2026",
    rows: [
      ["Revenue from operations", "1,000.0", "900.0"],
      ["Total expenses", "700.0", "650.0"],
      ["Profit for the year", "300.0", "250.0"],
    ],
  });

  doc.addPage();
  addTwoColumnStatement(doc, {
    title: "Consolidated Balance Sheet as at 31 March 2026",
    rows: [
      ["Cash and cash equivalents", "100.0", "80.0"],
      ["Total assets", "2,000.0", "1,800.0"],
      ["Total equity", "800.0", "700.0"],
      ["Current liabilities", "700.0", "650.0"],
      ["Non-current liabilities", "500.0", "450.0"],
    ],
  });

  doc.addPage();
  addTwoColumnStatement(doc, {
    title: "Consolidated Statement of Cash Flows for the year ended 31 March 2026",
    rows: [
      ["Net cash from operating activities", "150.0", "140.0"],
      ["Net cash used in investing activities", "(50.0)", "(40.0)"],
      ["Net cash used in financing activities", "(25.0)", "(20.0)"],
      ["Cash and cash equivalents at the end of the year", "100.0", "80.0"],
    ],
  });

  return toBuffer(doc);
}

function makeQuarterAndAnnualPdf() {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  doc.setFontSize(13);
  doc.text("Standalone Financial Results", 40, 40);
  doc.setFontSize(8);
  doc.text("Amounts in INR crores", 40, 55);
  doc.text("Quarter ended", 220, 70);
  doc.text("Year ended", 520, 70);
  const headers = ["31 March 2026", "31 Dec 2025", "31 March 2025", "31 March 2026", "31 March 2025"];
  const xs = [200, 300, 400, 520, 640];
  headers.forEach((header, index) => doc.text(header, xs[index], 86, { align: "right" }));
  const rows = [
    ["Revenue from operations", [250, 230, 220, 1000, 900]],
    ["Total expenses", [180, 170, 165, 700, 650]],
    ["Profit for the year", [70, 60, 55, 300, 250]],
  ];
  let y = 112;
  for (const [label, values] of rows) {
    doc.text(label, 40, y);
    values.forEach((value, index) => doc.text(String(value), xs[index], y, { align: "right" }));
    y += 18;
  }

  doc.addPage();
  addTwoColumnStatement(doc, {
    title: "Standalone Statement of Financial Position as at 31 March 2026",
    unitText: "Amounts in INR crores",
    currentHeader: "31 March 2026",
    priorHeader: "31 March 2025",
    rows: [
      ["Cash and cash equivalents", "100", "80"],
      ["Total assets", "2,000", "1,800"],
      ["Total equity", "800", "700"],
      ["Current liabilities", "700", "650"],
      ["Non-current liabilities", "500", "450"],
    ],
  });

  return toBuffer(doc);
}


function makeContinuedCashFlowPdf() {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  addTwoColumnStatement(doc, {
    title: "Consolidated Statement of Profit and Loss for the year ended 31 March 2026",
    rows: [
      ["Revenue from operations", "1,000.0", "900.0"],
      ["Total expenses", "700.0", "650.0"],
      ["Profit for the year", "300.0", "250.0"],
    ],
  });

  doc.addPage();
  addTwoColumnStatement(doc, {
    title: "Consolidated Balance Sheet as at 31 March 2026",
    rows: [
      ["Cash and cash equivalents", "100.0", "80.0"],
      ["Total assets", "2,000.0", "1,800.0"],
      ["Total equity", "800.0", "700.0"],
      ["Current liabilities", "700.0", "650.0"],
      ["Non-current liabilities", "500.0", "450.0"],
    ],
  });

  doc.addPage();
  addTwoColumnStatement(doc, {
    title: "Consolidated Statement of Cash Flows for the year ended 31 March 2026",
    rows: [
      ["Net cash from operating activities", "150.0", "140.0"],
      ["Net cash used in investing activities", "(50.0)", "(40.0)"],
    ],
  });

  doc.addPage();
  doc.setFontSize(10);
  doc.text("Cash flows from financing activities (continued)", 50, 52);
  const continuationRows = [
    ["Dividends paid", "(25.0)", "(20.0)"],
    ["Cash and cash equivalents at the end of the year", "100.0", "80.0"],
  ];
  let y = 90;
  for (const row of continuationRows) {
    doc.text(row[0], 50, y);
    doc.text(row[1], 360, y, { align: "right" });
    doc.text(row[2], 470, y, { align: "right" });
    y += 18;
  }

  return toBuffer(doc);
}

test("classifies common international statement headings", () => {
  assert.equal(
    classifyPage("Consolidated Statement of Financial Position\nTotal assets\nTotal equity").section,
    "balance_sheet",
  );
  assert.equal(
    classifyPage("Income Statement\nRevenue\nProfit for the year").section,
    "profit_and_loss",
  );
  assert.equal(
    classifyPage("Statement of Cash Flows\nCash flows from operating activities").section,
    "cash_flow",
  );
});

test("normalizes multiple period and unit formats", () => {
  assert.deepEqual(parsePeriodCandidates("Year ended 31 March 2026"), ["2026-03-31"]);
  assert.deepEqual(parsePeriodCandidates("As at 31/03/2026"), ["2026-03-31"]);
  assert.deepEqual(parsePeriodCandidates("FY 2025-26"), ["2026-03-31"]);
  assert.equal(detectUnitAndCurrency("Amounts in INR crores").scaleMultiplier, 10_000_000);
  assert.equal(detectUnitAndCurrency("USD in thousands").currency, "USD");
});

test("keeps valid financial labels and rejects metadata", () => {
  assert.equal(isValidLabel("Trade receivables"), true);
  assert.equal(isValidLabel("Registered office: Mumbai"), false);
  assert.equal(isAggregateLabel("Total assets"), true);
  assert.equal(isAggregateLabel("Employee benefits expense"), false);
});

test("extracts a dynamically positioned consolidated statement", async () => {
  const result = await extractFinancialStatementFromPdf(makeCoreStatementPdf(), "synthetic-core.pdf");
  assert.equal(result.data.revenue, 1_000_000_000);
  assert.equal(result.data.expenses, 700_000_000);
  assert.equal(result.data.netIncome, 300_000_000);
  assert.equal(result.data.assets, 2_000_000_000);
  assert.equal(result.data.liabilities, 1_200_000_000);
  assert.equal(result.data.equity, 800_000_000);
  assert.equal(result.data.cash, 100_000_000);
  assert.equal(result.diagnostics.selectedScope, "consolidated");
  assert.equal(result.diagnostics.checks.find((check) => check.key === "balance_sheet_equation")?.passed, true);
});

test("selects the annual current-period column instead of the current quarter", async () => {
  const result = await extractFinancialStatementFromPdf(makeQuarterAndAnnualPdf(), "synthetic-quarterly.pdf");
  assert.equal(result.data.revenue, 10_000_000_000);
  assert.equal(result.data.expenses, 7_000_000_000);
  assert.equal(result.data.netIncome, 3_000_000_000);
  assert.equal(result.diagnostics.selectedScope, "standalone");
});


test("keeps trusted layout rows without relying on a financial keyword whitelist", () => {
  const rows = sanitizeFinancialStatementLineItems([
    {
      description: "Amount received under a government incentive scheme",
      amount: 42_000_000,
      category: "Other",
      date: "2026-03-31",
      statementType: "cash_flow",
      scope: "consolidated",
      pageNumber: 14,
      sourcePage: 14,
      sourceColumn: "31 March 2026",
      sourceText: "Amount received under a government incentive scheme 42.0 35.0",
      sourceStatement: "Consolidated Cash Flow",
      extractionEngine: "pdf_layout",
      confidence: 0.93,
      isAggregate: false,
    },
    {
      description: "Registered office: Mumbai 400001",
      amount: 400001,
      statementType: "balance_sheet",
      pageNumber: 1,
      extractionEngine: "pdf_layout",
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].description, "Amount received under a government incentive scheme");
  assert.equal(rows[0].sourcePage, 14);
});

test("preserves source evidence while merging deterministic line items", () => {
  const merged = mergeExtractedLineItems(
    {
      summary: "Synthetic statement",
      lineItems: [],
      transactions: [],
    },
    [
      {
        description: "Trade receivables",
        amount: 125_000_000,
        category: "Asset",
        date: "2026-03-31",
        displayedAmount: 125,
        displayedUnit: "millions",
        currency: "INR",
        statementType: "balance_sheet",
        scope: "consolidated",
        pageNumber: 8,
        sourcePage: 8,
        sourceColumn: "31 March 2026",
        sourceText: "Trade receivables 125 110",
        sourceStatement: "Consolidated Balance Sheet",
        extractionEngine: "pdf_layout",
        confidence: 0.96,
        isAggregate: false,
      },
    ],
  );

  assert.equal(merged.lineItems?.length, 1);
  assert.equal(merged.lineItems?.[0].sourcePage, 8);
  assert.equal(merged.lineItems?.[0].displayedAmount, 125);
  assert.equal(merged.lineItems?.[0].isAggregate, false);
});


test("inherits statement type across a multi-page cash-flow continuation", async () => {
  const result = await extractFinancialStatementFromPdf(
    makeContinuedCashFlowPdf(),
    "synthetic-cash-flow-continuation.pdf",
  );

  const dividend = result.rawLineItems.find((item) =>
    item.description.toLowerCase().includes("dividends paid"),
  );
  assert.ok(dividend);
  assert.equal(dividend.pageNumber, 4);
  assert.equal(dividend.statementType, "cash_flow");
  assert.equal(result.data.cash, 100_000_000);
  assert.deepEqual(result.diagnostics.statementPages, [1, 2, 3, 4]);
});
