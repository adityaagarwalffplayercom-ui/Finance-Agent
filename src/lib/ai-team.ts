import {
  formatLedgerMoney,
  formatLedgerPercent,
  getTrustedLedgerContext,
} from "./trusted-ledger-context";
import {
  getJurisdictionProfile,
} from "./agent-governance";

export type AiAgentStatus =
  | "active"
  | "waiting"
  | "warning"
  | "critical";

export type AiAgent = {
  id: string;
  name: string;
  title: string;
  status: AiAgentStatus;
  statusLabel: string;
  summary: string;
  focusAreas: string[];
  currentFindings: string[];
  recommendedActions: string[];
  confidenceLabel: string;
};

export type AiTeamOverview = {
  businessName: string;

  /*
   * Kept for current UI compatibility.
   * These values now represent ledger
   * trust counts rather than document
   * totals.
   */
  trustedDocuments: number;
  pendingReview: number;
  rejectedDocuments: number;
  processedDocuments: number;
  totalDocuments: number;

  agents: AiAgent[];
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

function unique(
  values: Array<
    string | null | undefined | false
  >,
) {
  return Array.from(
    new Set(
      values.filter(
        Boolean,
      ) as string[],
    ),
  ).slice(0, 5);
}

function waitingAgent(params: {
  id: string;
  name: string;
  title: string;
  summary: string;
  focusAreas: string[];
}): AiAgent {
  return {
    id: params.id,
    name: params.name,
    title: params.title,
    status: "waiting",
    statusLabel:
      "Waiting for approved ledger data",
    summary: params.summary,
    focusAreas:
      params.focusAreas,
    currentFindings: [
      "No approved credit or debit ledger entries are available.",
      "Pending and rejected entries are not used as financial facts.",
    ],
    recommendedActions: [
      "Sync approved documents to the Transaction Ledger.",
      "Review pending entries and approve only verified rows.",
      "Add missing offline transactions manually.",
    ],
    confidenceLabel:
      "Low confidence until ledger entries are approved",
  };
}

function buildWaitingAgents() {
  return [
    waitingAgent({
      id: "cfo",
      name: "CFO Agent",
      title:
        "Executive finance decision maker",
      summary:
        "Monitors profitability, break-even, hiring safety, and owner-level decisions.",
      focusAreas: [
        "Profitability",
        "Break-even",
        "Hiring",
        "Financial health",
      ],
    }),
    waitingAgent({
      id: "accountant",
      name: "Accountant Agent",
      title:
        "Ledger and document control",
      summary:
        "Checks approved, pending, rejected, manual, and source-linked entries.",
      focusAreas: [
        "Ledger review",
        "Entry quality",
        "Source evidence",
        "Record completeness",
      ],
    }),
    waitingAgent({
      id: "tax",
      name: "Tax Agent",
      title:
        "Tax readiness and compliance review",
      summary:
        "Uses verified tax rules and approved source documents for conservative tax readiness.",
      focusAreas: [
        "Tax coverage",
        "Verified rules",
        "Tax documents",
        "Professional review",
      ],
    }),
    waitingAgent({
      id: "analyst",
      name:
        "Financial Analyst Agent",
      title:
        "Trend and anomaly analysis",
      summary:
        "Analyzes approved ledger movement, ratios, categories, and unusual entries.",
      focusAreas: [
        "Monthly trends",
        "Largest entries",
        "Duplicates",
        "Cost concentration",
      ],
    }),
    waitingAgent({
      id: "cashflow",
      name:
        "Cash Flow Agent",
      title:
        "Cash movement monitor",
      summary:
        "Tracks approved inflows, outflows, monthly net movement, and burn.",
      focusAreas: [
        "Inflows",
        "Outflows",
        "Monthly movement",
        "Burn",
      ],
    }),
    waitingAgent({
      id: "consultant",
      name:
        "Business Consultant Agent",
      title:
        "Growth and cost-control advisor",
      summary:
        "Turns trusted financial movement into practical operating actions.",
      focusAreas: [
        "Pricing",
        "Cost control",
        "Growth",
        "Operations",
      ],
    }),
    waitingAgent({
      id: "risk",
      name:
        "Risk & Compliance Agent",
      title:
        "Financial risk guardrail",
      summary:
        "Flags losses, weak coverage, pending review, missing cash evidence, and unusual entries.",
      focusAreas: [
        "Risk",
        "Data confidence",
        "Missing evidence",
        "Mitigation",
      ],
    }),
  ];
}

export async function getAiTeam(
  userId: string,
): Promise<AiTeamOverview> {
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

  if (
    context.counts
      .approvedFinancialEntries === 0
  ) {
    return {
      businessName:
        context.business.name,
      trustedDocuments: 0,
      pendingReview:
        context.counts
          .pendingEntries,
      rejectedDocuments:
        context.counts
          .rejectedEntries,
      processedDocuments:
        context.counts
          .totalEntries,
      totalDocuments:
        context.counts
          .totalEntries,
      agents:
        buildWaitingAgents(),
    };
  }

  let healthScore = 62;

  healthScore +=
    profit >= 0 ? 18 : -26;

  if (
    expenseRatioPercent !== null
  ) {
    if (
      expenseRatioPercent <= 80
    ) {
      healthScore += 10;
    } else if (
      expenseRatioPercent > 100
    ) {
      healthScore -= 16;
    }
  }

  healthScore -= Math.min(
    context.counts
      .pendingEntries * 2,
    14,
  );

  if (
    context.confidence.level ===
    "LOW"
  ) {
    healthScore -= 8;
  }

  healthScore = Math.round(
    clamp(
      healthScore,
      0,
      100,
    ),
  );

  const riskLevel =
    healthScore >= 75
      ? "LOW"
      : healthScore >= 55
        ? "MODERATE"
        : healthScore >= 35
          ? "HIGH"
          : "CRITICAL";

  const cfoStatus:
    AiAgentStatus =
    riskLevel === "CRITICAL"
      ? "critical"
      : riskLevel === "HIGH"
        ? "warning"
        : "active";

  const analystStatus:
    AiAgentStatus =
    profit < 0 ||
    (
      revenueCoveragePercent !==
        null &&
      revenueCoveragePercent <
        100
    )
      ? "warning"
      : "active";

  const cashStatus:
    AiAgentStatus =
    context.monthly
      .averageProfit !== null &&
    context.monthly
      .averageProfit < 0
      ? "warning"
      : "active";

  const riskStatus:
    AiAgentStatus =
    context.counts
      .pendingEntries > 0 ||
    context.counts
      .rejectedEntries > 0 ||
    context.confidence.level ===
      "LOW"
      ? "warning"
      : "active";

  const jurisdiction =
    getJurisdictionProfile(
      context.business.country,
    );

  const confidenceText =
    `${context.confidence.label} (${context.confidence.score}/100) based on ${context.counts.approvedFinancialEntries} approved ledger entr${
      context.counts
        .approvedFinancialEntries === 1
        ? "y"
        : "ies"
    } across ${context.monthly.observedMonths} month${
      context.monthly
        .observedMonths === 1
        ? ""
        : "s"
    }`;

  const breakEvenGap =
    Math.max(0, -profit);

  const topDebitNames =
    context.topDebits
      .slice(0, 3)
      .map(
        (entry) =>
          entry.description,
      );

  const agents: AiAgent[] = [
    {
      id: "cfo",
      name: "CFO Agent",
      title:
        "Executive finance decision maker",
      status: cfoStatus,
      statusLabel:
        cfoStatus === "active"
          ? "Monitoring trusted profitability"
          : cfoStatus ===
              "critical"
            ? "Critical action needed"
            : "Management attention needed",
      summary:
        "Uses approved ledger credits and debits for profitability, break-even, hiring, and financial decisions.",
      focusAreas: [
        "Health score",
        "Profitability",
        "Break-even",
        "Hiring safety",
      ],
      currentFindings: [
        `Ledger health score is ${healthScore}/100.`,
        `Approved credits are ${formatLedgerMoney(
          revenue,
          context.currency,
        )}.`,
        `Approved debits are ${formatLedgerMoney(
          expenses,
          context.currency,
        )}.`,
        profit >= 0
          ? `Approved ledger profit is ${formatLedgerMoney(
              profit,
              context.currency,
            )}.`
          : `Approved ledger loss is ${formatLedgerMoney(
              Math.abs(profit),
              context.currency,
            )}.`,
      ],
      recommendedActions:
        unique([
          breakEvenGap > 0
            ? `Close the break-even gap of ${formatLedgerMoney(
                breakEvenGap,
                context.currency,
              )}.`
            : "Protect current profitability and margin.",
          context.counts
              .pendingEntries >
            0
            ? "Complete pending ledger review before major commitments."
            : "Keep the approved ledger current.",
          "Do not approve hiring from profit alone; verify cash balance and recurring revenue first.",
        ]),
      confidenceLabel:
        confidenceText,
    },

    {
      id: "accountant",
      name:
        "Accountant Agent",
      title:
        "Ledger and document control",
      status:
        context.counts
          .pendingEntries > 0
          ? "warning"
          : "active",
      statusLabel:
        context.counts
          .pendingEntries > 0
          ? "Ledger entries need review"
          : "Trusted ledger is reviewed",
      summary:
        "Checks transaction approval, source evidence, manual entries, currencies, dates, and record quality.",
      focusAreas: [
        "Approval status",
        "Source evidence",
        "Manual entries",
        "Record quality",
      ],
      currentFindings: [
        `${context.counts.approvedFinancialEntries} approved financial ledger entr${
          context.counts
            .approvedFinancialEntries ===
          1
            ? "y is"
            : "ies are"
        } used in totals.`,
        `${context.counts.pendingEntries} ledger entr${
          context.counts
            .pendingEntries === 1
            ? "y is"
            : "ies are"
        } pending review.`,
        `${context.counts.rejectedEntries} rejected entr${
          context.counts
            .rejectedEntries === 1
            ? "y is"
            : "ies are"
        } excluded.`,
        `${context.counts.manualApprovedEntries} approved manual entr${
          context.counts
            .manualApprovedEntries === 1
            ? "y is"
            : "ies are"
        } included.`,
      ],
      recommendedActions:
        unique([
          context.counts
              .pendingEntries >
            0
            ? "Approve or reject every pending ledger entry."
            : "Continue reviewing every new synced entry.",
          context.counts
              .excludedCurrencyEntries >
            0
            ? "Review mixed-currency entries separately."
            : "Keep transaction currency consistent.",
          "Add missing dates, counterparties, and categories.",
        ]),
      confidenceLabel:
        confidenceText,
    },

    {
      id: "tax",
      name: "Tax Agent",
      title:
        "Tax readiness and compliance review",
      status:
        context.documents
            .approved > 0 &&
        context.business.country !==
          "Not set"
          ? "active"
          : "warning",
      statusLabel:
        context.documents
            .approved > 0
          ? "Tax checklist evidence available"
          : "Tax source documents needed",
      summary:
        "Uses verified tax rules, verified tax knowledge, approved source documents, and ledger evidence conservatively.",
      focusAreas: [
        "Jurisdiction",
        "Verified tax rules",
        "Tax source documents",
        "Professional verification",
      ],
      currentFindings: [
        `Business jurisdiction maps to ${jurisdiction.name}.`,
        `${context.documents.approved} approved source document${
          context.documents
            .approved === 1
            ? " is"
            : "s are"
        } available.`,
        "Approved ledger entries support transaction evidence but do not determine final tax payable.",
      ],
      recommendedActions:
        unique([
          "Use Tax Agent for readiness and document checklist, not final certification.",
          "Upload verified GST/VAT, payroll, invoice, and filing evidence.",
          `Verify final filing and liability with a ${jurisdiction.professionalReviewLabel}.`,
        ]),
      confidenceLabel:
        "Tax confidence depends on verified official rules and source coverage, not ledger totals alone",
    },

    {
      id: "analyst",
      name:
        "Financial Analyst Agent",
      title:
        "Performance and anomaly analysis",
      status:
        analystStatus,
      statusLabel:
        analystStatus === "active"
          ? "Analyzing trusted movement"
          : "Performance needs attention",
      summary:
        "Analyzes approved ledger trends, ratios, largest entries, duplicates, and cost concentration.",
      focusAreas: [
        "Profit margin",
        "Expense ratio",
        "Monthly trends",
        "Anomalies",
      ],
      currentFindings: [
        `Profit margin is ${formatLedgerPercent(
          profitMarginPercent,
        )}.`,
        `Expense ratio is ${formatLedgerPercent(
          expenseRatioPercent,
        )}.`,
        `Revenue coverage is ${formatLedgerPercent(
          revenueCoveragePercent,
        )}.`,
        context.monthly
            .latestNet !== null
          ? `Latest monthly net movement is ${formatLedgerMoney(
              context.monthly
                .latestNet,
              context.currency,
            )}.`
          : "More dated entries are required for a monthly trend.",
      ],
      recommendedActions:
        unique([
          topDebitNames.length > 0
            ? `Review the largest debits: ${topDebitNames.join(
                ", ",
              )}.`
            : "Add approved debit entries for cost analysis.",
          profit < 0
            ? "Prioritize cost reduction and revenue coverage."
            : "Protect margin while monitoring expense growth.",
          "Review duplicate-looking and high-value entries in Anomaly Insights.",
        ]),
      confidenceLabel:
        confidenceText,
    },

    {
      id: "cashflow",
      name:
        "Cash Flow Agent",
      title:
        "Cash movement monitor",
      status:
        cashStatus,
      statusLabel:
        cashStatus === "active"
          ? "Monitoring approved movement"
          : "Negative movement needs attention",
      summary:
        "Tracks approved monthly credits, debits, net movement, and burn without inventing a cash balance.",
      focusAreas: [
        "Monthly inflow",
        "Monthly outflow",
        "Net movement",
        "Burn",
      ],
      currentFindings: [
        `Average monthly credits are ${formatLedgerMoney(
          context.monthly
            .averageRevenue,
          context.currency,
        )}.`,
        `Average monthly debits are ${formatLedgerMoney(
          context.monthly
            .averageExpenses,
          context.currency,
        )}.`,
        `Average monthly net movement is ${formatLedgerMoney(
          context.monthly
            .averageProfit,
          context.currency,
        )}.`,
        "Verified cash balance and runway are not available.",
      ],
      recommendedActions:
        unique([
          context.monthly
              .averageProfit !==
              null &&
            context.monthly
              .averageProfit < 0
            ? "Reduce monthly outflow or increase recurring inflow."
            : "Maintain positive monthly movement.",
          "Upload and verify a current bank balance before using runway.",
          "Keep transaction dates complete for monthly analysis.",
        ]),
      confidenceLabel:
        confidenceText,
    },

    {
      id: "consultant",
      name:
        "Business Consultant Agent",
      title:
        "Growth and cost-control advisor",
      status:
        profit < 0
          ? "warning"
          : "active",
      statusLabel:
        profit < 0
          ? "Cost control recommended"
          : "Controlled growth possible",
      summary:
        "Turns trusted ledger performance into practical pricing, cost, growth, and operating actions.",
      focusAreas: [
        "Pricing",
        "Cost control",
        "Revenue improvement",
        "Operations",
      ],
      currentFindings: [
        profit < 0
          ? "Loss control should come before aggressive expansion."
          : "Approved ledger movement is profitable.",
        expenses > revenue
          ? "Approved debits are higher than approved credits."
          : "Approved credits cover approved debits.",
        topDebitNames.length > 0
          ? `Largest debit signals include ${topDebitNames.join(
              ", ",
            )}.`
          : "More debit detail is needed.",
      ],
      recommendedActions:
        unique([
          profit < 0
            ? "Create a break-even plan before scaling."
            : "Test controlled growth scenarios.",
          "Review pricing and the largest recurring cost categories.",
          "Use Forecast and CFO Decisions before hiring or expansion.",
        ]),
      confidenceLabel:
        confidenceText,
    },

    {
      id: "risk",
      name:
        "Risk & Compliance Agent",
      title:
        "Financial risk guardrail",
      status:
        riskStatus,
      statusLabel:
        riskStatus === "active"
          ? "No major ledger trust issue"
          : "Review and verification needed",
      summary:
        "Flags loss, weak coverage, pending entries, mixed currencies, missing cash evidence, and low data confidence.",
      focusAreas: [
        "Pending review",
        "Loss risk",
        "Data confidence",
        "Missing evidence",
      ],
      currentFindings:
        unique([
          `Current financial risk level is ${riskLevel}.`,
          context.counts
              .pendingEntries >
            0
            ? `${context.counts.pendingEntries} ledger entries remain pending.`
            : "No ledger entries are pending.",
          context.counts
              .excludedCurrencyEntries >
            0
            ? `${context.counts.excludedCurrencyEntries} different-currency approved entries are excluded.`
            : "No mixed-currency exclusion is affecting totals.",
          "Cash balance and runway remain unverified.",
        ]),
      recommendedActions:
        unique([
          context.counts
              .pendingEntries >
            0
            ? "Complete ledger review before relying on final decisions."
            : "Keep review status current.",
          profit < 0
            ? "Close the loss and break-even gap."
            : "Maintain current coverage and monitor monthly changes.",
          "Do not treat AI output as legal, audit, tax, or compliance certification.",
        ]),
      confidenceLabel:
        confidenceText,
    },
  ];

  return {
    businessName:
      context.business.name,
    trustedDocuments:
      context.counts
        .approvedFinancialEntries,
    pendingReview:
      context.counts
        .pendingEntries,
    rejectedDocuments:
      context.counts
        .rejectedEntries,
    processedDocuments:
      context.counts
        .totalEntries,
    totalDocuments:
      context.counts
        .totalEntries,
    agents,
  };
}