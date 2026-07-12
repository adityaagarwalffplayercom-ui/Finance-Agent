import {
  formatLedgerMoney,
  getTrustedLedgerContext,
} from "./trusted-ledger-context";

type RiskLevel =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "CRITICAL";

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
    profitMarginPercent:
      | number
      | null;
    expenseRatioPercent:
      | number
      | null;
    revenueCoveragePercent:
      | number
      | null;
    debtToAssetPercent:
      | number
      | null;
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

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

function getRiskLevel(
  score: number,
): RiskLevel {
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

function getRiskLabel(
  level: RiskLevel,
) {
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

function money(
  value: number,
  currency: string,
): MoneyValue {
  return {
    raw: value,
    formatted:
      formatLedgerMoney(
        value,
        currency,
      ),
  };
}

function unavailableMoney():
  MoneyValue {
  return {
    raw: 0,
    formatted:
      "Not available",
  };
}

function addRisk(
  factors: RiskFactor[],
  factor: Omit<
    RiskFactor,
    "id"
  > & {
    id?: string;
  },
) {
  factors.push({
    id:
      factor.id ??
      `${factor.title
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          "-",
        )}-${factors.length}`,
    title: factor.title,
    level: factor.level,
    scoreImpact:
      factor.scoreImpact,
    message: factor.message,
    recommendation:
      factor.recommendation,
  });
}

export async function getBusinessRiskScore(
  userId: string,
): Promise<BusinessRiskScore> {
  const context =
    await getTrustedLedgerContext(
      userId,
    );

  const {
    revenue,
    expenses,
    profit,
    profitMarginPercent,
    expenseRatioPercent,
    revenueCoveragePercent,
  } = context.totals;

  const factors: RiskFactor[] = [];
  const strengths: string[] = [];
  const recommendedActions:
    string[] = [];
  const missingData: string[] = [];

  let score = 5;

  if (
    context.counts
      .approvedFinancialEntries === 0
  ) {
    score += 70;

    addRisk(factors, {
      title:
        "No approved ledger evidence",
      level: "CRITICAL",
      scoreImpact: 70,
      message:
        "No approved CREDIT or DEBIT ledger entries are available for financial risk analysis.",
      recommendation:
        "Sync approved documents, review pending entries, and approve only verified transactions.",
    });

    missingData.push(
      "Approved credit and debit ledger entries are missing.",
    );
  }

  if (
    context.counts.pendingEntries > 0
  ) {
    const impact = Math.min(
      18,
      context.counts
        .pendingEntries * 2,
    );

    score += impact;

    addRisk(factors, {
      title:
        "Ledger review is incomplete",
      level:
        impact >= 12
          ? "HIGH"
          : "MODERATE",
      scoreImpact: impact,
      message:
        `${context.counts.pendingEntries} ledger entr${
          context.counts
            .pendingEntries === 1
            ? "y is"
            : "ies are"
        } excluded while awaiting review.`,
      recommendation:
        "Approve or reject pending ledger entries before relying on final decisions.",
    });
  }

  if (
    context.confidence.level ===
    "LOW"
  ) {
    score += 15;

    addRisk(factors, {
      title:
        "Low data confidence",
      level: "MODERATE",
      scoreImpact: 15,
      message:
        `Ledger data confidence is ${context.confidence.score}/100.`,
      recommendation:
        "Add correctly dated entries across more months and improve review coverage.",
    });
  } else if (
    context.confidence.level ===
    "HIGH"
  ) {
    strengths.push(
      `Ledger data confidence is high at ${context.confidence.score}/100.`,
    );
  }

  if (revenue <= 0 && expenses > 0) {
    score += 30;

    addRisk(factors, {
      title:
        "Revenue evidence is missing",
      level: "CRITICAL",
      scoreImpact: 30,
      message:
        "Approved ledger debits exist, but no approved credits are available in the selected currency.",
      recommendation:
        "Review sales, income, and receipt entries and approve verified credits.",
    });

    missingData.push(
      "Approved revenue or credit evidence is missing.",
    );
  }

  if (
    expenses <= 0 &&
    revenue > 0
  ) {
    score += 12;

    addRisk(factors, {
      title:
        "Expense evidence is incomplete",
      level: "MODERATE",
      scoreImpact: 12,
      message:
        "Approved credits exist, but no approved debits are available.",
      recommendation:
        "Review purchase, payroll, rent, utility, and operating cost entries.",
    });

    missingData.push(
      "Approved expense or debit evidence is missing.",
    );
  }

  if (profit < 0) {
    const lossRatio =
      revenue > 0
        ? Math.abs(profit) /
          revenue
        : 1;

    const impact =
      lossRatio > 0.25
        ? 34
        : lossRatio > 0.1
          ? 25
          : 16;

    score += impact;

    addRisk(factors, {
      title:
        "Approved ledger is loss-making",
      level:
        impact >= 34
          ? "CRITICAL"
          : "HIGH",
      scoreImpact: impact,
      message:
        `Approved ledger entries show a loss of ${formatLedgerMoney(
          Math.abs(profit),
          context.currency,
        )}.`,
      recommendation:
        "Close the break-even gap before hiring, expansion, or new fixed commitments.",
    });
  } else if (
    context.counts
      .approvedFinancialEntries > 0
  ) {
    strengths.push(
      `Approved ledger profit is ${formatLedgerMoney(
        profit,
        context.currency,
      )}.`,
    );
  }

  if (
    expenseRatioPercent !== null
  ) {
    if (
      expenseRatioPercent > 100
    ) {
      score += 25;

      addRisk(factors, {
        title:
          "Debits exceed credits",
        level: "CRITICAL",
        scoreImpact: 25,
        message:
          `Expense ratio is ${expenseRatioPercent.toFixed(
            2,
          )}%.`,
        recommendation:
          "Reduce controllable debits and improve recurring credits until coverage exceeds 100%.",
      });
    } else if (
      expenseRatioPercent > 85
    ) {
      score += 14;

      addRisk(factors, {
        title:
          "Expense ratio is high",
        level: "HIGH",
        scoreImpact: 14,
        message:
          `Approved debits consume ${expenseRatioPercent.toFixed(
            2,
          )}% of approved credits.`,
        recommendation:
          "Set category-wise limits and review the largest recurring debit entries.",
      });
    } else {
      strengths.push(
        `Expense ratio is controlled at ${expenseRatioPercent.toFixed(
          2,
        )}%.`,
      );
    }
  }

  if (
    revenueCoveragePercent !==
    null
  ) {
    if (
      revenueCoveragePercent < 75
    ) {
      score += 20;

      addRisk(factors, {
        title:
          "Revenue coverage is weak",
        level: "HIGH",
        scoreImpact: 20,
        message:
          `Approved credits cover only ${revenueCoveragePercent.toFixed(
            2,
          )}% of approved debits.`,
        recommendation:
          "Increase recurring inflow or cut debits until revenue coverage exceeds 100%.",
      });
    } else if (
      revenueCoveragePercent < 100
    ) {
      score += 10;

      addRisk(factors, {
        title:
          "Revenue coverage is below break-even",
        level: "MODERATE",
        scoreImpact: 10,
        message:
          `Revenue coverage is ${revenueCoveragePercent.toFixed(
            2,
          )}%.`,
        recommendation:
          "Create a quantified break-even plan.",
      });
    } else {
      strengths.push(
        `Revenue coverage is ${revenueCoveragePercent.toFixed(
          2,
        )}%.`,
      );
    }
  }

  const largestDebit =
    context.topDebits[0];

  if (
    largestDebit &&
    expenses > 0
  ) {
    const concentration =
      (
        largestDebit.amount /
        expenses
      ) * 100;

    if (concentration >= 45) {
      score += 12;

      addRisk(factors, {
        title:
          "Expense concentration is high",
        level: "MODERATE",
        scoreImpact: 12,
        message:
          `${largestDebit.description} represents about ${concentration.toFixed(
            1,
          )}% of approved debits.`,
        recommendation:
          "Verify, negotiate, reduce, or diversify the largest cost concentration.",
      });
    }
  }

  if (
    context.counts
      .excludedCurrencyEntries > 0
  ) {
    score += 5;

    addRisk(factors, {
      title:
        "Mixed-currency entries excluded",
      level: "MODERATE",
      scoreImpact: 5,
      message:
        `${context.counts.excludedCurrencyEntries} approved financial entr${
          context.counts
            .excludedCurrencyEntries === 1
            ? "y is"
            : "ies are"
        } excluded from ${context.currency} totals.`,
      recommendation:
        "Review each currency separately or add an explicit verified conversion workflow.",
    });
  }

  missingData.push(
    "Verified opening or closing cash balance is not stored, so runway is unavailable.",
  );

  if (
    context.monthly.observedMonths <
    3
  ) {
    missingData.push(
      "Less than three months of approved ledger history is available.",
    );
  }

  if (factors.length === 0) {
    strengths.push(
      "No major financial risk signal was detected from approved ledger entries.",
    );
  }

  recommendedActions.push(
    ...factors
      .sort(
        (first, second) =>
          second.scoreImpact -
          first.scoreImpact,
      )
      .slice(0, 5)
      .map(
        (factor) =>
          factor.recommendation,
      ),
  );

  if (
    recommendedActions.length === 0
  ) {
    recommendedActions.push(
      "Keep the ledger current and review financial risk monthly.",
    );
  }

  const finalScore =
    Math.round(
      clamp(score, 0, 100),
    );

  const level =
    getRiskLevel(
      finalScore,
    );

  const summary =
    context.counts
        .approvedFinancialEntries ===
      0
      ? "Aureli cannot calculate a reliable financial risk position until approved ledger entries are available."
      : level === "CRITICAL"
        ? `Critical risk is visible in approved ledger movement. Revenue is ${formatLedgerMoney(
            revenue,
            context.currency,
          )}, expenses are ${formatLedgerMoney(
            expenses,
            context.currency,
          )}, and net result is ${formatLedgerMoney(
            profit,
            context.currency,
          )}.`
        : level === "HIGH"
          ? "Approved ledger movement shows high financial risk. Prioritize break-even, review pending entries, and control major debits."
          : level === "MODERATE"
            ? "Approved ledger movement shows moderate risk that should be monitored and improved."
            : "Approved ledger movement currently shows low financial risk, subject to data confidence and missing cash balance.";

  return {
    generatedAt:
      new Date().toISOString(),
    score: finalScore,
    level,
    label:
      getRiskLabel(level),
    summary,

    metrics: {
      revenue:
        money(
          revenue,
          context.currency,
        ),
      expenses:
        money(
          expenses,
          context.currency,
        ),
      profit:
        money(
          profit,
          context.currency,
        ),
      cash:
        unavailableMoney(),
      assets:
        unavailableMoney(),
      liabilities:
        unavailableMoney(),
      profitMarginPercent,
      expenseRatioPercent,
      revenueCoveragePercent,
      debtToAssetPercent: null,
    },

    documentStatus: {
      totalDocuments:
        context.documents.total,
      processedDocuments:
        context.documents.processed,
      approvedDocuments:
        context.documents.approved,
      pendingReviewDocuments:
        context.counts
          .pendingEntries,
      rejectedDocuments:
        context.counts
          .rejectedEntries,
      failedDocuments:
        context.documents.failed,
    },

    riskFactors:
      factors.sort(
        (first, second) =>
          second.scoreImpact -
          first.scoreImpact,
      ),

    strengths:
      Array.from(
        new Set(strengths),
      ).slice(0, 8),

    recommendedActions:
      Array.from(
        new Set(
          recommendedActions,
        ),
      ).slice(0, 8),

    missingData:
      Array.from(
        new Set(missingData),
      ).slice(0, 8),
  };
}