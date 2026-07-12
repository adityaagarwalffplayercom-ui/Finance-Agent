import {
  formatLedgerMoney,
  getTrustedLedgerContext,
} from "./trusted-ledger-context";
import {
  getAnomalyInsightsReport,
} from "./anomaly-insights-engine";

export type DecisionPriority =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export type DecisionCategory =
  | "CASH_FLOW"
  | "PROFIT"
  | "RISK"
  | "DOCUMENTS"
  | "TAX"
  | "ANOMALY"
  | "GROWTH";

export type DecisionAction = {
  id: string;
  priority: DecisionPriority;
  category: DecisionCategory;
  title: string;
  problem: string;
  action: string;
  expectedImpact: string;
  timeframe:
    | "TODAY"
    | "THIS_WEEK"
    | "THIS_MONTH";
  confidence:
    | "HIGH"
    | "MEDIUM"
    | "LOW";
};

export type DecisionCenterReport = {
  generatedAt: string;
  currency: string;
  executiveSummary: string;
  ownerFocus: string;
  overallStatus:
    | "STABLE"
    | "WATCH"
    | "URGENT"
    | "INSUFFICIENT_DATA";
  score: number;

  metrics: {
    revenue: number | null;
    expenses: number | null;
    profit: number | null;
    cash: number | null;
    profitMarginPercent:
      | number
      | null;
    expenseRatioPercent:
      | number
      | null;
    estimatedMonthlyBurn:
      | number
      | null;
    estimatedRunwayMonths:
      | number
      | null;
    approvedDocuments: number;
    processedDocuments: number;
    rejectedDocuments: number;
    failedDocuments: number;
    totalLineItems: number;
    suspiciousLineItems: number;
  };

  topActions: DecisionAction[];
  todayActions: DecisionAction[];
  weekActions: DecisionAction[];
  monthActions: DecisionAction[];
  decisionWarnings: string[];
  missingData: string[];
};

function priorityWeight(
  priority: DecisionPriority,
) {
  if (priority === "CRITICAL") {
    return 4;
  }

  if (priority === "HIGH") {
    return 3;
  }

  if (priority === "MEDIUM") {
    return 2;
  }

  return 1;
}

