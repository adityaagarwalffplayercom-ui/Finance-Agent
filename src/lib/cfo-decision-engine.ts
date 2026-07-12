import {
  formatLedgerMoney,
  formatLedgerPercent,
  getTrustedLedgerContext,
} from "./trusted-ledger-context";

type CfoTone =
  | "good"
  | "warning"
  | "danger"
  | "neutral";

export type CfoMetric = {
  label: string;
  value: string;
  hint: string;
  tone: CfoTone;
};

export type CfoScenario = {
  title: string;
  value: string;
  description: string;
  tone: CfoTone;
};

export type CfoAction = {
  priority:
    | "HIGH"
    | "MEDIUM"
    | "LOW";
  title: string;
  detail: string;
};

export type CfoDecisionPlan = {
  generatedAt: string;
  currency: string;
  summary: string;
  status:
    | "PROFITABLE"
    | "LOSS_MAKING"
    | "INSUFFICIENT_DATA";

  metrics: {
    revenue: number | null;
    expenses: number | null;
    profit: number | null;
    cash: number | null;
    breakEvenGap: number | null;
    monthlyExpenseEstimate:
      | number
      | null;
    cashRunwayMonths:
      | number
      | null;
    profitMarginPercent:
      | number
      | null;
    expenseRatioPercent:
      | number
      | null;
  };

  cards: CfoMetric[];
  scenarios: CfoScenario[];
  actions: CfoAction[];

  topExpenseSignals: {
    label: string;
    amount: number;
    source: string;
  }[];

  hiringDecision: {
    canHire: boolean;
    message: string;
    safeMonthlyHiringBudget:
      | number
      | null;
  };
};

