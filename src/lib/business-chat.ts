import { GoogleGenAI } from "@google/genai";
import { prisma } from "./prisma";
import type { ExtractedDocumentData } from "./gemini";
import {
  buildFinancialIntelligence,
  formatMoney,
  type IntelligenceDocument,
} from "./financial-intelligence";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-2.5-flash";

export type StoredBusinessChatMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type BusinessChatResult = {
  answer: string;
  suggestions: string[];
};

export type AiAgentId =
  | "overall"
  | "cfo"
  | "accountant"
  | "analyst"
  | "cashflow"
  | "consultant"
  | "risk";

type AgentProfile = {
  id: AiAgentId;
  name: string;
  role: string;
  greeting: string;
  focus: string;
  defaultSuggestions: string[];
};

export const AGENT_PROFILES: Record<AiAgentId, AgentProfile> = {
  overall: {
    id: "overall",
    name: "Overall Finance Team",
    role: "Complete AI Finance Team",
    greeting:
      "I will answer like your complete finance team: CFO, accountant, analyst, cash flow manager, consultant, and risk manager together.",
    focus:
      "Give a complete business-owner friendly answer by combining CFO-level decisions, accounting reliability, financial analysis, cash flow, business strategy, and risk warnings. This is the general all-in-one finance chat.",
    defaultSuggestions: [
      "Give me an overall summary of my business.",
      "What is the current financial condition of my business?",
      "What should I fix first?",
      "What are my biggest risks and opportunities?",
      "Give me a complete action plan.",
    ],
  },

  cfo: {
    id: "cfo",
    name: "CFO Agent",
    role: "Chief Financial Officer",
    greeting:
      "I will answer like your CFO: financial health, profit, cash, risk, and business decisions.",
    focus:
      "Focus on executive decisions, profitability, financial health, funding readiness, and what action the owner should take next.",
    defaultSuggestions: [
      "Give me a CFO summary of my business.",
      "Why is my profit margin low?",
      "What should I fix first financially?",
      "Is my business financially healthy?",
      "What are my top 3 next actions?",
    ],
  },

  accountant: {
    id: "accountant",
    name: "Accountant Agent",
    role: "Accountant",
    greeting:
      "I will answer like your accountant: documents, bookkeeping, missing records, and data quality.",
    focus:
      "Focus on accounting data quality, missing documents, document classification, totals, reconciliation, and whether the data is reliable.",
    defaultSuggestions: [
      "Which documents are missing?",
      "Is my uploaded financial data reliable?",
      "What should I upload next?",
      "Which document affects my dashboard most?",
      "Are there any accounting gaps?",
    ],
  },

  analyst: {
    id: "analyst",
    name: "Financial Analyst Agent",
    role: "Financial Analyst",
    greeting:
      "I will answer like your financial analyst: ratios, margins, trends, and performance signals.",
    focus:
      "Focus on ratios, margin analysis, expense ratio, revenue coverage, trends, and performance interpretation.",
    defaultSuggestions: [
      "Analyze my profit margin.",
      "Which financial ratio needs attention?",
      "Compare revenue and expenses.",
      "What does my expense ratio mean?",
      "What trend should I watch?",
    ],
  },

  cashflow: {
    id: "cashflow",
    name: "Cash Flow Agent",
    role: "Cash Flow Manager",
    greeting:
      "I will answer like your cash flow manager: liquidity, runway, bank data, and cash risk.",
    focus:
      "Focus on cash balance, cash runway, monthly burn, bank statements, liquidity risk, and whether enough cash data exists.",
    defaultSuggestions: [
      "Can you calculate my cash runway?",
      "What data is missing for cash flow?",
      "How can I improve cash flow?",
      "Do I need a bank statement?",
      "What is my burn rate?",
    ],
  },

  consultant: {
    id: "consultant",
    name: "Business Consultant Agent",
    role: "Business Consultant",
    greeting:
      "I will answer like your business consultant: growth, cost control, pricing, and strategic decisions.",
    focus:
      "Focus on practical business strategy, cost control, pricing, operational improvement, growth actions, and founder-friendly recommendations.",
    defaultSuggestions: [
      "How can I improve profitability?",
      "What business decision should I take next?",
      "How can I reduce costs without hurting growth?",
      "Should I focus on revenue or expenses first?",
      "Give me a 7-day action plan.",
    ],
  },

  risk: {
    id: "risk",
    name: "Risk & Compliance Agent",
    role: "Risk Manager",
    greeting:
      "I will answer like your risk manager: warnings, weak signals, missing data, and financial risk.",
    focus:
      "Focus on risk alerts, low margins, high expenses, missing bank statements, weak evidence, unreliable data, and red flags.",
    defaultSuggestions: [
      "What is my biggest financial risk?",
      "What warnings should I care about?",
      "Is any data missing before I trust this dashboard?",
      "What could go wrong financially?",
      "How do I reduce business risk?",
    ],
  },
};

