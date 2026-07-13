import type { ExtractedDocumentData } from "./gemini";
import type { RawFinancialLineItem } from "./raw-financial-line-items";

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
};

type PositionedText = {
  text: string;
  x: number;
  y: number;
};

type LayoutRow = {
  y: number;
  items: PositionedText[];
};

type StatementScope = "standalone" | "consolidated";
type StatementPageKind = `${StatementScope}-${"pnl" | "balance-sheet" | "cash-flow"}`;

type ParsedPage = {
  pageNumber: number;
  kind: StatementPageKind | null;
  text: string;
  rows: LayoutRow[];
};

type ParsedStatementLine = RawFinancialLineItem & {
  displayedAmount: number;
  pageNumber: number;
  pageKind: StatementPageKind;
};

export type DeterministicFinancialStatementResult = {
  data: ExtractedDocumentData;
  rawLineItems: RawFinancialLineItem[];
  sourceText: string;
  metricEvidence: Record<string, string>;
  selectedScope: StatementScope;
  statementPages: number[];
};

const AMOUNT_PATTERN = /\(?-?\d{1,3}(?:,\d{2,3})*(?:\.\d+)?\)?/g;
const FINANCIAL_LABEL_PATTERN =
  /revenue|income|sales|expense|cost|profit|loss|asset|liabilit|equity|capital|reserve|cash|receivable|payable|borrow|inventory|inventor|property|plant|equipment|investment|loan|provision|tax|depreciation|amorti|dividend|operating activit|investing activit|financing activit/i;
const HEADING_PATTERN =
  /financial results for the quarter|balance sheet as at|statement of cash flow|financial year ended|quarter ended|particulars|audited|un-audited/i;

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

function parseAmountToken(value: string) {
  const text = value.trim();
  const isNegative = /^\(.*\)$/.test(text) || text.startsWith("-");
  const parsed = Number(text.replace(/[(),\s]/g, "").replace(/^-/, ""));

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return isNegative ? -Math.abs(parsed) : parsed;
}

function getAmounts(value: string) {
  return (cleanText(value).match(AMOUNT_PATTERN) ?? [])
    .map(parseAmountToken)
    .filter((amount): amount is number => amount !== null);
}

