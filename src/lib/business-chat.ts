import { GoogleGenAI } from "@google/genai";
import { prisma } from "./prisma";
import {
  buildAgentLaunchSafetyBlock,
  getAgentSafetyFooter,
} from "./agent-governance";
import { buildTaxRulesPromptBlock } from "./tax-rules-engine";

export type AiAgentId =
  | "team"
  | "cfo"
  | "accountant"
  | "tax"
  | "analyst"
  | "cashflow"
  | "consultant"
  | "risk";

export type BusinessChatAgentId = AiAgentId;

export type AgentProfile = {
  id: AiAgentId;
  name: string;
  title: string;
  systemRole: string;
  responseStyle: string;
};

export const DEFAULT_AGENT_ID: AiAgentId = "team";

export const AGENT_PROFILES: Record<AiAgentId, AgentProfile> = {
  team: {
    id: "team",
    name: "AI Finance Team",
    title: "Combined executive finance team",
    systemRole:
      "You are Aureli's AI Finance Team. Coordinate CFO, Accountant, Tax, Analyst, Cash Flow, Consultant, and Risk perspectives into one practical answer.",
    responseStyle:
      "Give a concise executive answer, then clear next actions. Avoid unsupported certainty.",
  },
  cfo: {
    id: "cfo",
    name: "CFO Agent",
    title: "Strategic finance decision support",
    systemRole:
      "You are Aureli's CFO Agent. Focus on profitability, financial health, cash runway, capital allocation, and business decisions.",
    responseStyle:
      "Answer like a practical CFO advising a small business owner.",
  },
  accountant: {
    id: "accountant",
    name: "Accountant Agent",
    title: "Books and document control",
    systemRole:
      "You are Aureli's Accountant Agent. Focus on document completeness, bookkeeping accuracy, approved data, rejected data, and missing records.",
    responseStyle:
      "Be careful, audit-style, and mention when data is incomplete.",
  },
  tax: {
    id: "tax",
    name: "Tax Agent",
    title: "Tax readiness and compliance checklist",
    systemRole:
      "You are Aureli's Tax Agent. You review tax-related documents and verified tax rules stored in Aureli's database. You must not calculate final tax payable unless verified rules fully cover the request, and even then you must present it as an estimate/checklist, not legal/tax certification.",
    responseStyle:
      "Be conservative. Give checklist-style tax readiness guidance. Always mention verified source coverage or missing verified rules.",
  },
  analyst: {
    id: "analyst",
    name: "Financial Analyst Agent",
    title: "Performance and trend analysis",
    systemRole:
      "You are Aureli's Financial Analyst Agent. Focus on revenue, expenses, profit, margins, trends, anomalies, and document-backed financial interpretation.",
    responseStyle:
      "Use numbers from the business context when available and explain trends simply.",
  },
  cashflow: {
    id: "cashflow",
    name: "Cash Flow Agent",
    title: "Liquidity and cash movement",
    systemRole:
      "You are Aureli's Cash Flow Agent. Focus on cash position, inflows, outflows, working capital, liquidity risk, and near-term cash planning.",
    responseStyle:
      "Give practical cash-flow actions and warnings.",
  },
  consultant: {
    id: "consultant",
    name: "Business Consultant Agent",
    title: "Growth and operational advice",
    systemRole:
      "You are Aureli's Business Consultant Agent. Focus on business improvement, pricing, cost control, operations, and growth decisions.",
    responseStyle:
      "Give practical business suggestions, not generic motivation.",
  },
  risk: {
    id: "risk",
    name: "Risk Agent",
    title: "Financial risk monitoring",
    systemRole:
      "You are Aureli's Risk Agent. Focus on risk signals, missing data, compliance uncertainty, losses, cash pressure, and unusual patterns.",
    responseStyle:
      "Be clear about risk level, evidence, and what should be checked next.",
  },
};

export type BusinessChatMessageView = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type AnswerBusinessQuestionInput = {
  userId: string;
  question?: string;
  message?: string;
  agentId?: AiAgentId | string | null;
};

function normalizeAgentId(value?: string | null): AiAgentId {
  if (
    value &&
    Object.prototype.hasOwnProperty.call(AGENT_PROFILES, value)
  ) {
    return value as AiAgentId;
  }

  return DEFAULT_AGENT_ID;
}

function compactJson(value: unknown, maxLength = 1200) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  } catch {
    return "Could not read structured data.";
  }
}

function formatCurrency(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    });
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return "Not available";
}

async function getFinancialProfileSafely(userId: string) {
  try {
    const mod = await import("./financial-profile");

    if (typeof mod.getFinancialProfile !== "function") {
      return null;
    }

    return await mod.getFinancialProfile(userId);
  } catch {
    return null;
  }
}

