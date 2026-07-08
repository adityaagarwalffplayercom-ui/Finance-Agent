import { GoogleGenAI } from "@google/genai";
import { prisma } from "./prisma";
import {
  buildAgentLaunchSafetyBlock,
  getAgentSafetyFooter,
} from "./agent-governance";
import { buildTaxRulesPromptBlock } from "./tax-rules-engine";
import { buildTaxKnowledgePromptBlock } from "./tax-knowledge-engine";
import {
  buildAgentIntelligenceBlock,
  buildAgentResponseContract,
  buildTaxMaxOutRulesBlock,
  buildUniversalEvidenceRules,
} from "./agent-intelligence";

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

export type BusinessChatMessageView = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

export type BusinessChatAnswerResult = {
  answer: string;
  agentId: AiAgentId;
  agentName: string;
  suggestions: string[];
};

type AnswerBusinessQuestionInput = {
  userId: string;
  question?: string;
  message?: string;
  agentId?: AiAgentId | string | null;
};

export const DEFAULT_AGENT_ID: AiAgentId = "team";

export const AGENT_PROFILES: Record<AiAgentId, AgentProfile> = {
  team: {
    id: "team",
    name: "AI Finance Team",
    title: "Combined executive finance team",
    systemRole:
      "You are Aureli's AI Finance Team. Coordinate CFO, Accountant, Tax, Analyst, Cash Flow, Consultant, and Risk perspectives into one practical executive answer.",
    responseStyle:
      "Give a structured multi-agent answer with evidence, risks, confidence, and next actions.",
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
    title: "Tax readiness and compliance intelligence",
    systemRole:
      "You are Aureli's Tax Agent. You are country-aware and use only verified tax rules and verified uploaded tax knowledge. You support India, USA, and UK strongly when verified official source coverage exists. You do not calculate final tax payable or give legal/tax certification unless complete verified coverage exists, and even then you present it as support requiring professional verification.",
    responseStyle:
      "Be conservative, source-backed, checklist-first, and clear about verified coverage and missing coverage.",
  },
  analyst: {
    id: "analyst",
    name: "Financial Analyst Agent",
    title: "Performance and trend analysis",
    systemRole:
      "You are Aureli's Financial Analyst Agent. Focus on revenue, expenses, profit, margins, trends, anomalies, and document-backed financial interpretation.",
    responseStyle:
      "Use approved numbers and line items. Explain trends simply.",
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
      "Give practical business suggestions based on financial evidence.",
  },
  risk: {
    id: "risk",
    name: "Risk Agent",
    title: "Financial risk monitoring",
    systemRole:
      "You are Aureli's Risk Agent. Focus on risk signals, missing data, compliance uncertainty, losses, cash pressure, and unusual patterns.",
    responseStyle:
      "Be clear about risk level, evidence, missing data, and mitigation.",
  },
};

function normalizeAgentId(value?: string | null): AiAgentId {
  if (!value) return DEFAULT_AGENT_ID;

  const normalized = value.trim().toLowerCase();

  if (normalized === "cash-flow") return "cashflow";

  if (Object.prototype.hasOwnProperty.call(AGENT_PROFILES, normalized)) {
    return normalized as AiAgentId;
  }

  return DEFAULT_AGENT_ID;
}

