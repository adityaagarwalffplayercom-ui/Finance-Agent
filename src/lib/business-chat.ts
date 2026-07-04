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

export type AiAgentId =
  | "team"
  | "cfo"
  | "accountant"
  | "analyst"
  | "cashflow"
  | "consultant"
  | "risk";

export type StoredBusinessChatMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type BusinessChatResult = {
  answer: string;
  suggestions: string[];
  agentId: AiAgentId;
  agentName: string;
};

type ChatExtractedData = ExtractedDocumentData & {
  revenue?: number;
  expenses?: number;
  netIncome?: number;
  profit?: number;
  assets?: number;
  liabilities?: number;
  equity?: number;
  totalAmount?: number;
  totalAmountLabel?: string;
  currency?: string;
  documentDate?: string;
  periodStart?: string;
  periodEnd?: string;
  vendorOrCounterparty?: string;
  lineItems?: Array<{
    description?: string;
    amount?: number;
    category?: string;
  }>;
  transactions?: Array<{
    date: string;
    description?: string;
    amount: number;
    direction: "credit" | "debit" | string;
  }>;
};

type BusinessFinancialContext = ReturnType<typeof buildFinancialContext>;

const AGENT_PROFILES: Record<
  AiAgentId,
  {
    id: AiAgentId;
    name: string;
    title: string;
    systemRole: string;
    styleRules: string[];
    defaultSuggestions: string[];
    emptyDataSuggestions: string[];
  }
> = {
  team: {
    id: "team",
    name: "AI Finance Team",
    title: "Executive finance team",
    systemRole:
      "You are the complete AI Executive Finance Team for a small or medium business. You combine CFO, accountant, analyst, cash-flow, risk, and business consultant thinking.",
    styleRules: [
      "Give a balanced finance answer.",
      "Mention the most important numbers first.",
      "End with 2-3 practical next actions.",
    ],
    defaultSuggestions: [
      "Why is my health score low?",
      "Why is my business running at a loss?",
      "What expenses should I reduce first?",
      "How can I improve my cash flow?",
      "Can I afford to hire another employee?",
    ],
    emptyDataSuggestions: [
      "Which documents should I upload and approve first?",
      "What can you analyze from an approved financial statement?",
      "What documents are needed to calculate cash runway?",
    ],
  },
  cfo: {
    id: "cfo",
    name: "CFO Agent",
    title: "Executive finance decision maker",
    systemRole:
      "You are the CFO Agent. Your job is to guide executive decisions, business health, profitability, risk, runway, and strategic priorities.",
    styleRules: [
      "Think like a CFO speaking to a founder.",
      "Focus on profit, loss, risk, runway, and decision-making.",
      "Do not go too deep into bookkeeping unless it affects business decisions.",
    ],
    defaultSuggestions: [
      "What is my biggest financial risk?",
      "What should I fix first as the owner?",
      "Is the business financially healthy?",
      "Can I afford a major expense right now?",
      "What are my top 3 executive priorities?",
    ],
    emptyDataSuggestions: [
      "What documents should I approve for CFO analysis?",
      "What data is needed for a CFO-level view?",
      "What can a CFO Agent analyze from financial statements?",
    ],
  },
  accountant: {
    id: "accountant",
    name: "Accountant Agent",
    title: "Books and document control",
    systemRole:
      "You are the Accountant Agent. Your job is to check document quality, data completeness, categorization, missing records, and whether the financial data is reliable.",
    styleRules: [
      "Focus on records, documents, categories, missing data, and verification.",
      "Be careful with numbers and tell the user what needs review.",
      "Do not give final tax or audit advice.",
    ],
    defaultSuggestions: [
      "Which documents are missing?",
      "Is my uploaded data reliable?",
      "What should I review before approving documents?",
      "Which entries look important?",
      "What should I upload next for cleaner books?",
    ],
    emptyDataSuggestions: [
      "Which documents should I upload first?",
      "How should I review AI extractions?",
      "What makes a document reliable for accounting?",
    ],
  },
  analyst: {
    id: "analyst",
    name: "Financial Analyst Agent",
    title: "Margins, ratios, and trends",
    systemRole:
      "You are the Financial Analyst Agent. Your job is to analyze revenue, expenses, profit margin, expense ratio, revenue coverage, trends, and business performance.",
    styleRules: [
      "Use ratios and comparisons where possible.",
      "Explain what the numbers mean in simple language.",
      "Highlight trends, margins, and performance drivers.",
    ],
    defaultSuggestions: [
      "What is my profit margin?",
      "Why are expenses high?",
      "How is my revenue coverage?",
      "What trend should I watch?",
      "Which financial ratio matters most right now?",
    ],
    emptyDataSuggestions: [
      "What documents are needed for ratio analysis?",
      "Can you analyze margins from a financial statement?",
      "What data is needed to compare trends?",
    ],
  },
  cashflow: {
    id: "cashflow",
    name: "Cash Flow Agent",
    title: "Runway and liquidity monitor",
    systemRole:
      "You are the Cash Flow Agent. Your job is to analyze cash position, cash runway, burn rate, inflows, outflows, and liquidity risk.",
    styleRules: [
      "Focus on cash, bank statements, burn rate, runway, and payment timing.",
      "If cash data is missing, clearly ask for bank statements.",
      "Give short-term survival and liquidity actions.",
    ],
    defaultSuggestions: [
      "What is my cash runway?",
      "How can I improve cash flow?",
      "Do I have a liquidity problem?",
      "What cash data is missing?",
      "How can I reduce monthly burn?",
    ],
    emptyDataSuggestions: [
      "What documents are needed for cash runway?",
      "Why do you need bank statements?",
      "How can I track cash flow better?",
    ],
  },
  consultant: {
    id: "consultant",
    name: "Business Consultant Agent",
    title: "Growth and cost-control advisor",
    systemRole:
      "You are the Business Consultant Agent. Your job is to convert finance signals into practical business actions around revenue growth, pricing, cost control, operations, and hiring decisions.",
    styleRules: [
      "Focus on practical business actions.",
      "Translate financial numbers into owner-friendly decisions.",
      "Suggest experiments, cost-control steps, and growth opportunities.",
    ],
    defaultSuggestions: [
      "How can I grow revenue?",
      "What costs should I cut first?",
      "Should I increase prices?",
      "Can I hire someone right now?",
      "What are my best next business actions?",
    ],
    emptyDataSuggestions: [
      "What data do you need to give business advice?",
      "What documents help with pricing decisions?",
      "What can you suggest after I approve documents?",
    ],
  },
  risk: {
    id: "risk",
    name: "Risk & Compliance Agent",
    title: "Financial risk guardrail",
    systemRole:
      "You are the Risk & Compliance Agent. Your job is to flag financial risks, trust issues, missing approvals, rejected documents, suspicious gaps, and areas needing human verification.",
    styleRules: [
      "Focus on risks, missing data, verification, and guardrails.",
      "Be careful and conservative.",
      "Do not give final legal, tax, audit, or compliance advice.",
    ],
    defaultSuggestions: [
      "What risks should I worry about?",
      "What data is not trustworthy yet?",
      "Which documents need verification?",
      "What should I not rely on yet?",
      "What are the biggest red flags?",
    ],
    emptyDataSuggestions: [
      "What documents reduce financial risk?",
      "How do approvals improve trust?",
      "What data should not be trusted yet?",
    ],
  },
};