async function buildBusinessContext(userId: string) {
  const [business, approvedDocuments, pendingReview, rejectedDocuments, profile] =
    await Promise.all([
      prisma.business.findUnique({
        where: {
          userId,
        },
        select: {
          name: true,
          industry: true,
          businessType: true,
          financialYear: true,
          currency: true,
          country: true,
        },
      }),
      prisma.document.findMany({
        where: {
          userId,
          status: "PROCESSED",
          reviewStatus: "APPROVED",
        },
        orderBy: {
          uploadedAt: "desc",
        },
        take: 12,
        select: {
          fileName: true,
          category: true,
          extractedData: true,
          uploadedAt: true,
        },
      }),
      prisma.document.count({
        where: {
          userId,
          status: "PROCESSED",
          reviewStatus: "NEEDS_REVIEW",
        },
      }),
      prisma.document.count({
        where: {
          userId,
          reviewStatus: "REJECTED",
        },
      }),
      getFinancialProfileSafely(userId),
    ]);

  return {
    business: {
      name: business?.name ?? "Not set",
      industry: business?.industry ?? "Not set",
      businessType: business?.businessType ?? "Not set",
      financialYear: business?.financialYear ?? "Not set",
      currency: business?.currency ?? "Not set",
      country: business?.country ?? "Not set",
    },
    approvedDocuments,
    pendingReview,
    rejectedDocuments,
    profile,
  };
}

async function buildPrompt(params: {
  userId: string;
  question: string;
  agentId: AiAgentId;
}) {
  const context = await buildBusinessContext(params.userId);
  const agent = AGENT_PROFILES[params.agentId];

  const launchSafetyBlock = buildAgentLaunchSafetyBlock({
    agentId: agent.id,
    country: context.business.country,
    financialYear: context.business.financialYear,
  });

  const taxRulesBlock =
    agent.id === "tax" ||
    params.question.toLowerCase().includes("tax") ||
    params.question.toLowerCase().includes("gst") ||
    params.question.toLowerCase().includes("vat")
      ? await buildTaxRulesPromptBlock({
          country: context.business.country,
          financialYear: context.business.financialYear,
        })
      : "";

  const approvedDocumentBlock =
    context.approvedDocuments.length > 0
      ? context.approvedDocuments
          .map(
            (doc, index) => `
Document ${index + 1}
File: ${doc.fileName}
Category: ${doc.category}
Uploaded: ${doc.uploadedAt.toISOString()}
Extracted data:
${compactJson(doc.extractedData)}
`,
          )
          .join("\n")
      : "No approved processed documents are available yet.";

  const profile = context.profile as
    | {
        healthScore?: number;
        healthLabel?: string;
        revenue?: { value?: string };
        expenses?: { value?: string };
        profit?: { value?: string };
        cash?: { value?: string };
        alerts?: Array<{ severity?: string; message?: string }>;
      }
    | null;

  const financeProfileBlock = profile
    ? `
Financial profile:
- Health score: ${profile.healthScore ?? "Not available"}
- Health label: ${profile.healthLabel ?? "Not available"}
- Revenue: ${formatCurrency(profile.revenue?.value)}
- Expenses: ${formatCurrency(profile.expenses?.value)}
- Profit: ${formatCurrency(profile.profit?.value)}
- Cash: ${formatCurrency(profile.cash?.value)}
- Alerts:
${
  profile.alerts && profile.alerts.length > 0
    ? profile.alerts
        .map(
          (alert) =>
            `  - ${alert.severity ?? "info"}: ${alert.message ?? "No message"}`,
        )
        .join("\n")
    : "  - No alerts available."
}
`
    : "Financial profile is not available yet.";

  return `
You are ${agent.name} inside Aureli.

Agent title:
${agent.title}

Agent role:
${agent.systemRole}

Response style:
${agent.responseStyle}

Business profile:
- Business name: ${context.business.name}
- Industry: ${context.business.industry}
- Business type: ${context.business.businessType}
- Country: ${context.business.country}
- Financial year: ${context.business.financialYear}
- Currency: ${context.business.currency}

Document trust status:
- Approved processed documents used for answers: ${context.approvedDocuments.length}
- Processed documents still needing review: ${context.pendingReview}
- Rejected documents: ${context.rejectedDocuments}

${financeProfileBlock}

Approved document data:
${approvedDocumentBlock}

Governance and launch safety:
${launchSafetyBlock}

Verified tax rules block:
${taxRulesBlock || "Not applicable for this question unless tax is involved."}

Strict rules:
- Use only the business profile, approved documents, financial profile, and verified rules shown above.
- Do not pretend missing data exists.
- If data is missing, clearly say what is missing.
- Do not provide legal, tax, audit, or investment certification.
- For tax questions, do not calculate final tax payable unless verified tax rules fully support the calculation. Prefer checklist and review guidance.
- Keep answer practical for a business owner.
- End with 3 clear next actions when useful.

User question:
${params.question}

Safety footer to include when relevant:
${getAgentSafetyFooter(agent.id)}
`;
}

