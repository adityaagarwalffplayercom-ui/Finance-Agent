import { prisma } from "./prisma";

type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

type RiskFactor = {
  id: string;
  title: string;
  level: RiskLevel;
  scoreImpact: number;
  message: string;
  recommendation: string;
};

type MoneyValue = {
  raw: number;
  formatted: string;
};

export type BusinessRiskScore = {
  generatedAt: string;
  score: number;
  level: RiskLevel;
  label: string;
  summary: string;
  metrics: {
    revenue: MoneyValue;
    expenses: MoneyValue;
    profit: MoneyValue;
    cash: MoneyValue;
    assets: MoneyValue;
    liabilities: MoneyValue;
    profitMarginPercent: number | null;
    expenseRatioPercent: number | null;
    revenueCoveragePercent: number | null;
    debtToAssetPercent: number | null;
  };
  documentStatus: {
    totalDocuments: number;
    processedDocuments: number;
    approvedDocuments: number;
    pendingReviewDocuments: number;
    rejectedDocuments: number;
    failedDocuments: number;
  };
  riskFactors: RiskFactor[];
  strengths: string[];
  recommendedActions: string[];
  missingData: string[];
};

type ExtractedLike = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("en-IN", {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  }
}

function money(value: number, currency: string): MoneyValue {
  return {
    raw: value,
    formatted: formatMoney(value, currency),
  };
}

function safeRatio(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return null;
  }

  if (denominator === 0) {
    return null;
  }

  return Math.round((numerator / denominator) * 10000) / 100;
}

function getExtractedNumber(data: ExtractedLike, keys: string[]) {
  for (const key of keys) {
    const value = toNumber(data[key]);

    if (value !== null) {
      return value;
    }
  }

  return 0;
}

function getNetIncome(data: ExtractedLike) {
  const netIncome = toNumber(data.netIncome);

  if (netIncome !== null) {
    return netIncome;
  }

  const profit = toNumber(data.profit);

  if (profit !== null && profit > 0) {
    return profit;
  }

  const loss = toNumber(data.loss);

  if (loss !== null && loss > 0) {
    return -Math.abs(loss);
  }

  return 0;
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 75) {
    return "CRITICAL";
  }

  if (score >= 55) {
    return "HIGH";
  }

  if (score >= 30) {
    return "MODERATE";
  }

  return "LOW";
}