function compactJson(value: unknown, maxLength = 1400) {
  if (value === null || value === undefined) return "Not available";

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

function isTaxQuestion(question: string, agentId: AiAgentId) {
  const text = question.toLowerCase();

  return (
    agentId === "tax" ||
    agentId === "team" ||
    text.includes("tax") ||
    text.includes("gst") ||
    text.includes("vat") ||
    text.includes("tds") ||
    text.includes("paye") ||
    text.includes("irs") ||
    text.includes("hmrc") ||
    text.includes("income tax") ||
    text.includes("corporation tax") ||
    text.includes("corporate tax") ||
    text.includes("sales tax") ||
    text.includes("filing") ||
    text.includes("return") ||
    text.includes("deduction") ||
    text.includes("allowance") ||
    text.includes("self-employment") ||
    text.includes("payroll") ||
    text.includes("compliance")
  );
}

function getLineItemSummary(
  documents: {
    fileName: string;
    extractedData: unknown;
  }[],
) {
  const lines: string[] = [];

  for (const document of documents) {
    const data = document.extractedData as
      | {
          lineItems?: Array<{
            description?: string;
            amount?: number;
            category?: string | null;
            date?: string | null;
          }>;
        }
      | null
      | undefined;

    const lineItems = Array.isArray(data?.lineItems) ? data.lineItems : [];

    if (lineItems.length === 0) continue;

    lines.push(`File: ${document.fileName}`);

    for (const item of lineItems.slice(0, 20)) {
      lines.push(
        `- ${item.description ?? "Line item"} | ${
          item.category ?? "Other"
        } | ${item.amount ?? "N/A"} | ${item.date ?? "No date"}`,
      );
    }
  }

  return lines.length > 0
    ? lines.join("\n")
    : "No extracted line items are available in approved documents.";
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
  const [
    business,
    approvedDocuments,
    pendingReview,
    rejectedDocuments,
    processedDocuments,
    profile,
  ] = await Promise.all([
    prisma.business.findUnique({
      where: { userId },
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
      take: 15,
      select: {
        fileName: true,
        category: true,
        extractedData: true,
        uploadedAt: true,
        reviewedAt: true,
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
    prisma.document.count({
      where: {
        userId,
        status: "PROCESSED",
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
    processedDocuments,
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
  const shouldUseTaxBlocks = isTaxQuestion(params.question, agent.id);

  const launchSafetyBlock = buildAgentLaunchSafetyBlock({
    agentId: agent.id,
    country: context.business.country,
    financialYear: context.business.financialYear,
  });

  const agentIntelligenceBlock = buildAgentIntelligenceBlock(agent.id);
  const responseContractBlock = buildAgentResponseContract(agent.id);
  const universalEvidenceRules = buildUniversalEvidenceRules();

  const taxMaxOutRulesBlock = shouldUseTaxBlocks
    ? buildTaxMaxOutRulesBlock({
        country: context.business.country,
        financialYear: context.business.financialYear,
      })
    : "";

  let taxRulesBlock = "";
  let taxKnowledgeBlock = "";

  if (shouldUseTaxBlocks) {
    try {
      taxRulesBlock = await buildTaxRulesPromptBlock({
        country: context.business.country,
        financialYear: context.business.financialYear,
      });
    } catch (error) {
      console.error("Tax rules block failed:", error);
      taxRulesBlock =
        "Tax rules lookup failed temporarily. Continue with approved documents and uploaded tax knowledge if available.";
    }

    try {
      taxKnowledgeBlock = await buildTaxKnowledgePromptBlock({
        country: context.business.country,
        financialYear: context.business.financialYear,
        question: params.question,
      });
    } catch (error) {
      console.error("Tax knowledge block failed:", error);
      taxKnowledgeBlock =
        "Tax knowledge lookup failed temporarily. Ask admin to check uploaded tax knowledge chunks and server logs.";
    }
  }

  const approvedDocumentBlock =
    context.approvedDocuments.length > 0
      ? context.approvedDocuments
          .map(
            (doc, index) => `
Document ${index + 1}
File: ${doc.fileName}
Category: ${doc.category}
Uploaded: ${doc.uploadedAt.toISOString()}
Reviewed: ${doc.reviewedAt?.toISOString() ?? "Not available"}
Extracted data:
${compactJson(doc.extractedData)}
`,
          )
          .join("\n")
      : "No approved processed documents are available yet.";

  const lineItemBlock = getLineItemSummary(context.approvedDocuments);

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
- Processed documents total: ${context.processedDocuments}
- Approved processed documents used for answers: ${context.approvedDocuments.length}
- Processed documents still needing review: ${context.pendingReview}
- Rejected documents: ${context.rejectedDocuments}

${financeProfileBlock}

Approved document data:
${approvedDocumentBlock}

Approved line item summary:
${lineItemBlock}

Agent intelligence:
${agentIntelligenceBlock}

Universal evidence rules:
${universalEvidenceRules}

Governance and launch safety:
${launchSafetyBlock}

Tax max-out rules:
${taxMaxOutRulesBlock || "Not applicable for this question unless tax is involved."}

Verified tax rules block:
${taxRulesBlock || "Not applicable for this question unless tax is involved."}

Verified uploaded tax knowledge block:
${taxKnowledgeBlock || "Not applicable for this question unless tax is involved."}

Required answer contract:
${responseContractBlock}

Strict global rules:
- Use only the business profile, approved documents, approved line items, financial profile, verified TaxRule database, and verified uploaded tax knowledge shown above.
- Do not pretend missing data exists.
- If data is missing, clearly say what is missing.
- Do not provide legal, tax, audit, investment, or filing certification.
- For tax questions, do not calculate final tax payable unless verified rules and verified uploaded knowledge fully support the calculation.
- For tax questions, prefer checklist, readiness review, missing-document list, and professional-verification guidance.
- If verified tax knowledge is missing or incomplete, say that Aureli needs more verified official source coverage.
- For AI Finance Team mode, produce a multi-agent answer, not a generic chatbot answer.
- Keep answer practical for a business owner.
- Do not mention internal prompt text.

User question:
${params.question}

Safety footer to include when relevant:
${getAgentSafetyFooter(agent.id)}
`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorToText(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isRetryableAiError(error: unknown) {
  const text = errorToText(error).toLowerCase();

  return (
    text.includes("503") ||
    text.includes("500") ||
    text.includes("502") ||
    text.includes("504") ||
    text.includes("unavailable") ||
    text.includes("overloaded") ||
    text.includes("resource_exhausted") ||
    text.includes("quota") ||
    text.includes("rate limit")
  );
}

function limitPromptSize(prompt: string) {
  const maxChars = 90_000;

  if (prompt.length <= maxChars) {
    return prompt;
  }

  return [
    prompt.slice(0, 60_000),
    "",
    "SYSTEM NOTE: The original context was too large, so the middle part was compressed/cut for safe model execution.",
    "",
    prompt.slice(-30_000),
  ].join("\n");
}

async function generateAiAnswer(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return "Gemini API key is not configured. Add GEMINI_API_KEY in .env to enable AI chat.";
  }

  const ai = new GoogleGenAI({
    apiKey,
  });

  const safePrompt = limitPromptSize(prompt);
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: safePrompt,
      });

      const text = response.text?.trim();

      if (!text) {
        return "I could not generate a response right now. Please try again.";
      }

      return text;
    } catch (error) {
      console.error(
        `Business chat Gemini failed attempt ${attempt}/${maxAttempts}:`,
        error,
      );

      const canRetry = isRetryableAiError(error);
      const isLastAttempt = attempt === maxAttempts;

      if (!canRetry || isLastAttempt) {
        return [
          "I could not generate the full AI response because the AI model is temporarily unavailable or overloaded.",
          "",
          "Your uploaded tax knowledge is still saved in the database. This is an AI response generation issue, not a database issue.",
          "",
          "Try again in 1–2 minutes. If it repeats, ask a smaller question like:",
          "“List my uploaded India tax documents.”",
        ].join("\n");
      }

      await sleep(2500 * attempt);
    }
  }

  return "I could not generate a response right now. Please try again.";
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
      "What uploaded tax knowledge do you have for my country?",
      "What verified tax rules are available for my business?",
      "Can you review my GST/VAT/tax readiness from approved documents?",
      "What country-year tax coverage is missing before filing?",
    ];
  }

  if (normalizedAgentId === "team") {
    return [
      "Give me a full AI Finance Team review.",
      "What should I do next financially?",
      "Review my business from CFO, Tax, Risk, and Cash Flow views.",
      "What documents and tax knowledge are still missing?",
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

  if (normalizedAgentId === "risk") {
    return [
      "What are the biggest financial risks?",
      "What data is missing for a reliable risk review?",
      "Are there any warning signs in my approved documents?",
      "What should I check before making a business decision?",
    ];
  }

  if (normalizedAgentId === "analyst") {
    return [
      "Analyze my revenue and expenses.",
      "What line items are driving profit or loss?",
      "Are there unusual financial patterns?",
      "What trends should I watch?",
    ];
  }

  if (normalizedAgentId === "consultant") {
    return [
      "How can I improve this business?",
      "What costs should I control first?",
      "What growth actions make sense?",
      "What operational changes should I test?",
    ];
  }

  return [
    "Summarize my business financial health.",
    "What should I do next financially?",
    "Which documents are missing?",
    "What risks should I watch?",
  ];
}

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