import type { ExtractedDocumentData } from "./gemini";

export type FinancialSummaryMetric =
  | "revenue"
  | "expenses"
  | "netIncome"
  | "cash"
  | "assets"
  | "liabilities"
  | "equity";

export type FinancialMetricValidation = {
  status: "verified" | "partial" | "needs_review";
  invalidatedFields: FinancialSummaryMetric[];
  availableFields: FinancialSummaryMetric[];
  warnings: string[];
};

export type FinancialSummaryValidationResult = {
  data: ExtractedDocumentData;
  validation: FinancialMetricValidation;
};

type ValidationOptions = {
  evidence?: Record<string, string>;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function firstFinite(...values: unknown[]) {
  for (const value of values) {
    if (isFiniteNumber(value)) {
      return value;
    }
  }

  return null;
}

function getMetricValue(
  data: ExtractedDocumentData,
  metric: FinancialSummaryMetric,
) {
  switch (metric) {
    case "revenue":
      return firstFinite(data.revenue, data.totalRevenue, data.sales);
    case "expenses":
      return firstFinite(data.expenses, data.totalExpenses);
    case "netIncome":
      if (isFiniteNumber(data.netIncome)) {
        return data.netIncome;
      }
      if (isFiniteNumber(data.profit)) {
        return Math.abs(data.profit);
      }
      if (isFiniteNumber(data.loss)) {
        return -Math.abs(data.loss);
      }
      return null;
    case "cash":
      return firstFinite(data.cash, data.closingBalance, data.balance);
    case "assets":
      return firstFinite(data.assets);
    case "liabilities":
      return firstFinite(data.liabilities);
    case "equity":
      return firstFinite(data.equity);
  }
}

function clearMetric(
  data: ExtractedDocumentData,
  metric: FinancialSummaryMetric,
) {
  switch (metric) {
    case "revenue":
      data.revenue = null;
      data.totalRevenue = null;
      data.sales = null;
      break;
    case "expenses":
      data.expenses = null;
      data.totalExpenses = null;
      break;
    case "netIncome":
      data.netIncome = null;
      data.profit = null;
      data.loss = null;
      break;
    case "cash":
      data.cash = null;
      data.closingBalance = null;
      data.balance = null;
      break;
    case "assets":
      data.assets = null;
      break;
    case "liabilities":
      data.liabilities = null;
      break;
    case "equity":
      data.equity = null;
      break;
  }
}

function setDerivedMetric(
  data: ExtractedDocumentData,
  metric: FinancialSummaryMetric,
  value: number,
) {
  switch (metric) {
    case "expenses":
      data.expenses = value;
      data.totalExpenses = value;
      break;
    case "netIncome":
      data.netIncome = value;
      if (value < 0) {
        data.loss = Math.abs(value);
        data.profit = null;
      } else {
        data.profit = value;
        data.loss = null;
      }
      break;
    case "assets":
      data.assets = value;
      break;
    case "liabilities":
      data.liabilities = value;
      break;
    case "equity":
      data.equity = value;
      break;
    case "revenue":
      data.revenue = value;
      data.totalRevenue = value;
      break;
    case "cash":
      data.cash = value;
      break;
  }
}

function relativeDifference(actual: number, expected: number) {
  return Math.abs(actual - expected) / Math.max(Math.abs(actual), Math.abs(expected), 1);
}

function canonicalAvailableFields(data: ExtractedDocumentData) {
  const fields: FinancialSummaryMetric[] = [
    "revenue",
    "expenses",
    "netIncome",
    "cash",
    "assets",
    "liabilities",
    "equity",
  ];

  return fields.filter((field) => getMetricValue(data, field) !== null);
}

/**
 * Financial statements often contain note numbers, page references and values
 * from different units in the same extracted text. This gate removes values
 * that are mathematically or scale-wise incompatible before they can reach the
 * review screen, ledger, dashboard or AI context.
 */
export function validateFinancialStatementSummary(
  extracted: ExtractedDocumentData,
  options: ValidationOptions = {},
): FinancialSummaryValidationResult {
  const data: ExtractedDocumentData = { ...extracted };
  const invalidated = new Set<FinancialSummaryMetric>();
  const warnings: string[] = [];
  const evidence = options.evidence ?? {};
  const evidenceCount = Object.keys(evidence).length;

  function invalidate(metric: FinancialSummaryMetric, reason: string) {
    if (!invalidated.has(metric)) {
      clearMetric(data, metric);
      invalidated.add(metric);
    }
    warnings.push(reason);
  }

  const initialValues = {
    revenue: getMetricValue(data, "revenue"),
    expenses: getMetricValue(data, "expenses"),
    netIncome: getMetricValue(data, "netIncome"),
    cash: getMetricValue(data, "cash"),
    assets: getMetricValue(data, "assets"),
    liabilities: getMetricValue(data, "liabilities"),
    equity: getMetricValue(data, "equity"),
  };

  const anchorCandidates = [
    initialValues.revenue,
    initialValues.expenses,
    initialValues.assets,
    initialValues.liabilities,
    initialValues.equity,
  ]
    .filter(isFiniteNumber)
    .map((value) => Math.abs(value))
    .filter((value) => value > 0);
  const anchor = anchorCandidates.length > 0 ? Math.max(...anchorCandidates) : 0;

  if (anchor >= 1_000_000) {
    const tinyThreshold = Math.max(anchor * 0.000001, 100);
    const fieldsToCheck: FinancialSummaryMetric[] = [
      "expenses",
      "netIncome",
      "cash",
      "assets",
      "liabilities",
      "equity",
    ];

    for (const field of fieldsToCheck) {
      const value = getMetricValue(data, field);

      if (value !== null && Math.abs(value) > 0 && Math.abs(value) < tinyThreshold) {
        invalidate(
          field,
          `${field} was hidden because ${Math.abs(value)} is implausibly small beside the document's ${anchor} scale and is likely a note/page reference or unscaled value.`,
        );
      }
    }
  }

  let revenue = getMetricValue(data, "revenue");
  let expenses = getMetricValue(data, "expenses");
  let netIncome = getMetricValue(data, "netIncome");

  if (revenue !== null && expenses !== null && netIncome !== null) {
    const expectedNetIncome = revenue - expenses;

    // Revenue, expenses and net income do not always form an exact identity
    // because statements can separate other income, finance costs and tax.
    // Keep plausible values, but surface a warning when the gap is extreme.
    if (relativeDifference(netIncome, expectedNetIncome) > 0.75) {
      warnings.push(
        "The profit-and-loss summary does not fully reconcile; verify whether other income, finance costs or tax are presented separately.",
      );
    }
  }

  revenue = getMetricValue(data, "revenue");
  expenses = getMetricValue(data, "expenses");
  netIncome = getMetricValue(data, "netIncome");

  if (revenue !== null && expenses !== null && netIncome === null) {
    const derived = revenue - expenses;

    if (Number.isFinite(derived)) {
      setDerivedMetric(data, "netIncome", derived);
      warnings.push("Profit/loss was derived from revenue - expenses after validation.");
    }
  } else if (revenue !== null && expenses === null && netIncome !== null) {
    const derived = revenue - netIncome;

    if (Number.isFinite(derived) && derived >= 0 && Math.abs(netIncome) <= Math.abs(revenue) * 2) {
      setDerivedMetric(data, "expenses", derived);
      warnings.push("Expenses were derived from revenue - net income after validation.");
    }
  }

  let assets = getMetricValue(data, "assets");
  let liabilities = getMetricValue(data, "liabilities");
  let equity = getMetricValue(data, "equity");

  if (assets !== null && liabilities !== null && equity !== null) {
    const expectedAssets = liabilities + equity;

    if (relativeDifference(assets, expectedAssets) > 0.08) {
      invalidate(
        "assets",
        "Assets were hidden because the extracted balance sheet does not satisfy assets = liabilities + equity.",
      );
      invalidate(
        "liabilities",
        "Liabilities were hidden because the extracted balance sheet does not reconcile.",
      );
      invalidate(
        "equity",
        "Equity was hidden because the extracted balance sheet does not reconcile.",
      );
    }
  }

  assets = getMetricValue(data, "assets");
  liabilities = getMetricValue(data, "liabilities");
  equity = getMetricValue(data, "equity");

  if (assets !== null && liabilities !== null && equity === null) {
    const derived = assets - liabilities;

    if (Number.isFinite(derived)) {
      setDerivedMetric(data, "equity", derived);
      warnings.push("Equity was derived from assets - liabilities after validation.");
    }
  } else if (assets !== null && liabilities === null && equity !== null) {
    const derived = assets - equity;

    if (Number.isFinite(derived) && derived >= 0) {
      setDerivedMetric(data, "liabilities", derived);
      warnings.push("Liabilities were derived from assets - equity after validation.");
    }
  } else if (assets === null && liabilities !== null && equity !== null) {
    const derived = liabilities + equity;

    if (Number.isFinite(derived)) {
      setDerivedMetric(data, "assets", derived);
      warnings.push("Assets were derived from liabilities + equity after validation.");
    }
  }

  const validatedAssets = getMetricValue(data, "assets");
  const validatedCash = getMetricValue(data, "cash");

  if (
    validatedAssets !== null &&
    validatedCash !== null &&
    Math.abs(validatedCash) > Math.abs(validatedAssets) * 1.2
  ) {
    invalidate(
      "cash",
      "Cash was hidden because it exceeds total assets and is likely from the wrong table column or unit.",
    );
  }

  const availableFields = canonicalAvailableFields(data);
  const invalidatedFields = [...invalidated];
  const status: FinancialMetricValidation["status"] =
    invalidatedFields.length > 0
      ? "needs_review"
      : availableFields.length >= 5 && evidenceCount >= 3
        ? "verified"
        : "partial";

  const validation: FinancialMetricValidation = {
    status,
    invalidatedFields,
    availableFields,
    warnings: [...new Set(warnings)],
  };

  data.metricValidation = validation;

  return {
    data,
    validation,
  };
}