const DEFAULT_AGENT_ID: AiAgentId = "overall";

const DEFAULT_SUGGESTIONS = [
  "Give me an overall summary of my business.",
  "What is the current financial condition of my business?",
  "What should I fix first?",
  "What are my biggest risks and opportunities?",
  "Give me a complete action plan.",
];

type ChatExtractedData = ExtractedDocumentData & {
  revenue?: number | null;
  totalRevenue?: number | null;
  sales?: number | null;
  expenses?: number | null;
  totalExpenses?: number | null;
  netIncome?: number | null;
  profit?: number | null;
  loss?: number | null;
  assets?: number | null;
  liabilities?: number | null;
  equity?: number | null;
  cash?: number | null;
  closingBalance?: number | null;
  openingBalance?: number | null;
  balance?: number | null;
  totalAmount?: number | null;
  totalAmountLabel?: string | null;
  currency?: string | null;
  documentDate?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  vendorOrCounterparty?: string | null;
  reportedUnit?: string | null;
  scaleMultiplier?: number | null;
  unitDetectionEvidence?: string | null;
  lineItems?: Array<{
    description?: string;
    amount?: number;
    category?: string | null;
    date?: string | null;
  }>;
  transactions?: Array<{
    date: string;
    description?: string;
    amount: number;
    direction: "credit" | "debit" | string;
  }>;
};

function normalizeAgentId(agentId?: string | null): AiAgentId {
  if (
    agentId === "overall" ||
    agentId === "cfo" ||
    agentId === "accountant" ||
    agentId === "analyst" ||
    agentId === "cashflow" ||
    agentId === "consultant" ||
    agentId === "risk"
  ) {
    return agentId;
  }

  return DEFAULT_AGENT_ID;
}

function safeNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function formatPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "not available";
  return `${value.toFixed(2)}%`;
}

function normalizeRole(role: string): "user" | "assistant" {
  return role === "user" ? "user" : "assistant";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateGeminiAnswer(prompt: string) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      });

      return response.text ?? "";
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;

      if (isLastAttempt) {
        throw error;
      }

      await sleep(1200 * attempt);
    }
  }

  return "";
}

function fixHistoryOrder<T extends { role: string; createdAt: Date }>(rows: T[]) {
  const ordered = [...rows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const fixed: T[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];

    const sameTimestamp =
      next && current.createdAt.getTime() === next.createdAt.getTime();

    if (
      sameTimestamp &&
      current.role === "assistant" &&
      next.role === "user"
    ) {
      fixed.push(next);
      fixed.push(current);
      index += 1;
    } else {
      fixed.push(current);
    }
  }

  return fixed;
}