function uniqueActions(
  actions: DecisionAction[],
) {
  const seen = new Set<string>();

  return actions.filter(
    (action) => {
      const key =
        `${action.category}-${action.title}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    },
  );
}

export async function getDecisionCenterReport(
  userId: string,
): Promise<DecisionCenterReport> {
  const [context, anomaly] =
    await Promise.all([
      getTrustedLedgerContext(
        userId,
      ),
      getAnomalyInsightsReport(
        userId,
      ),
    ]);

  const hasData =
    context.counts
      .approvedFinancialEntries > 0;

  const revenue =
    hasData
      ? context.totals.revenue
      : null;

  const expenses =
    hasData
      ? context.totals.expenses
      : null;

  const profit =
    hasData
      ? context.totals.profit
      : null;

  const cash: number | null =
    null;

  const profitMarginPercent =
    context.totals
      .profitMarginPercent;

  const expenseRatioPercent =
    context.totals
      .expenseRatioPercent;

  const estimatedMonthlyBurn =
    context.monthly.burnRate;

  const estimatedRunwayMonths:
    number | null = null;

  const suspiciousLineItems =
    anomaly.anomalies.filter(
      (item) =>
        item.severity ===
          "HIGH" ||
        item.severity ===
          "MEDIUM",
    ).length;

  const missingData: string[] = [];

  if (!hasData) {
    missingData.push(
      "Approved credit and debit ledger entries are missing.",
    );
  }

  if (
    context.counts
      .pendingEntries > 0
  ) {
    missingData.push(
      `${context.counts.pendingEntries} ledger entries remain pending review.`,
    );
  }

  if (
    context.monthly.observedMonths <
    3
  ) {
    missingData.push(
      "Less than three months of approved ledger history is available.",
    );
  }

  missingData.push(
    "Verified cash balance is not stored, so runway cannot be calculated.",
  );

  const actions:
    DecisionAction[] = [];

  if (!hasData) {
    actions.push({
      id:
        "ledger-first",
      priority: "CRITICAL",
      category: "DOCUMENTS",
      title:
        "Build and approve the transaction ledger",
      problem:
        "Aureli cannot make reliable owner-level financial decisions without approved credit and debit entries.",
      action:
        "Sync approved documents, add missing manual transactions, and review every pending ledger entry.",
      expectedImpact:
        "Creates one trusted financial source for Dashboard, CFO, Risk, Forecast, Cash Flow, Anomaly, and AI Chat.",
      timeframe: "TODAY",
      confidence: "HIGH",
    });
  }

  if (
    context.counts
      .pendingEntries > 0
  ) {
    actions.push({
      id:
        "complete-ledger-review",
      priority: "HIGH",
      category: "DOCUMENTS",
      title:
        "Complete pending ledger review",
      problem:
        `${context.counts.pendingEntries} entr${
          context.counts
            .pendingEntries === 1
            ? "y is"
            : "ies are"
        } excluded from every trusted financial calculation.`,
      action:
        "Approve verified entries and reject duplicates or incorrect extractions.",
      expectedImpact:
        "Improves completeness and confidence across all finance modules.",
      timeframe: "TODAY",
      confidence: "HIGH",
    });
  }

  if (
    profit !== null &&
    profit < 0
  ) {
    actions.push({
      id: "fix-loss",
      priority: "CRITICAL",
      category: "PROFIT",
      title:
        "Close the break-even gap before scaling",
      problem:
        `Approved ledger loss is ${formatLedgerMoney(
          Math.abs(profit),
          context.currency,
        )}.`,
      action:
        "Reduce recurring debits, improve recurring credits, and avoid new fixed commitments until monthly movement becomes positive.",
      expectedImpact:
        "Improves break-even position and reduces owner-level financial risk.",
      timeframe: "TODAY",
      confidence:
        context.confidence
            .level === "LOW"
          ? "MEDIUM"
          : "HIGH",
    });
  }

  if (
    expenseRatioPercent !== null &&
    expenseRatioPercent > 100
  ) {
    actions.push({
      id:
        "expense-ratio-high",
      priority: "HIGH",
      category: "PROFIT",
      title:
        "Bring approved debits below approved credits",
      problem:
        `Expense ratio is ${expenseRatioPercent.toFixed(
          1,
        )}%.`,
      action:
        "Review the largest recurring debit categories and set a quantified reduction target.",
      expectedImpact:
        "Moves the business toward break-even and protects future margin.",
      timeframe:
        "THIS_WEEK",
      confidence: "HIGH",
    });
  }

  if (
    context.monthly
      .averageProfit !== null &&
    context.monthly
      .averageProfit < 0
  ) {
    actions.push({
      id:
        "negative-monthly-movement",
      priority: "HIGH",
      category: "CASH_FLOW",
      title:
        "Restore positive monthly movement",
      problem:
        `Average monthly net movement is ${formatLedgerMoney(
          context.monthly
            .averageProfit,
          context.currency,
        )}.`,
      action:
        "Reduce monthly outflow or improve recurring inflow by at least the negative monthly gap.",
      expectedImpact:
        "Reduces ongoing burn and improves operating resilience.",
      timeframe:
        "THIS_WEEK",
      confidence:
        context.monthly
            .observedMonths >= 3
          ? "HIGH"
          : "MEDIUM",
    });
  }

  if (
    suspiciousLineItems > 0
  ) {
    actions.push({
      id:
        "review-anomalies",
      priority: "HIGH",
      category: "ANOMALY",
      title:
        "Review unusual approved ledger entries",
      problem:
        `${suspiciousLineItems} high or medium anomaly signal${
          suspiciousLineItems === 1
            ? " was"
            : "s were"
        } detected.`,
      action:
        "Open Anomaly Insights and verify high-value, duplicate-looking, and concentrated debit entries.",
      expectedImpact:
        "Reduces leakage, duplicate counting, and unreliable decisions.",
      timeframe:
        "THIS_WEEK",
      confidence:
        context.confidence
            .level === "LOW"
          ? "LOW"
          : "MEDIUM",
    });
  }

  if (
    context.counts
      .excludedCurrencyEntries > 0
  ) {
    actions.push({
      id:
        "mixed-currency-review",
      priority: "MEDIUM",
      category: "RISK",
      title:
        "Review mixed-currency entries separately",
      problem:
        `${context.counts.excludedCurrencyEntries} approved financial entr${
          context.counts
            .excludedCurrencyEntries === 1
            ? "y is"
            : "ies are"
        } excluded from ${context.currency} totals.`,
      action:
        "Do not combine currencies until a verified conversion method and date are recorded.",
      expectedImpact:
        "Prevents distorted revenue, expense, and profit calculations.",
      timeframe:
        "THIS_WEEK",
      confidence: "HIGH",
    });
  }

  if (
    profit !== null &&
    profit >= 0 &&
    profitMarginPercent !== null &&
    profitMarginPercent < 5
  ) {
    actions.push({
      id: "thin-margin",
      priority: "MEDIUM",
      category: "GROWTH",
      title:
        "Improve the thin profit margin",
      problem:
        `Approved profit margin is ${profitMarginPercent.toFixed(
          1,
        )}%.`,
      action:
        "Test pricing, reduce low-value costs, and focus on higher-margin revenue streams.",
      expectedImpact:
        "Improves profit quality without requiring uncontrolled expansion.",
      timeframe:
        "THIS_MONTH",
      confidence: "MEDIUM",
    });
  }

  actions.push({
    id:
      "verify-cash-balance",
    priority:
      profit !== null &&
      profit < 0
        ? "HIGH"
        : "MEDIUM",
    category: "CASH_FLOW",
    title:
      "Verify the current bank cash balance",
    problem:
      "The ledger measures approved movement, but it does not store a verified opening or closing cash balance.",
    action:
      "Add a verified cash-balance workflow before relying on runway, hiring, borrowing, or liquidity conclusions.",
    expectedImpact:
      "Enables responsible cash-runway and liquidity decisions.",
    timeframe:
      "THIS_WEEK",
    confidence: "HIGH",
  });

  const topActions =
    uniqueActions(actions).sort(
      (first, second) =>
        priorityWeight(
          second.priority,
        ) -
        priorityWeight(
          first.priority,
        ),
    );

  const todayActions =
    topActions.filter(
      (action) =>
        action.timeframe ===
        "TODAY",
    );

  const weekActions =
    topActions.filter(
      (action) =>
        action.timeframe ===
        "THIS_WEEK",
    );

  const monthActions =
    topActions.filter(
      (action) =>
        action.timeframe ===
        "THIS_MONTH",
    );

  const decisionWarnings:
    string[] = [];

  if (
    context.confidence.level ===
    "LOW"
  ) {
    decisionWarnings.push(
      `Data confidence is low at ${context.confidence.score}/100.`,
    );
  }

  if (
    context.counts
      .pendingEntries > 0
  ) {
    decisionWarnings.push(
      "Pending ledger entries are excluded from all totals and decisions.",
    );
  }

  if (profit !== null && profit < 0) {
    decisionWarnings.push(
      "Avoid hiring or expansion until the loss and monthly burn are controlled.",
    );
  }

  decisionWarnings.push(
    "Cash runway is unavailable until a verified bank cash balance is stored.",
  );

  const riskPenalty =
    (!hasData ? 70 : 0) +
    (
      profit !== null &&
      profit < 0
        ? 25
        : 0
    ) +
    (
      context.monthly
          .averageProfit !==
        null &&
      context.monthly
        .averageProfit < 0
        ? 15
        : 0
    ) +
    (
      context.confidence
          .level === "LOW"
        ? 15
        : 0
    ) +
    (
      context.counts
          .pendingEntries >
        0
        ? 10
        : 0
    ) +
    (
      suspiciousLineItems > 0
        ? 10
        : 0
    );

  const score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        100 - riskPenalty,
      ),
    ),
  );

  const overallStatus:
    DecisionCenterReport["overallStatus"] =
    !hasData
      ? "INSUFFICIENT_DATA"
      : score < 45
        ? "URGENT"
        : score < 70
          ? "WATCH"
          : "STABLE";

  const ownerFocus =
    topActions[0]?.title ??
    "Keep the trusted ledger current.";

  const executiveSummary =
    overallStatus ===
    "INSUFFICIENT_DATA"
      ? "Decision Center needs approved ledger evidence before it can prioritize financial actions."
      : overallStatus ===
          "URGENT"
        ? "Approved ledger movement shows urgent owner-level issues. Fix loss, monthly burn, review gaps, or anomalies before growth."
        : overallStatus ===
            "WATCH"
          ? "Approved ledger movement needs attention. Follow the highest-priority actions before making major commitments."
          : "Approved ledger movement is stable. Continue monitoring margin, anomalies, and data confidence.";

  return {
    generatedAt:
      new Date().toISOString(),
    currency:
      context.currency,
    executiveSummary,
    ownerFocus,
    overallStatus,
    score,

    metrics: {
      revenue,
      expenses,
      profit,
      cash,
      profitMarginPercent,
      expenseRatioPercent,
      estimatedMonthlyBurn,
      estimatedRunwayMonths,
      approvedDocuments:
        context.counts
          .approvedFinancialEntries,
      processedDocuments:
        context.counts
          .totalEntries,
      rejectedDocuments:
        context.counts
          .rejectedEntries,
      failedDocuments:
        context.documents.failed,
      totalLineItems:
        context.counts
          .approvedFinancialEntries,
      suspiciousLineItems,
    },

    topActions,
    todayActions,
    weekActions,
    monthActions,
    decisionWarnings,
    missingData,
  };
}

export function formatDecisionMoney(
  value: number | null,
  currency: string,
) {
  return formatLedgerMoney(
    value,
    currency,
  );
}