function normalizeAgentId(value: unknown): AiAgentId {
  if (typeof value !== "string") return "team";

  if (
    value === "cfo" ||
    value === "accountant" ||
    value === "analyst" ||
    value === "cashflow" ||
    value === "consultant" ||
    value === "risk" ||
    value === "team"
  ) {
    return value;
  }

  return "team";
}

function getAgentProfile(agentId?: unknown) {
  return AGENT_PROFILES[normalizeAgentId(agentId)];
}

const DEFAULT_SUGGESTIONS = AGENT_PROFILES.team.defaultSuggestions;

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

    if (sameTimestamp && current.role === "assistant" && next.role === "user") {
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
      totalAmount: data?.totalAmount ?? null,
      totalAmountLabel: data?.totalAmountLabel ?? null,
      revenue: data?.revenue ?? null,
      expenses: data?.expenses ?? null,
      netIncome: data?.netIncome ?? null,
      profit: data?.profit ?? null,
      assets: data?.assets ?? null,
      liabilities: data?.liabilities ?? null,
      equity: data?.equity ?? null,
      vendorOrCounterparty: data?.vendorOrCounterparty ?? null,
      lineItems: data?.lineItems?.slice(0, 8) ?? [],
      transactions: data?.transactions?.slice(0, 12) ?? [],
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
      trustedApprovedDocuments: documents.length,
    },
    totals: {
      revenue: revenue !== null ? formatMoney(revenue, currency) : "not available",
      expenses:
        expenses !== null ? formatMoney(expenses, currency) : "not available",
      profit: profit !== null ? formatMoney(profit, currency) : "not available",
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
      monthlyBurnRate: intelligence.risk.monthlyBurnRate,
      cashRunwayDays: intelligence.risk.cashRunwayDays,
      healthScore: intelligence.risk.healthScore,
      riskLevel: intelligence.risk.riskLevel,
      profitMarginPct: intelligence.ratios.profitMarginPct,
      expenseRatioPct: intelligence.ratios.expenseRatioPct,
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
  context: BusinessFinancialContext,
  agentId?: AiAgentId,
) {
  const agent = getAgentProfile(agentId);
  const suggestions: string[] = [];

  const riskLevel = context.rawNumbers.riskLevel;
  const profit = context.rawNumbers.profit;
  const cash = context.rawNumbers.cash;
  const runway = context.rawNumbers.cashRunwayDays;
  const revenueCoverage = context.rawNumbers.revenueCoveragePct;
  const expenseRatio = context.rawNumbers.expenseRatioPct;

  if (agent.id === "cfo") {
    if (riskLevel === "high" || riskLevel === "critical") {
      suggestions.push("What should I fix first to reduce financial risk?");
    }

    suggestions.push("What are my top 3 executive priorities?");
    suggestions.push("Is my business financially healthy?");
  }

  if (agent.id === "accountant") {
    suggestions.push("Which documents are missing?");
    suggestions.push("Is my uploaded data reliable?");
    suggestions.push("What should I approve next?");
  }

  if (agent.id === "analyst") {
    suggestions.push("What is my profit margin?");
    suggestions.push("Why are expenses high?");
    suggestions.push("How is my revenue coverage?");
  }

  if (agent.id === "cashflow") {
    if (cash === null) {
      suggestions.push("What data is missing to calculate cash runway?");
    }

    if (typeof runway === "number" && runway < 90) {
      suggestions.push("How can I extend my cash runway?");
    }

    suggestions.push("How can I improve cash flow?");
  }

  if (agent.id === "consultant") {
    suggestions.push("What costs should I cut first?");
    suggestions.push("How can I grow revenue?");
    suggestions.push("Can I hire someone right now?");
  }

  if (agent.id === "risk") {
    suggestions.push("What risks should I worry about?");
    suggestions.push("What data is not trustworthy yet?");
    suggestions.push("What should I verify first?");
  }

  if (typeof profit === "number" && profit < 0) {
    suggestions.push("Why is my business running at a loss?");
    suggestions.push("How much should I reduce expenses to break even?");
  }

  if (typeof revenueCoverage === "number" && revenueCoverage < 70) {
    suggestions.push("How can I improve my revenue coverage?");
  }

  if (typeof expenseRatio === "number" && expenseRatio > 100) {
    suggestions.push("Which costs should I control first?");
  }

  suggestions.push("What are my top 3 next actions?");

  return [...new Set(suggestions)].slice(0, 5);
}