function stripAmounts(value: string) {
  return cleanText(value)
    .replace(AMOUNT_PATTERN, " ")
    .replace(
      /\b(?:i|ii|iii|iv|v|vi|vii|viii|ix|x|a|b|c|d|e|f|g|h|j|k|l|m|n)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function groupTextItems(items: PdfTextItem[]) {
  const positioned = items
    .map((item) => ({
      text: cleanText(item.str),
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
    }))
    .filter((item) => item.text)
    .sort((left, right) => right.y - left.y || left.x - right.x);
  const rows: LayoutRow[] = [];

  for (const item of positioned) {
    let row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 1.8);

    if (!row) {
      row = { y: item.y, items: [] };
      rows.push(row);
    }

    row.items.push(item);
  }

  rows.sort((left, right) => right.y - left.y);

  for (const row of rows) {
    row.items.sort((left, right) => left.x - right.x);
  }

  return rows;
}

function detectPageKind(text: string): StatementPageKind | null {
  const value = compactText(text);
  const scope: StatementScope | null = value.includes("consolidated")
    ? "consolidated"
    : value.includes("standalone")
      ? "standalone"
      : null;

  if (!scope) {
    return null;
  }

  if (value.includes("financialresultsforthequarterandfinancialyearended")) {
    return `${scope}-pnl`;
  }

  if (value.includes("balancesheetasat")) {
    return `${scope}-balance-sheet`;
  }

  if (
    value.includes("statementofcashflowsforfinancialyearended") ||
    value.includes("statementofcashflowforfinancialyearended")
  ) {
    return `${scope}-cash-flow`;
  }

  return null;
}

function detectUnit(text: string): {
  reportedUnit: NonNullable<ExtractedDocumentData["reportedUnit"]>;
  scaleMultiplier: number;
  evidence: string;
} {
  const value = cleanText(text).toLowerCase();

  if (/\bin\s+crores?\b|rupees\s+in\s+crores?/.test(value)) {
    return {
      reportedUnit: "crores",
      scaleMultiplier: 10_000_000,
      evidence: "Amounts reported in crores",
    };
  }

  if (/\bin\s+lakhs?\b|rupees\s+in\s+lakhs?/.test(value)) {
    return {
      reportedUnit: "lakhs",
      scaleMultiplier: 100_000,
      evidence: "Amounts reported in lakhs",
    };
  }

  if (/\bin\s+millions?\b|amounts?\s+(?:are\s+)?in\s+millions?/.test(value)) {
    return {
      reportedUnit: "millions",
      scaleMultiplier: 1_000_000,
      evidence: "Amounts reported in million",
    };
  }

  if (/\bin\s+billions?\b/.test(value)) {
    return {
      reportedUnit: "billions",
      scaleMultiplier: 1_000_000_000,
      evidence: "Amounts reported in billion",
    };
  }

  if (/\bin\s+thousands?\b/.test(value)) {
    return {
      reportedUnit: "thousands",
      scaleMultiplier: 1_000,
      evidence: "Amounts reported in thousand",
    };
  }

  return {
    reportedUnit: "actual",
    scaleMultiplier: 1,
    evidence: "No reporting scale detected; values kept as shown",
  };
}

function parsePeriodEnd(text: string) {
  const matches = [...text.matchAll(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/g)];
  const dates = matches
    .map((match) => {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);

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
    })
    .filter((value): value is string => Boolean(value))
    .sort();

  return dates.at(-1) ?? null;
}

function inferCategory(description: string) {
  const value = compactText(description);

  if (/revenue|sales|turnover|incomefromoperations/.test(value)) return "Revenue";
  if (/totalincome|otherincome|interestincome/.test(value)) return "Income";
  if (/expense|cost|depreciation|amorti|employeebenefit/.test(value)) {
    return "Expense";
  }
  if (/profit|loss|comprehensiveincome/.test(value)) return "Profit / Loss";
  if (/cash|bankbalance/.test(value)) return "Cash";
  if (/asset|property|plant|equipment|inventor|receivable|investment/.test(value)) {
    return "Asset";
  }
  if (/liabilit|payable|borrow|debt|provision/.test(value)) return "Liability";
  if (/equity|sharecapital|reserve|networth/.test(value)) return "Equity";
  if (/tax/.test(value)) return "Tax";

  return "Other";
}

function rowToFinancialLine(
  row: LayoutRow,
  pageKind: StatementPageKind,
  pageNumber: number,
  scaleMultiplier: number,
  periodEnd: string | null,
): ParsedStatementLine | null {
  const allText = row.items.map((item) => item.text).join(" ");
  const labelItems = pageKind.endsWith("-pnl")
    ? row.items.filter((item) => item.x >= 190 && item.x < 480)
    : row.items.filter((item) => item.x < 420);
  const label = stripAmounts(labelItems.map((item) => item.text).join(" ")) || stripAmounts(allText);
  const compactLabel = compactText(label);

  if (
    !label ||
    !FINANCIAL_LABEL_PATTERN.test(label) ||
    HEADING_PATTERN.test(label) ||
    compactLabel.length < 5
  ) {
    return null;
  }

  const amounts = getAmounts(allText);
  let displayedAmount: number | null = null;

  if (pageKind.endsWith("-pnl")) {
    // Quarterly-result layouts normally contain three quarter columns followed
    // by current-year and previous-year annual columns. Select current-year.
    if (amounts.length < 5) {
      return null;
    }

    displayedAmount = amounts.at(-2) ?? null;
  } else {
    // Balance-sheet and cash-flow layouts contain current year, then prior year.
    if (amounts.length < 2) {
      return null;
    }

    displayedAmount = amounts[0];
  }

  if (displayedAmount === null || !Number.isFinite(displayedAmount)) {
    return null;
  }

  return {
    description: label,
    displayedAmount,
    amount: displayedAmount * scaleMultiplier,
    category: inferCategory(label),
    date: periodEnd,
    pageNumber,
    pageKind,
  };
}