function buildDocumentSummary(documents: IntelligenceDocument[]) {
  return documents.slice(0, 12).map((doc) => {
    const data = doc.extractedData as ChatExtractedData | null;

    return {
      fileName: doc.fileName,
      category: doc.category,
      uploadedAt: doc.uploadedAt.toISOString(),
      summary: data?.summary ?? null,

      documentDate: data?.documentDate ?? null,
      periodStart: data?.periodStart ?? null,
      periodEnd: data?.periodEnd ?? null,

      currency: data?.currency ?? null,
      reportedUnit: data?.reportedUnit ?? null,
      scaleMultiplier: data?.scaleMultiplier ?? null,
      unitDetectionEvidence: data?.unitDetectionEvidence ?? null,

      totalAmount: data?.totalAmount ?? null,
      totalAmountLabel: data?.totalAmountLabel ?? null,

      revenue: data?.revenue ?? data?.totalRevenue ?? data?.sales ?? null,
      expenses: data?.expenses ?? data?.totalExpenses ?? null,
      profit: data?.profit ?? null,
      loss: data?.loss ?? null,
      netIncome: data?.netIncome ?? null,

      assets: data?.assets ?? null,
      liabilities: data?.liabilities ?? null,
      equity: data?.equity ?? null,
      cash:
        data?.cash ??
        data?.closingBalance ??
        data?.balance ??
        data?.openingBalance ??
        null,

      vendorOrCounterparty: data?.vendorOrCounterparty ?? null,

      lineItems: data?.lineItems?.slice(0, 12) ?? [],
      transactions: data?.transactions?.slice(0, 16) ?? [],
    };
  });
}

function buildFinancialContext(params: {
  businessName?: string | null;
  businessCurrency?: string | null;
  documents: IntelligenceDocument[];
}) {
  const { businessName, businessCurrency, documents } = params;

  const intelligence = buildFinancialIntelligence(
    documents,
    businessCurrency ?? "INR",
  );

  const currency = intelligence.currency;

  const revenue = safeNumber(intelligence.totals.revenue);
  const expenses = safeNumber(intelligence.totals.expenses);
  const profit = safeNumber(intelligence.totals.profit);
  const cash = safeNumber(intelligence.totals.cash);
  const monthlyBurnRate = safeNumber(intelligence.risk.monthlyBurnRate);

  const revenueCoverage =
    intelligence.totals.expenses > 0
      ? (intelligence.totals.revenue / intelligence.totals.expenses) * 100
      : null;

  return {
    business: {
      name: businessName ?? "Business",
      currency,
      approvedDocuments: documents.length,
      dataTrustRule:
        "Only processed and approved documents are included in this context.",
    },

    totals: {
      revenue:
        revenue !== null ? formatMoney(revenue, currency) : "not available",
      expenses:
        expenses !== null ? formatMoney(expenses, currency) : "not available",
      profit:
        profit !== null ? formatMoney(profit, currency) : "not available",
      cash: cash !== null ? formatMoney(cash, currency) : "not available",
      assets:
        intelligence.totals.assets !== null
          ? formatMoney(intelligence.totals.assets, currency)
          : "not available",
      liabilities:
        intelligence.totals.liabilities !== null
          ? formatMoney(intelligence.totals.liabilities, currency)
          : "not available",
      equity:
        intelligence.totals.equity !== null
          ? formatMoney(intelligence.totals.equity, currency)
          : "not available",
    },

    rawNumbers: {
      revenue: intelligence.totals.revenue,
      expenses: intelligence.totals.expenses,
      profit: intelligence.totals.profit,
      cash: intelligence.totals.cash,
      assets: intelligence.totals.assets,
      liabilities: intelligence.totals.liabilities,
      equity: intelligence.totals.equity,
      monthlyBurnRate: intelligence.risk.monthlyBurnRate,
      cashRunwayDays: intelligence.risk.cashRunwayDays,
      healthScore: intelligence.risk.healthScore,
      riskLevel: intelligence.risk.riskLevel,
      profitMarginPct: intelligence.ratios.profitMarginPct,
      expenseRatioPct: intelligence.ratios.expenseRatioPct,
      debtToAssetPct: intelligence.ratios.debtToAssetPct,
      revenueCoveragePct: revenueCoverage,
    },

    ratios: {
      healthScore: `${intelligence.risk.healthScore}/100`,
      riskLevel: intelligence.risk.riskLevel,
      profitMargin: formatPct(intelligence.ratios.profitMarginPct),
      expenseRatio: formatPct(intelligence.ratios.expenseRatioPct),
      debtToAsset: formatPct(intelligence.ratios.debtToAssetPct),
      revenueCoverage: formatPct(revenueCoverage),
    },

    cashFlow: {
      monthlyBurnRate:
        monthlyBurnRate !== null
          ? formatMoney(monthlyBurnRate, currency)
          : "not available",
      cashRunwayDays: intelligence.risk.cashRunwayDays ?? "not available",
      latestMonthlyNet:
        intelligence.trends.latestMonthlyNet !== null
          ? formatMoney(intelligence.trends.latestMonthlyNet, currency)
          : "not available",
      monthlyTrend: intelligence.trends.monthly.slice(-6).map((point) => ({
        month: point.month,
        revenue: formatMoney(point.revenue, currency),
        expenses: formatMoney(point.expenses, currency),
        net: formatMoney(point.net, currency),
      })),
    },

    executiveSummary: intelligence.executiveSummary,

    alerts: intelligence.alerts.map((alert) => ({
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
    })),

    recommendations: intelligence.recommendations.map((recommendation) => ({
      priority: recommendation.priority,
      title: recommendation.title,
      action: recommendation.action,
    })),

    documents: buildDocumentSummary(documents),
  };
}