function getRiskLabel(level: RiskLevel) {
  if (level === "CRITICAL") {
    return "Critical financial risk";
  }

  if (level === "HIGH") {
    return "High financial risk";
  }

  if (level === "MODERATE") {
    return "Moderate financial risk";
  }

  return "Low financial risk";
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function addRisk(
  factors: RiskFactor[],
  factor: Omit<RiskFactor, "id"> & { id?: string },
) {
  factors.push({
    id:
      factor.id ??
      `${factor.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${factors.length}`,
    title: factor.title,
    level: factor.level,
    scoreImpact: factor.scoreImpact,
    message: factor.message,
    recommendation: factor.recommendation,
  });
}

function buildSummary(params: {
  level: RiskLevel;
  profit: number;
  revenue: number;
  expenses: number;
  approvedDocuments: number;
  pendingReviewDocuments: number;
}) {
  const { level, profit, revenue, expenses, approvedDocuments, pendingReviewDocuments } =
    params;

  if (approvedDocuments === 0) {
    return "Aureli cannot calculate a reliable risk score yet because no approved financial documents are available.";
  }

  if (level === "CRITICAL") {
    return `Your business is showing critical financial risk. The biggest concern is ${
      profit < 0 ? "loss-making performance" : "weak financial coverage"
    }, with revenue of ${revenue.toLocaleString("en-IN")} and expenses of ${expenses.toLocaleString(
      "en-IN",
    )}.`;
  }

  if (level === "HIGH") {
    return `Your business has high financial risk. Aureli detected pressure from expenses, profitability, or missing financial evidence. ${
      pendingReviewDocuments > 0
        ? "Some documents are still pending review, so the score may improve after approval."
        : ""
    }`;
  }

  if (level === "MODERATE") {
    return "Your business has moderate financial risk. The current data is usable, but there are areas that need monitoring before they become serious.";
  }

  return "Your business currently appears financially stable based on approved uploaded documents. Continue monitoring expenses, cash position, and document completeness.";
}

export async function getBusinessRiskScore(
  userId: string,
): Promise<BusinessRiskScore> {
  const business = await prisma.business.findUnique({
    where: {
      userId,
    },
    select: {
      name: true,
      currency: true,
      country: true,
      industry: true,
      businessType: true,
      financialYear: true,
    },
  });

  const currency = cleanString(business?.currency, "INR");

  const documents = await prisma.document.findMany({
    where: {
      userId,
    },
    orderBy: {
      uploadedAt: "desc",
    },
    select: {
      id: true,
      fileName: true,
      category: true,
      status: true,
      reviewStatus: true,
      extractedData: true,
      uploadedAt: true,
    },
  });

  const processedDocuments = documents.filter(
    (document) => String(document.status) === "PROCESSED",
  );

  const approvedDocuments = processedDocuments.filter(
    (document) => String(document.reviewStatus) === "APPROVED",
  );

  const pendingReviewDocuments = processedDocuments.filter(
    (document) => String(document.reviewStatus) === "NEEDS_REVIEW",
  );

  const rejectedDocuments = documents.filter(
    (document) => String(document.reviewStatus) === "REJECTED",
  );

  const failedDocuments = documents.filter(
    (document) => String(document.status) === "FAILED",
  );

  let revenue = 0;
  let expenses = 0;
  let profit = 0;
  let cash = 0;
  let assets = 0;
  let liabilities = 0;

  let lineItemCount = 0;
  let highValueExpenseCount = 0;
  let largestExpense = 0;

  for (const document of approvedDocuments) {
    if (!isRecord(document.extractedData)) {
      continue;
    }

    const data = document.extractedData;

    const docRevenue = getExtractedNumber(data, [
      "revenue",
      "totalRevenue",
      "sales",
    ]);

    const docExpenses = getExtractedNumber(data, [
      "expenses",
      "totalExpenses",
    ]);

    const docProfit = getNetIncome(data);
    const docCash = getExtractedNumber(data, [
      "cash",
      "closingBalance",
      "balance",
    ]);

    const docAssets = getExtractedNumber(data, ["assets"]);
    const docLiabilities = getExtractedNumber(data, ["liabilities"]);

    revenue += docRevenue;
    expenses += docExpenses;
    profit += docProfit;
    cash += docCash;
    assets += docAssets;
    liabilities += docLiabilities;

    if (Array.isArray(data.lineItems)) {
      lineItemCount += data.lineItems.length;

      for (const item of data.lineItems) {
        if (!isRecord(item)) {
          continue;
        }

        const amount = Math.abs(toNumber(item.amount) ?? 0);
        const category = cleanString(item.category).toLowerCase();
        const description = cleanString(item.description).toLowerCase();

        const looksExpense =
          category.includes("expense") ||
          description.includes("expense") ||
          description.includes("cost") ||
          description.includes("salary") ||
          description.includes("finance cost") ||
          description.includes("purchase");

        if (looksExpense && amount > 0) {
          largestExpense = Math.max(largestExpense, amount);

          if (revenue > 0 && amount / revenue > 0.1) {
            highValueExpenseCount += 1;
          }
        }
      }
    }
  }

  if (profit === 0 && revenue > 0 && expenses > 0) {
    profit = revenue - expenses;
  }

  const profitMarginPercent = safeRatio(profit, revenue);
  const expenseRatioPercent = safeRatio(expenses, revenue);
  const revenueCoveragePercent = safeRatio(revenue, expenses);
  const debtToAssetPercent = safeRatio(liabilities, assets);

  const riskFactors: RiskFactor[] = [];
  const strengths: string[] = [];
  const recommendedActions: string[] = [];
  const missingData: string[] = [];

  let score = 0;

  if (approvedDocuments.length === 0) {
    score += 40;
    missingData.push("Approve at least one processed financial document.");
    addRisk(riskFactors, {
      title: "No approved financial documents",
      level: "HIGH",
      scoreImpact: 40,
      message:
        "Aureli cannot fully trust the dashboard because no processed document has been approved yet.",
      recommendation:
        "Open Documents, review extracted values, and approve correct documents.",
    });
  }

  if (processedDocuments.length === 0) {
    score += 25;
    missingData.push("Upload and process financial statements, invoices, or bank statements.");
    addRisk(riskFactors, {
      title: "No processed documents",
      level: "HIGH",
      scoreImpact: 25,
      message: "No AI-processed financial document is available for analysis.",
      recommendation:
        "Upload a financial statement, sales invoice, purchase invoice, or bank statement.",
    });
  }

  if (pendingReviewDocuments.length > 0) {
    const impact = Math.min(15, pendingReviewDocuments.length * 3);
    score += impact;
    addRisk(riskFactors, {
      title: "Documents pending review",
      level: "MODERATE",
      scoreImpact: impact,
      message: `${pendingReviewDocuments.length} processed document(s) are still waiting for review.`,
      recommendation:
        "Approve correct documents and reject incorrect ones so dashboard decisions use trusted data.",
    });
  }

  if (failedDocuments.length > 0) {
    const impact = Math.min(12, failedDocuments.length * 4);
    score += impact;
    addRisk(riskFactors, {
      title: "Failed AI processing",
      level: "MODERATE",
      scoreImpact: impact,
      message: `${failedDocuments.length} document(s) failed during AI processing.`,
      recommendation:
        "Retry smaller/readable files, avoid huge scanned PDFs, or use billing-enabled Gemini quota.",
    });
  }

  if (revenue <= 0 && approvedDocuments.length > 0) {
    score += 25;
    missingData.push("No reliable revenue figure found in approved documents.");
    addRisk(riskFactors, {
      title: "Revenue missing",
      level: "HIGH",
      scoreImpact: 25,
      message:
        "Approved documents do not contain a reliable revenue/sales figure.",
      recommendation:
        "Upload a sales invoice, income statement, GST sales summary, or revenue report.",
    });
  }

  if (expenses <= 0 && approvedDocuments.length > 0) {
    score += 15;
    missingData.push("No reliable expense figure found in approved documents.");
    addRisk(riskFactors, {
      title: "Expenses missing",
      level: "MODERATE",
      scoreImpact: 15,
      message:
        "Approved documents do not contain a reliable total expense figure.",
      recommendation:
        "Upload purchase invoices, payroll, utility bills, or a profit and loss statement.",
    });
  }

  if (profit < 0) {
    const lossRatio = revenue > 0 ? Math.abs(profit) / revenue : 1;
    const impact = lossRatio > 0.25 ? 30 : lossRatio > 0.1 ? 22 : 14;

    score += impact;
    addRisk(riskFactors, {
      title: "Business is loss-making",
      level: impact >= 30 ? "CRITICAL" : "HIGH",
      scoreImpact: impact,
      message: `Approved documents show a net loss of ${formatMoney(
        Math.abs(profit),
        currency,
      )}.`,
      recommendation:
        "Reduce controllable expenses, check pricing, and identify the biggest cost lines first.",
    });
  } else if (profit > 0 && revenue > 0) {
    strengths.push(
      `Business is profitable with estimated profit of ${formatMoney(
        profit,
        currency,
      )}.`,
    );
  }

  if (expenseRatioPercent !== null) {
    if (expenseRatioPercent > 100) {
      score += 25;
      addRisk(riskFactors, {
        title: "Expenses exceed revenue",
        level: "CRITICAL",
        scoreImpact: 25,
        message: `Expense ratio is ${expenseRatioPercent}%, meaning expenses are higher than revenue.`,
        recommendation:
          "Prioritize expense reduction and investigate major cost categories.",
      });
    } else if (expenseRatioPercent > 85) {
      score += 15;
      addRisk(riskFactors, {
        title: "High expense ratio",
        level: "HIGH",
        scoreImpact: 15,
        message: `Expense ratio is ${expenseRatioPercent}%, leaving limited profit buffer.`,
        recommendation:
          "Track top expenses monthly and set category-wise cost controls.",
      });
    } else {
      strengths.push(`Expense ratio is controlled at ${expenseRatioPercent}%.`);
    }
  }

  if (revenueCoveragePercent !== null) {
    if (revenueCoveragePercent < 75) {
      score += 20;
      addRisk(riskFactors, {
        title: "Weak revenue coverage",
        level: "HIGH",
        scoreImpact: 20,
        message: `Revenue covers only ${revenueCoveragePercent}% of expenses.`,
        recommendation:
          "Increase revenue or reduce recurring costs until revenue coverage crosses 100%.",
      });
    } else if (revenueCoveragePercent < 100) {
      score += 12;
      addRisk(riskFactors, {
        title: "Revenue coverage below break-even",
        level: "MODERATE",
        scoreImpact: 12,
        message: `Revenue coverage is ${revenueCoveragePercent}%, slightly below break-even.`,
        recommendation:
          "Improve sales conversion and reduce non-essential expenses.",
      });
    } else {
      strengths.push(`Revenue coverage is ${revenueCoveragePercent}%.`);
    }
  }

  if (cash <= 0 && approvedDocuments.length > 0) {
    score += 10;
    missingData.push("No clear cash or bank balance found.");
    addRisk(riskFactors, {
      title: "Cash position unclear",
      level: "MODERATE",
      scoreImpact: 10,
      message:
        "Aureli could not identify a reliable cash/bank balance from approved documents.",
      recommendation:
        "Upload a recent bank statement or balance sheet with cash and cash equivalents.",
    });
  } else if (cash > 0) {
    strengths.push(`Cash/balance detected: ${formatMoney(cash, currency)}.`);
  }

  if (debtToAssetPercent !== null) {
    if (debtToAssetPercent > 80) {
      score += 20;
      addRisk(riskFactors, {
        title: "High liability pressure",
        level: "HIGH",
        scoreImpact: 20,
        message: `Liabilities are ${debtToAssetPercent}% of assets.`,
        recommendation:
          "Review borrowings, payables, and debt repayment obligations.",
      });
    } else if (debtToAssetPercent > 55) {
      score += 10;
      addRisk(riskFactors, {
        title: "Moderate liability pressure",
        level: "MODERATE",
        scoreImpact: 10,
        message: `Liabilities are ${debtToAssetPercent}% of assets.`,
        recommendation:
          "Monitor debt levels and avoid taking new liabilities without revenue growth.",
      });
    } else {
      strengths.push(`Debt-to-asset ratio is ${debtToAssetPercent}%.`);
    }
  }

  if (lineItemCount === 0 && approvedDocuments.length > 0) {
    score += 12;
    missingData.push("No line items found in approved documents.");
    addRisk(riskFactors, {
      title: "Line item detail missing",
      level: "MODERATE",
      scoreImpact: 12,
      message:
        "Aureli found totals, but not detailed rows. This limits anomaly detection.",
      recommendation:
        "Use readable PDF, CSV, or XLSX files so detailed rows can be extracted.",
    });
  } else if (lineItemCount > 0) {
    strengths.push(`${lineItemCount} extracted line item(s) available for deeper analysis.`);
  }

  if (highValueExpenseCount > 0) {
    score += Math.min(16, highValueExpenseCount * 4);
    addRisk(riskFactors, {
      title: "Large expense concentration",
      level: highValueExpenseCount >= 3 ? "HIGH" : "MODERATE",
      scoreImpact: Math.min(16, highValueExpenseCount * 4),
      message: `${highValueExpenseCount} expense line item(s) appear large compared with revenue.`,
      recommendation:
        "Open extracted line items and inspect the largest cost categories first.",
    });
  }

  if (rejectedDocuments.length > 0) {
    score += Math.min(8, rejectedDocuments.length * 2);
    addRisk(riskFactors, {
      title: "Rejected documents present",
      level: "MODERATE",
      scoreImpact: Math.min(8, rejectedDocuments.length * 2),
      message: `${rejectedDocuments.length} document(s) were rejected and excluded from the dashboard.`,
      recommendation:
        "Replace rejected files with correct financial documents if needed.",
    });
  }

  if (riskFactors.length === 0) {
    strengths.push("No major financial risk signals detected from approved documents.");
    recommendedActions.push("Continue uploading monthly statements to keep risk score accurate.");
    recommendedActions.push("Review line items monthly for unusual cost spikes.");
    recommendedActions.push("Keep tax and compliance documents updated.");
  } else {
    recommendedActions.push(
      ...riskFactors
        .sort((a, b) => b.scoreImpact - a.scoreImpact)
        .slice(0, 5)
        .map((factor) => factor.recommendation),
    );
  }

  if (!business) {
    missingData.push("Business onboarding profile is incomplete.");
  }

  if (approvedDocuments.length < 2) {
    missingData.push("Upload more than one document type for better risk accuracy.");
  }

  const finalScore = clampScore(score);
  const level = getRiskLevel(finalScore);

  return {
    generatedAt: new Date().toISOString(),
    score: finalScore,
    level,
    label: getRiskLabel(level),
    summary: buildSummary({
      level,
      profit,
      revenue,
      expenses,
      approvedDocuments: approvedDocuments.length,
      pendingReviewDocuments: pendingReviewDocuments.length,
    }),
    metrics: {
      revenue: money(revenue, currency),
      expenses: money(expenses, currency),
      profit: money(profit, currency),
      cash: money(cash, currency),
      assets: money(assets, currency),
      liabilities: money(liabilities, currency),
      profitMarginPercent,
      expenseRatioPercent,
      revenueCoveragePercent,
      debtToAssetPercent,
    },
    documentStatus: {
      totalDocuments: documents.length,
      processedDocuments: processedDocuments.length,
      approvedDocuments: approvedDocuments.length,
      pendingReviewDocuments: pendingReviewDocuments.length,
      rejectedDocuments: rejectedDocuments.length,
      failedDocuments: failedDocuments.length,
    },
    riskFactors: riskFactors.sort((a, b) => b.scoreImpact - a.scoreImpact),
    strengths: Array.from(new Set(strengths)).slice(0, 8),
    recommendedActions: Array.from(new Set(recommendedActions)).slice(0, 8),
    missingData: Array.from(new Set(missingData)).slice(0, 8),
  };
}