function buildPrompt(params: {
  question: string;
  context: BusinessFinancialContext;
  agentId?: AiAgentId;
}) {
  const { question, context, agentId } = params;
  const agent = getAgentProfile(agentId);

  return `
${agent.systemRole}

You are answering inside a finance SaaS product where the user selected:
Agent: ${agent.name}
Agent title: ${agent.title}

Agent behavior rules:
${agent.styleRules.map((rule) => `- ${rule}`).join("\n")}

Universal rules:
1. Use ONLY the approved trusted financial data below.
2. Do not invent numbers.
3. If data is missing, clearly say what is missing.
4. Use simple language.
5. Use the same currency shown in the data.
6. Use exact numbers when useful.
7. Do not give legal, tax, audit, or investment advice as certainty.
8. Keep the answer concise but useful.
9. Mention that the answer is based on approved documents when helpful.
10. End with practical next actions when relevant.

Company financial context:
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
  agentId?: unknown,
) {
  const agent = getAgentProfile(agentId);
  const { business, documents } = await loadBusinessContext(userId);

  if (documents.length === 0) {
    return agent.emptyDataSuggestions;
  }

  const context = buildFinancialContext({
    businessName: business?.name,
    businessCurrency: business?.currency,
    documents,
  });

  return buildSuggestedQuestions(context, agent.id);
}

export async function answerBusinessQuestion(params: {
  userId: string;
  question: string;
  agentId?: unknown;
}): Promise<BusinessChatResult> {
  const question = params.question.trim();
  const agent = getAgentProfile(params.agentId);

  if (!question) {
    return {
      answer: "Please ask a finance question about your business.",
      suggestions: agent.defaultSuggestions,
      agentId: agent.id,
      agentName: agent.name,
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    return {
      answer:
        "Gemini API key is missing. Add GEMINI_API_KEY to your environment variables first.",
      suggestions: [],
      agentId: agent.id,
      agentName: agent.name,
    };
  }

  const { business, documents } = await loadBusinessContext(params.userId);

  if (documents.length === 0) {
    return {
      answer:
        "I don't have enough approved financial data yet. Upload documents, process them with AI, then approve the extractions before I use them for financial answers.",
      suggestions: agent.emptyDataSuggestions,
      agentId: agent.id,
      agentName: agent.name,
    };
  }

  const context = buildFinancialContext({
    businessName: business?.name,
    businessCurrency: business?.currency,
    documents,
  });

  const suggestions = buildSuggestedQuestions(context, agent.id);
  const prompt = buildPrompt({
    question,
    context,
    agentId: agent.id,
  });

  try {
    const answer = await generateGeminiAnswer(prompt);

    return {
      answer:
        answer ||
        "I could not generate an answer from the AI model. Please try again.",
      suggestions,
      agentId: agent.id,
      agentName: agent.name,
    };
  } catch (error) {
    console.error("Gemini chat generation failed:", error);

    return {
      answer:
        "The AI finance model is temporarily busy due to high demand. Your approved financial data and chat history are working correctly. Please try the same question again in a few seconds.",
      suggestions,
      agentId: agent.id,
      agentName: agent.name,
    };
  }
}