function findLine(
  lines: ParsedStatementLine[],
  predicate: (compactDescription: string, line: ParsedStatementLine) => boolean,
) {
  return lines.find((line) => predicate(compactText(line.description), line)) ?? null;
}

function dedupeLines(lines: ParsedStatementLine[]): RawFinancialLineItem[] {
  const seen = new Set<string>();
  const result: RawFinancialLineItem[] = [];

  for (const line of lines) {
    const key = `${compactText(line.description)}|${Math.round(line.amount * 100) / 100}|${line.date ?? ""}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({
      description: line.description,
      amount: line.amount,
      category: line.category,
      date: line.date,
    });
  }

  return result;
}

function formatScope(scope: StatementScope) {
  return scope === "consolidated" ? "Consolidated" : "Standalone";
}

export async function extractFinancialStatementFromPdf(
  buffer: Buffer,
  fileName: string,
): Promise<DeterministicFinancialStatementResult> {
  const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
  const pages: ParsedPage[] = [];

  await pdfParseModule.default(buffer, {
    pagerender: async (pageData: PdfPageData) => {
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      });
      const rows = groupTextItems(textContent.items ?? []);
      const text = rows
        .map((row) => row.items.map((item) => item.text).join(" "))
        .join("\n");
      const pageNumber = (pageData.pageIndex ?? pages.length) + 1;

      pages[pageNumber - 1] = {
        pageNumber,
        kind: detectPageKind(text),
        text,
        rows,
      };

      return "";
    },
  });

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];

    if (
      page &&
      !page.kind &&
      compactText(page.text).includes("cashflowsfromoperatingactivities")
    ) {
      const previousKind = pages[index - 1]?.kind;

      if (previousKind?.endsWith("-balance-sheet")) {
        const scope = previousKind.startsWith("consolidated")
          ? "consolidated"
          : "standalone";
        page.kind = `${scope}-cash-flow`;
      }
    }
  }

  const statementPages = pages.filter((page) => page?.kind);
  const consolidatedHasCoreStatements =
    statementPages.some((page) => page.kind === "consolidated-pnl") &&
    statementPages.some((page) => page.kind === "consolidated-balance-sheet");
  const standaloneHasCoreStatements =
    statementPages.some((page) => page.kind === "standalone-pnl") &&
    statementPages.some((page) => page.kind === "standalone-balance-sheet");

  if (!consolidatedHasCoreStatements && !standaloneHasCoreStatements) {
    throw new Error(
      "Could not locate a complete profit-and-loss statement and balance sheet in the PDF.",
    );
  }

  const selectedScope: StatementScope = consolidatedHasCoreStatements
    ? "consolidated"
    : "standalone";
  const selectedPages = statementPages.filter((page) =>
    page.kind?.startsWith(selectedScope),
  );
  const sourceText = selectedPages.map((page) => page.text).join("\n\n");
  const unit = detectUnit(sourceText);
  const periodEnd = parsePeriodEnd(sourceText);
  const parsedLines = selectedPages.flatMap((page) =>
    page.rows
      .map((row) =>
        rowToFinancialLine(
          row,
          page.kind as StatementPageKind,
          page.pageNumber,
          unit.scaleMultiplier,
          periodEnd,
        ),
      )
      .filter((line): line is ParsedStatementLine => Boolean(line)),
  );

  const revenueLine = findLine(
    parsedLines,
    (description) => description === "revenuefromoperations",
  );
  const expensesLine = findLine(
    parsedLines,
    (description) => description === "totalexpenses",
  );
  const profitLine = findLine(parsedLines, (description) =>
    description.startsWith("profitfortheperiod"),
  );
  const assetsLine = findLine(
    parsedLines,
    (description) => description === "totalassets",
  );
  const equityLine = findLine(
    parsedLines,
    (description) => description === "equity",
  );
  const cashLine = findLine(
    parsedLines,
    (description) => description.includes("cashandcashequivalents"),
  );
  const nonCurrentLiabilitiesLine = findLine(
    parsedLines,
    (description) => description === "noncurrentliabilities",
  );
  const currentLiabilitiesLine = findLine(
    parsedLines,
    (description) => description === "currentliabilities",
  );

  const assets = assetsLine?.amount ?? null;
  const equity = equityLine?.amount ?? null;
  const liabilitiesFromRows =
    nonCurrentLiabilitiesLine && currentLiabilitiesLine
      ? nonCurrentLiabilitiesLine.amount + currentLiabilitiesLine.amount
      : null;
  const liabilities =
    liabilitiesFromRows ??
    (assets !== null && equity !== null ? assets - equity : null);
  const netIncome = profitLine?.amount ?? null;
  const scopeLabel = formatScope(selectedScope);
  const metricEvidence: Record<string, string> = {};

  if (revenueLine) metricEvidence.revenue = `${revenueLine.description}, page ${revenueLine.pageNumber}`;
  if (expensesLine) metricEvidence.expenses = `${expensesLine.description}, page ${expensesLine.pageNumber}`;
  if (profitLine) metricEvidence.netIncome = `${profitLine.description}, page ${profitLine.pageNumber}`;
  if (cashLine) metricEvidence.cash = `${cashLine.description}, page ${cashLine.pageNumber}`;
  if (assetsLine) metricEvidence.assets = `${assetsLine.description}, page ${assetsLine.pageNumber}`;
  if (equityLine) metricEvidence.equity = `${equityLine.description}, page ${equityLine.pageNumber}`;
  if (liabilities !== null) {
    metricEvidence.liabilities =
      liabilitiesFromRows !== null
        ? `Non-current liabilities + current liabilities, balance-sheet page`
        : `Derived from total assets - total equity`;
  }

  const data: ExtractedDocumentData = {
    summary: `${scopeLabel} financial statements were extracted deterministically from the PDF table layout. Values use the current financial-year column and were converted from ${unit.reportedUnit} to full INR amounts.`,
    documentDate: periodEnd,
    periodStart:
      periodEnd?.slice(5) === "03-31"
        ? `${String(Number(periodEnd.slice(0, 4)) - 1)}-04-01`
        : null,
    periodEnd,
    currency: "INR",
    reportedUnit: unit.reportedUnit,
    scaleMultiplier: unit.scaleMultiplier,
    unitDetectionEvidence: unit.evidence,
    revenue: revenueLine?.amount ?? null,
    totalRevenue: revenueLine?.amount ?? null,
    expenses: expensesLine?.amount ?? null,
    totalExpenses: expensesLine?.amount ?? null,
    netIncome,
    profit: netIncome !== null && netIncome >= 0 ? netIncome : null,
    loss: netIncome !== null && netIncome < 0 ? Math.abs(netIncome) : null,
    cash: cashLine?.amount ?? null,
    assets,
    liabilities,
    equity,
    lineItems: dedupeLines(parsedLines),
    transactions: [],
  };

  if (
    data.revenue === null ||
    data.expenses === null ||
    data.netIncome === null ||
    data.assets === null ||
    data.equity === null ||
    data.cash === null
  ) {
    throw new Error(
      `Financial tables were found in ${fileName}, but one or more required headline totals could not be read reliably.`,
    );
  }

  return {
    data,
    rawLineItems: dedupeLines(parsedLines),
    sourceText,
    metricEvidence,
    selectedScope,
    statementPages: selectedPages.map((page) => page.pageNumber),
  };
}