type FinancialChatContext = ReturnType<typeof buildFinancialContext>;

async function loadBusinessContext(userId: string) {
  const business = await prisma.business.findUnique({
    where: {
      userId,
    },
    select: {
      name: true,
      currency: true,
    },
  });

  const rawDocuments = await prisma.document.findMany({
    where: {
      userId,
      status: "PROCESSED",
      reviewStatus: "APPROVED",
    },
    select: {
      id: true,
      fileName: true,
      category: true,
      extractedData: true,
      uploadedAt: true,
    },
    orderBy: {
      uploadedAt: "asc",
    },
  });

  const documents: IntelligenceDocument[] = rawDocuments.map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    category: doc.category,
    extractedData: doc.extractedData as ExtractedDocumentData | null,
    uploadedAt: doc.uploadedAt,
  }));

  return {
    business,
    documents,
  };
}

function buildSuggestedQuestions(
  context: FinancialChatContext,
  agentId: AiAgentId,
) {
  const profile = AGENT_PROFILES[agentId];
  const suggestions: string[] = [];

  const riskLevel = context.rawNumbers.riskLevel;
  const profit = context.rawNumbers.profit;
  const cash = context.rawNumbers.cash;
  const runway = context.rawNumbers.cashRunwayDays;
  const revenueCoverage = context.rawNumbers.revenueCoveragePct;
  const expenseRatio = context.rawNumbers.expenseRatioPct;

  suggestions.push(...profile.defaultSuggestions);

  if (agentId === "overall") {
    suggestions.push("Give me a complete finance team review.");
    suggestions.push("Summarize dashboard, risks, and next actions together.");
  }

  if (riskLevel === "high" || riskLevel === "critical") {
    suggestions.push("What should I fix first to reduce financial risk?");
  }

  if (typeof profit === "number" && profit < 0) {
    suggestions.push("Why is my business running at a loss?");
    suggestions.push("How much should I reduce expenses to break even?");
  }

  if (typeof revenueCoverage === "number" && revenueCoverage < 100) {
    suggestions.push("How can I improve my revenue coverage?");
  }

  if (typeof expenseRatio === "number" && expenseRatio > 90) {
    suggestions.push("Which costs should I control first?");
  }

  if (cash === null) {
    suggestions.push("What data is missing to calculate cash runway?");
  }

  if (typeof runway === "number" && runway < 90) {
    suggestions.push("How can I extend my cash runway?");
  }

  suggestions.push("What documents should I upload next for better analysis?");

  return [...new Set(suggestions)].slice(0, 6);
}

function buildPrompt(
  question: string,
  context: FinancialChatContext,
  agentId: AiAgentId,
) {
  const profile = AGENT_PROFILES[agentId];

  return `
You are the ${profile.name}, acting as a ${profile.role} for a small or medium business.

Agent focus:
${profile.focus}

You are part of an AI Executive Finance Team.

If you are the Overall Finance Team:
- Combine the viewpoint of CFO, accountant, financial analyst, cash flow manager, business consultant, and risk manager.
- Give a complete answer, not only one specialist angle.
- Cover financial condition, trusted data, risks, and next actions.
- Keep it easy for a business owner to understand.

Important rules:
1. Use ONLY the approved financial data provided below.
2. Do not invent numbers.
3. If data is missing, clearly say exactly what is missing.
4. Use the same currency shown in the data.
5. Mention exact numbers when useful.
6. Keep the answer practical and business-owner friendly.
7. Do not give legal, tax, or investment advice as certainty.
8. Do not pretend unapproved or missing documents exist.
9. If cash runway cannot be calculated, say which document is needed.
10. End with 2-4 recommended next actions when relevant.

Answer style:
- Start with a direct answer.
- Use short paragraphs.
- Use bullets only when it improves clarity.
- Be specific, not generic.
- Explain what the number means in real business language.

Approved company financial context:
${JSON.stringify(context, null, 2)}

User question:
${question}
`;
}

