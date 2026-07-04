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

const DEFAULT_SUGGESTIONS = [
  "Why is my health score low?",
  "Why is my business running at a loss?",
  "What expenses should I reduce first?",
  "How can I improve my cash flow?",
  "Can I afford to hire another employee?",
];

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
      processedDocuments: documents.length,
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

function buildSuggestedQuestions(context: ReturnType<typeof buildFinancialContext>) {
  const suggestions: string[] = [];

  const riskLevel = context.rawNumbers.riskLevel;
  const profit = context.rawNumbers.profit;
  const cash = context.rawNumbers.cash;
  const runway = context.rawNumbers.cashRunwayDays;
  const revenueCoverage = context.rawNumbers.revenueCoveragePct;
  const expenseRatio = context.rawNumbers.expenseRatioPct;

  if (riskLevel === "high" || riskLevel === "critical") {
    suggestions.push("What should I fix first to reduce financial risk?");
  }

  if (profit < 0) {
    suggestions.push("Why is my business running at a loss?");
    suggestions.push("How much should I reduce expenses to break even?");
  }

  if (revenueCoverage !== null && revenueCoverage < 70) {
    suggestions.push("How can I improve my revenue coverage?");
  }

  if (expenseRatio !== null && expenseRatio > 100) {
    suggestions.push("Which costs should I control first?");
  }

  if (cash === null) {
    suggestions.push("What data is missing to calculate cash runway?");
  }

  if (runway !== null && runway < 90) {
    suggestions.push("How can I extend my cash runway?");
  }

  suggestions.push("What are my top 3 next actions?");
  suggestions.push("What documents should I upload next for better analysis?");

  return [...new Set(suggestions)].slice(0, 5);
}

function buildPrompt(question: string, context: ReturnType<typeof buildFinancialContext>) {
  return `
You are an AI Executive Finance Team for a small or medium business.

You act like:
- CFO
- Accountant
- Financial analyst
- Business consultant

Your job:
Answer the user's finance question using ONLY the company's actual processed financial data below.

Important rules:
1. Do not invent numbers.
2. If data is missing, clearly say what is missing.
3. Give practical business actions.
4. Use simple language.
5. Use the same currency shown in the data.
6. Be specific and mention exact numbers when useful.
7. Do not give legal, tax, or investment advice as certainty.
8. Keep the answer concise but useful.
9. If the business is loss-making, explain the main reason using revenue, expenses, margin, and coverage.
10. End with 2-3 recommended next actions when relevant.

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

  return rows.reverse().map((message) => ({
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
  await prisma.businessChatMessage.createMany({
    data: [
      {
        userId: params.userId,
        role: "user",
        content: params.question,
      },
      {
        userId: params.userId,
        role: "assistant",
        content: params.answer,
      },
    ],
  });
}

export async function getBusinessChatSuggestions(userId: string) {
  const { business, documents } = await loadBusinessContext(userId);

  if (documents.length === 0) {
    return [
      "Which documents should I upload first?",
      "What can you analyze from a financial statement?",
      "What documents are needed to calculate cash runway?",
    ];
  }

  const context = buildFinancialContext({
    businessName: business?.name,
    businessCurrency: business?.currency,
    documents,
  });

  return buildSuggestedQuestions(context);
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

export async function answerBusinessQuestion(params: {
  userId: string;
  question: string;
}): Promise<BusinessChatResult> {
  const question = params.question.trim();

  if (!question) {
    return {
      answer: "Please ask a finance question about your business.",
      suggestions: DEFAULT_SUGGESTIONS,
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
        "I don't have enough processed financial data yet. Upload and process bank statements, invoices, bills, payroll, or financial statements first, then I can answer using your business data.",
      suggestions: [
        "Which documents should I upload first?",
        "What can you analyze from a financial statement?",
      ],
    };
  }

  const context = buildFinancialContext({
    businessName: business?.name,
    businessCurrency: business?.currency,
    documents,
  });

  const suggestions = buildSuggestedQuestions(context);

try {
  const response = await generateGeminiAnswer(buildPrompt(question, context));

  return {
    answer:
      response ||
      "I could not generate an answer from the AI model. Please try again.",
    suggestions,
  };
} catch (error) {
  console.error("Gemini chat generation failed:", error);

  return {
    answer:
      "The AI finance model is temporarily busy due to high demand. Your financial data and chat history are working correctly. Please try the same question again in a few seconds.",
    suggestions,
  };
}