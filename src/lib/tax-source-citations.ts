import type { TaxRuleType } from "@prisma/client";
import { prisma } from "./prisma";

type CitationTaxTypeFilter = TaxRuleType | null;

function normalizeCountryCode(value?: string | null) {
  const cleaned = value?.trim().toLowerCase() ?? "";

  if (
    cleaned === "india" ||
    cleaned === "in" ||
    cleaned === "bharat" ||
    cleaned === "ind"
  ) {
    return "IN";
  }

  if (
    cleaned === "united states" ||
    cleaned === "usa" ||
    cleaned === "us" ||
    cleaned === "america" ||
    cleaned === "united states of america"
  ) {
    return "US";
  }

  if (
    cleaned === "uk" ||
    cleaned === "gb" ||
    cleaned === "great britain" ||
    cleaned === "united kingdom" ||
    cleaned === "england"
  ) {
    return "UK";
  }

  return cleaned.toUpperCase();
}

function inferTaxTypeFromQuestion(question: string): CitationTaxTypeFilter {
  const text = question.toLowerCase();

  if (text.includes("gst")) return "GST";
  if (text.includes("vat")) return "VAT";
  if (text.includes("sales tax")) return "SALES_TAX";

  if (
    text.includes("corporation tax") ||
    text.includes("corporate tax") ||
    text.includes("company tax")
  ) {
    return "CORPORATE_TAX";
  }

  if (
    text.includes("payroll") ||
    text.includes("paye") ||
    text.includes("employment tax") ||
    text.includes("self-employment")
  ) {
    return "PAYROLL_TAX";
  }

  if (
    text.includes("deduction") ||
    text.includes("expense proof") ||
    text.includes("allowance")
  ) {
    return "DEDUCTION";
  }

  if (
    text.includes("filing") ||
    text.includes("return") ||
    text.includes("itr") ||
    text.includes("form")
  ) {
    return "FILING";
  }

  if (
    text.includes("compliance") ||
    text.includes("tds") ||
    text.includes("tcs") ||
    text.includes("notice") ||
    text.includes("recordkeeping")
  ) {
    return "COMPLIANCE";
  }

  if (
    text.includes("income tax") ||
    text.includes("irs") ||
    text.includes("self assessment")
  ) {
    return "INCOME_TAX";
  }

  return null;
}

function getSearchWords(question: string) {
  return question
    .toLowerCase()
    .split(/\W+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4)
    .slice(0, 12);
}

function scoreText(text: string, words: string[]) {
  const haystack = text.toLowerCase();

  return words.reduce(
    (total, word) => total + (haystack.includes(word) ? 1 : 0),
    0,
  );
}

export async function getVerifiedTaxSourceCitations(params: {
  country?: string | null;
  financialYear?: string | null;
  question: string;
  limit?: number;
}) {
  const countryCode = normalizeCountryCode(params.country);
  const financialYear = params.financialYear?.trim();

  if (!countryCode || !financialYear || financialYear === "Not set") {
    return {
      countryCode: countryCode || "Not set",
      financialYear: financialYear || "Not set",
      inferredTaxType: null,
      citations: [],
      reason:
        "Country or financial year is missing, so source citations cannot be selected.",
    };
  }

  const inferredTaxType = inferTaxTypeFromQuestion(params.question);
  const words = getSearchWords(params.question);

  const [rules, chunks] = await Promise.all([
    prisma.taxRule.findMany({
      where: {
        countryCode,
        financialYear,
        verificationStatus: "VERIFIED",
        ...(inferredTaxType
          ? {
              taxType: inferredTaxType,
            }
          : {}),
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 40,
      select: {
        id: true,
        countryCode: true,
        countryName: true,
        financialYear: true,
        taxType: true,
        title: true,
        summary: true,
        ruleText: true,
        sourceName: true,
        sourceUrl: true,
        lastVerifiedAt: true,
        updatedAt: true,
      },
    }),
    prisma.taxKnowledgeChunk.findMany({
      where: {
        countryCode,
        financialYear,
        verificationStatus: "VERIFIED",
        ...(inferredTaxType
          ? {
              taxType: inferredTaxType,
            }
          : {}),
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 80,
      select: {
        id: true,
        sourceDocumentId: true,
        countryCode: true,
        countryName: true,
        financialYear: true,
        taxType: true,
        title: true,
        content: true,
        sourceName: true,
        sourceUrl: true,
        lastVerifiedAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const ruleCitations = rules.map((rule) => ({
    kind: "TaxRule" as const,
    id: rule.id,
    title: rule.title,
    taxType: rule.taxType,
    countryName: rule.countryName,
    financialYear: rule.financialYear,
    sourceName: rule.sourceName,
    sourceUrl: rule.sourceUrl,
    lastVerifiedAt: rule.lastVerifiedAt ?? rule.updatedAt,
    score: scoreText(`${rule.title} ${rule.summary} ${rule.ruleText}`, words),
    excerpt: rule.summary || rule.ruleText.slice(0, 400),
  }));

  const chunkCitations = chunks.map((chunk) => ({
    kind: "TaxKnowledgeChunk" as const,
    id: chunk.id,
    sourceDocumentId: chunk.sourceDocumentId,
    title: chunk.title,
    taxType: chunk.taxType,
    countryName: chunk.countryName,
    financialYear: chunk.financialYear,
    sourceName: chunk.sourceName,
    sourceUrl: chunk.sourceUrl,
    lastVerifiedAt: chunk.lastVerifiedAt ?? chunk.updatedAt,
    score: scoreText(`${chunk.title} ${chunk.content}`, words),
    excerpt: chunk.content.slice(0, 500),
  }));

  const citations = [...ruleCitations, ...chunkCitations]
    .filter((citation) => citation.score > 0 || inferredTaxType !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.lastVerifiedAt.getTime() - a.lastVerifiedAt.getTime();
    })
    .slice(0, params.limit ?? 8);

  return {
    countryCode,
    financialYear,
    inferredTaxType,
    citations,
    reason:
      citations.length > 0
        ? "Verified source citations found."
        : "No verified source citations matched this question.",
  };
}

export async function buildTaxSourceCitationsPromptBlock(params: {
  country?: string | null;
  financialYear?: string | null;
  question: string;
}) {
  const result = await getVerifiedTaxSourceCitations({
    country: params.country,
    financialYear: params.financialYear,
    question: params.question,
    limit: 8,
  });

  if (result.citations.length === 0) {
    return `
Tax source citations available: NO

Citation search details:
- Country code: ${result.countryCode}
- Financial year: ${result.financialYear}
- Inferred tax type: ${result.inferredTaxType ?? "Not specific"}
- Reason: ${result.reason}

Tax Agent citation instruction:
- Do not claim source-backed tax guidance for this question.
- Say verified source citations are missing or incomplete.
- Give checklist guidance only.
`;
  }

  return `
Tax source citations available: YES

Use only these verified citations when saying "Sources used":
${result.citations
  .map(
    (citation, index) => `
Citation ${index + 1}
Type: ${citation.kind}
Title: ${citation.title}
Country: ${citation.countryName}
Financial year: ${citation.financialYear}
Tax type: ${citation.taxType}
Source name: ${citation.sourceName}
Source URL: ${citation.sourceUrl || "Not available"}
Last verified: ${citation.lastVerifiedAt.toISOString()}
Relevant excerpt:
${citation.excerpt}
`,
  )
  .join("\n")}

Tax Agent citation instruction:
- Include a "Sources used" section for tax answers.
- Only cite the sources listed above.
- Do not invent source names, links, laws, sections, dates, or government updates.
- If these sources do not fully answer the question, say coverage is partial.
`;
}