export async function getBusinessChatHistory(
  userId: string,
): Promise<StoredBusinessChatMessage[]> {
  const rows = await prisma.businessChatMessage.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 80,
  });

  const fixedRows = fixHistoryOrder(rows);

  return fixedRows.map((message) => ({
    role: normalizeRole(message.role),
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  }));
}

export async function clearBusinessChatHistory(userId: string) {
  await prisma.businessChatMessage.deleteMany({
    where: {
      userId,
    },
  });
}

export async function saveBusinessChatExchange(params: {
  userId: string;
  question: string;
  answer: string;
}) {
  const questionTime = new Date();
  const answerTime = new Date(questionTime.getTime() + 1);

  await prisma.$transaction([
    prisma.businessChatMessage.create({
      data: {
        userId: params.userId,
        role: "user",
        content: params.question,
        createdAt: questionTime,
      },
    }),

    prisma.businessChatMessage.create({
      data: {
        userId: params.userId,
        role: "assistant",
        content: params.answer,
        createdAt: answerTime,
      },
    }),
  ]);
}

export async function getBusinessChatSuggestions(
  userId: string,
  agentId?: string | null,
) {
  const normalizedAgentId = normalizeAgentId(agentId);
  const { business, documents } = await loadBusinessContext(userId);

  if (documents.length === 0) {
    return [
      "Which documents should I upload first?",
      "What can you analyze from a financial statement?",
      "What documents are needed to calculate cash runway?",
      "How does approval affect dashboard data?",
    ];
  }

  const context = buildFinancialContext({
    businessName: business?.name,
    businessCurrency: business?.currency,
    documents,
  });

  return buildSuggestedQuestions(context, normalizedAgentId);
}

export async function answerBusinessQuestion(params: {
  userId: string;
  question: string;
  agentId?: string | null;
}): Promise<BusinessChatResult> {
  const question = params.question.trim();
  const agentId = normalizeAgentId(params.agentId);
  const profile = AGENT_PROFILES[agentId];

  if (!question) {
    return {
      answer: "Please ask a finance question about your business.",
      suggestions: profile.defaultSuggestions,
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    return {
      answer:
        "Gemini API key is missing. Add GEMINI_API_KEY to your environment variables first.",
      suggestions: [],
    };
  }

  const { business, documents } = await loadBusinessContext(params.userId);

  if (documents.length === 0) {
    return {
      answer:
        "I do not have approved financial documents yet. Upload a financial statement, bank statement, invoices, or bills, then approve the AI extraction. After that, I can answer using trusted business data.",
      suggestions: [
        "Which documents should I upload first?",
        "What can you analyze from a financial statement?",
        "What documents are needed to calculate cash runway?",
        "How does approval affect dashboard data?",
      ],
    };
  }

  const context = buildFinancialContext({
    businessName: business?.name,
    businessCurrency: business?.currency,
    documents,
  });

  const suggestions = buildSuggestedQuestions(context, agentId);
  const prompt = buildPrompt(question, context, agentId);

  try {
    const answer = await generateGeminiAnswer(prompt);

    return {
      answer:
        answer ||
        "I could not generate an answer from the AI model. Please try again.",
      suggestions,
    };
  } catch (error) {
    console.error("Gemini chat generation failed:", error);

    return {
      answer:
        "The AI finance model is temporarily busy or unavailable. Your approved financial data and chat history are working correctly. Please try the same question again in a few seconds.",
      suggestions,
    };
  }
}

export { DEFAULT_SUGGESTIONS };