async function generateAiAnswer(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return "Gemini API key is not configured. Add GEMINI_API_KEY in .env to enable AI chat.";
  }

  const ai = new GoogleGenAI({
    apiKey,
  });

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
    contents: prompt,
  });

  const text = response.text?.trim();

  if (!text) {
    return "I could not generate a response right now. Please try again.";
  }

  return text;
}

export async function getBusinessChatHistory(
  userId: string,
  limit = 20,
): Promise<BusinessChatMessageView[]> {
  const messages = await prisma.businessChatMessage.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return messages.reverse().map((message) => ({
    id: message.id,
    role: message.role,
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

export async function saveBusinessChatExchange(
  input:
    | {
        userId: string;
        question: string;
        answer: string;
      }
    | string,
  questionArg?: string,
  answerArg?: string,
) {
  const userId = typeof input === "string" ? input : input.userId;
  const question = typeof input === "string" ? questionArg ?? "" : input.question;
  const answer = typeof input === "string" ? answerArg ?? "" : input.answer;

  if (!userId || !question || !answer) {
    return;
  }

  await prisma.$transaction([
    prisma.businessChatMessage.create({
      data: {
        userId,
        role: "user",
        content: question,
      },
    }),
    prisma.businessChatMessage.create({
      data: {
        userId,
        role: "assistant",
        content: answer,
      },
    }),
  ]);
}

export function getBusinessChatSuggestions(
  userIdOrAgentId?: string | null,
  maybeAgentId?: AiAgentId | string | null,
) {
  const normalizedAgentId = normalizeAgentId(
    maybeAgentId ?? userIdOrAgentId ?? null,
  );

  if (normalizedAgentId === "tax") {
    return [
      "What tax documents are missing for my business?",
      "Can you review my GST readiness from approved documents?",
      "What verified tax rules are available for my business country and financial year?",
      "What should I ask my CA to verify before filing?",
    ];
  }

  if (normalizedAgentId === "cashflow") {
    return [
      "How is my cash flow looking?",
      "What cash risks should I watch?",
      "Which expenses should I control first?",
      "What should I do to improve liquidity?",
    ];
  }

  if (normalizedAgentId === "accountant") {
    return [
      "Which documents still need review?",
      "Is my financial data reliable enough?",
      "What documents should I upload next?",
      "Are there rejected documents I should replace?",
    ];
  }

  if (normalizedAgentId === "cfo") {
    return [
      "What is my business financial health?",
      "What should I focus on this month?",
      "How can I improve profitability?",
      "What are the biggest financial risks?",
    ];
  }

  return [
    "Summarize my business financial health.",
    "What should I do next financially?",
    "Which documents are missing?",
    "What risks should I watch?",
  ];
}
export type BusinessChatAnswerResult = {
  answer: string;
  agentId: AiAgentId;
  agentName: string;
  suggestions: string[];
};

export async function answerBusinessQuestion(
  input: AnswerBusinessQuestionInput | string,
  questionArg?: string,
  agentIdArg?: AiAgentId | string | null,
): Promise<BusinessChatAnswerResult> {
  const userId = typeof input === "string" ? input : input.userId;

  const question =
    typeof input === "string"
      ? questionArg ?? ""
      : input.question ?? input.message ?? "";

  const agentId = normalizeAgentId(
    typeof input === "string" ? agentIdArg ?? null : input.agentId ?? null,
  );

  if (!userId) {
    return {
      answer: "User session was not found. Please log in again.",
      agentId,
      agentName: AGENT_PROFILES[agentId].name,
      suggestions: getBusinessChatSuggestions(agentId),
    };
  }

  if (!question.trim()) {
    return {
      answer: "Please ask a finance question so Aureli can help.",
      agentId,
      agentName: AGENT_PROFILES[agentId].name,
      suggestions: getBusinessChatSuggestions(agentId),
    };
  }

  const prompt = await buildPrompt({
    userId,
    question: question.trim(),
    agentId,
  });

  const answer = await generateAiAnswer(prompt);

  return {
    answer,
    agentId,
    agentName: AGENT_PROFILES[agentId].name,
    suggestions: getBusinessChatSuggestions(agentId),
  };
}