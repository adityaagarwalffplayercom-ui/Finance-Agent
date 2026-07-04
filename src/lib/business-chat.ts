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

function safeNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function formatPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "not available";
  return `${value.toFixed(2)}%`;
}

function buildDocumentSummary(documents: IntelligenceDocument[]) {
  return documents.slice(0, 12).map((doc) => {
    const data = doc.extractedData as ExtractedDocumentData | null;

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

  return {
    business: {
      name: businessName ?? "Business",
      currency,
      processedDocuments: documents.length,
    },

    totals: {
      revenue: revenue !== null ? formatMoney(revenue, currency) : "not available",
      expenses: expenses !== null ? formatMoney(expenses, currency) : "not available",
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

    ratios: {
      healthScore: `${intelligence.risk.healthScore}/100`,
      riskLevel: intelligence.risk.riskLevel,
      profitMargin: formatPct(intelligence.ratios.profitMarginPct),
      expenseRatio: formatPct(intelligence.ratios.expenseRatioPct),
      debtToAsset: formatPct(intelligence.ratios.debtToAssetPct),
      revenueCoverage:
        intelligence.totals.expenses > 0
          ? formatPct(
              (intelligence.totals.revenue / intelligence.totals.expenses) *
                100,
            )
          : "not available",
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
6. Be specific and mention the exact numbers when useful.
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

export async function answerBusinessQuestion(params: {
  userId: string;
  question: string;
}) {
  const question = params.question.trim();

  if (!question) {
    return "Please ask a finance question about your business.";
  }

  if (!process.env.GEMINI_API_KEY) {
    return "Gemini API key is missing. Add GEMINI_API_KEY to your environment variables first.";
  }

  const business = await prisma.business.findUnique({
    where: {
      userId: params.userId,
    },
    select: {
      name: true,
      currency: true,
    },
  });

  const rawDocuments = await prisma.document.findMany({
    where: {
      userId: params.userId,
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

  if (rawDocuments.length === 0) {
    return "I don't have enough processed financial data yet. Upload and process bank statements, invoices, bills, payroll, or financial statements first, then I can answer using your business data.";
  }

  const documents: IntelligenceDocument[] = rawDocuments.map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    category: doc.category,
    extractedData: doc.extractedData as ExtractedDocumentData | null,
    uploadedAt: doc.uploadedAt,
  }));

  const context = buildFinancialContext({
    businessName: business?.name,
    businessCurrency: business?.currency,
    documents,
  });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: buildPrompt(question, context),
          },
        ],
      },
    ],
  });

  return response.text || "I could not generate an answer. Please try again.";
}