export async function getCfoDecisionPlan(
  userId: string,
): Promise<CfoDecisionPlan> {
  const context =
    await getTrustedLedgerContext(
      userId,
    );

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

  const breakEvenGap =
    profit !== null &&
    profit < 0
      ? Math.abs(profit)
      : 0;

  const monthlyExpenseEstimate =
    context.monthly
      .averageExpenses;

  const monthlyProfit =
    context.monthly
      .averageProfit;

  const cashRunwayMonths:
    number | null = null;

  const profitMarginPercent =
    context.totals
      .profitMarginPercent;

  const expenseRatioPercent =
    context.totals
      .expenseRatioPercent;

  const status:
    CfoDecisionPlan["status"] =
    !hasData
      ? "INSUFFICIENT_DATA"
      : (profit ?? 0) >= 0
        ? "PROFITABLE"
        : "LOSS_MAKING";

  const expenseReductionNeededPercent =
    expenses !== null &&
    expenses > 0 &&
    breakEvenGap !== null
      ? (
          breakEvenGap /
          expenses
        ) * 100
      : null;

  const revenueIncreaseNeededPercent =
    revenue !== null &&
    revenue > 0 &&
    breakEvenGap !== null
      ? (
          breakEvenGap /
          revenue
        ) * 100
      : null;

  const targetProfit =
    revenue !== null &&
    revenue > 0
      ? revenue * 0.1
      : null;

  const targetProfitGap =
    targetProfit !== null &&
    profit !== null
      ? Math.max(
          0,
          targetProfit - profit,
        )
      : null;

  const topExpenseSignals =
    context.topDebits
      .slice(0, 6)
      .map((entry) => ({
        label:
          entry.description,
        amount: entry.amount,
        source:
          entry.documentId
            ? entry.sourceFileName
            : "Manual entry",
      }));

  const safeMonthlyHiringBudget =
    monthlyProfit !== null &&
    monthlyProfit > 0
      ? monthlyProfit * 0.25
      : null;

  /*
   * A positive operating surplus alone
   * is not enough to approve hiring.
   * Verified cash balance is intentionally
   * unavailable at this stage.
   */
  const canHire = false;

  const hiringMessage =
    safeMonthlyHiringBudget !== null &&
    context.monthly.observedMonths >=
      3
      ? `Operating surplus suggests a provisional monthly hiring ceiling near ${formatLedgerMoney(
          safeMonthlyHiringBudget,
          context.currency,
        )}, but hiring is not approved until a verified cash balance, recurring revenue stability, and payroll obligations are confirmed.`
      : "Hiring is not recommended yet. Build at least three months of approved ledger history, maintain positive monthly surplus, and verify the current cash balance first.";

  const cards: CfoMetric[] = [
    {
      label:
        "Break-even gap",
      value:
        formatLedgerMoney(
          breakEvenGap,
          context.currency,
        ),
      hint:
        breakEvenGap &&
        breakEvenGap > 0
          ? "Approved improvement required to reach zero profit/loss"
          : "Approved ledger is at or above break-even",
      tone:
        breakEvenGap &&
        breakEvenGap > 0
          ? "danger"
          : "good",
    },
    {
      label:
        "Profit margin",
      value:
        formatLedgerPercent(
          profitMarginPercent,
        ),
      hint:
        "Approved ledger profit divided by approved credits",
      tone:
        profitMarginPercent ===
        null
          ? "neutral"
          : profitMarginPercent >=
              10
            ? "good"
            : profitMarginPercent >=
                0
              ? "warning"
              : "danger",
    },
    {
      label:
        "Expense ratio",
      value:
        formatLedgerPercent(
          expenseRatioPercent,
        ),
      hint:
        "Approved debits compared with approved credits",
      tone:
        expenseRatioPercent ===
        null
          ? "neutral"
          : expenseRatioPercent <=
              80
            ? "good"
            : expenseRatioPercent <=
                100
              ? "warning"
              : "danger",
    },
    {
      label:
        "Cash runway",
      value:
        "Not available",
      hint:
        "Verified opening or closing cash balance is required",
      tone: "neutral",
    },
  ];

  const scenarios: CfoScenario[] = [
    {
      title:
        "Break even by reducing expenses",
      value:
        expenseReductionNeededPercent ===
        null
          ? "Not available"
          : `${expenseReductionNeededPercent.toFixed(
              2,
            )}% cut`,
      description:
        breakEvenGap &&
        breakEvenGap > 0
          ? `Reduce approved-period debits by ${formatLedgerMoney(
              breakEvenGap,
              context.currency,
            )} if credits stay unchanged.`
          : "No debit reduction is required for break-even from the current approved totals.",
      tone:
        breakEvenGap &&
        breakEvenGap > 0
          ? "warning"
          : "good",
    },
    {
      title:
        "Break even by increasing revenue",
      value:
        revenueIncreaseNeededPercent ===
        null
          ? "Not available"
          : `${revenueIncreaseNeededPercent.toFixed(
              2,
            )}% growth`,
      description:
        breakEvenGap &&
        breakEvenGap > 0
          ? `Increase approved-period credits by ${formatLedgerMoney(
              breakEvenGap,
              context.currency,
            )} if debits stay unchanged.`
          : "Current approved totals already show break-even or profit.",
      tone:
        breakEvenGap &&
        breakEvenGap > 0
          ? "warning"
          : "good",
    },
    {
      title:
        "Balanced CFO plan",
      value:
        breakEvenGap &&
        breakEvenGap > 0
          ? `${formatLedgerMoney(
              breakEvenGap / 2,
              context.currency,
            )} + ${formatLedgerMoney(
              breakEvenGap / 2,
              context.currency,
            )}`
          : "Protect margin",
      description:
        breakEvenGap &&
        breakEvenGap > 0
          ? "Close half the gap through cost control and half through improved credits."
          : "Protect margin and verify cash before scaling.",
      tone:
        breakEvenGap &&
        breakEvenGap > 0
          ? "warning"
          : "good",
    },
    {
      title:
        "Target 10% profit margin",
      value:
        formatLedgerMoney(
          targetProfitGap,
          context.currency,
        ),
      description:
        targetProfitGap !== null
          ? "Additional approved-period improvement required to reach an estimated 10% margin."
          : "Approved revenue and profit are required.",
      tone:
        targetProfitGap === null
          ? "neutral"
          : targetProfitGap > 0
            ? "warning"
            : "good",
    },
  ];

  const actions: CfoAction[] = [];

  if (!hasData) {
    actions.push({
      priority: "HIGH",
      title:
        "Build the trusted ledger",
      detail:
        "Sync approved documents and approve verified credit and debit entries.",
    });
  }

  if (
    breakEvenGap &&
    breakEvenGap > 0
  ) {
    actions.push({
      priority: "HIGH",
      title:
        "Close the break-even gap",
      detail:
        `Approved ledger loss is ${formatLedgerMoney(
          breakEvenGap,
          context.currency,
        )}. Avoid expansion until a quantified plan closes it.`,
    });
  }

  if (
    expenseRatioPercent !== null &&
    expenseRatioPercent > 100
  ) {
    actions.push({
      priority: "HIGH",
      title:
        "Bring debits below credits",
      detail:
        "Start with fixed and recurring debit categories because they keep the business below break-even.",
    });
  }

  if (
    context.counts
      .pendingEntries > 0
  ) {
    actions.push({
      priority: "HIGH",
      title:
        "Complete pending ledger review",
      detail:
        `${context.counts.pendingEntries} entr${
          context.counts
            .pendingEntries === 1
            ? "y is"
            : "ies are"
        } excluded from CFO calculations.`,
    });
  }

  if (
    topExpenseSignals.length > 0
  ) {
    actions.push({
      priority: "MEDIUM",
      title:
        "Review largest debit signals",
      detail:
        `Start with ${topExpenseSignals
          .slice(0, 3)
          .map(
            (item) =>
              item.label,
          )
          .join(", ")}.`,
    });
  }

  actions.push({
    priority: "MEDIUM",
    title:
      "Verify cash before fixed commitments",
    detail:
      "Current ledger measures movement, not verified bank cash. Confirm the current balance before hiring, borrowing, or expansion.",
  });

  const summary =
    !hasData
      ? "CFO decisions require approved credit and debit ledger entries."
      : (profit ?? 0) >= 0
        ? `Approved ledger shows profit of ${formatLedgerMoney(
            profit,
            context.currency,
          )}. Focus on margin quality, recurring revenue, and cash verification before growth.`
        : `Approved ledger is below break-even by ${formatLedgerMoney(
            breakEvenGap,
            context.currency,
          )}. Reduce debits, improve credits, and avoid new fixed commitments.`;

  return {
    generatedAt:
      new Date().toISOString(),
    currency:
      context.currency,
    summary,
    status,

    metrics: {
      revenue,
      expenses,
      profit,
      cash,
      breakEvenGap,
      monthlyExpenseEstimate,
      cashRunwayMonths,
      profitMarginPercent,
      expenseRatioPercent,
    },

    cards,
    scenarios,
    actions,
    topExpenseSignals,

    hiringDecision: {
      canHire,
      message:
        hiringMessage,
      safeMonthlyHiringBudget,
    },
  };
}