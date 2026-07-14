import { prisma } from "./prisma";
import type { TaxRuleType } from "@prisma/client";
import { normalizeTaxCountry } from "./tax-rules-engine";

export type CreateTaxKnowledgeInput = {
  countryCode: string;
  countryName: string;
  financialYear: string;
  taxType: TaxRuleType;
  title: string;
  sourceName: string;
  sourceUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  originalText: string;
  uploadedBy?: string | null;
  markVerified?: boolean;
};

const MAX_CHUNK_LENGTH = 2500;
const MIN_CHUNK_LENGTH = 500;

function cleanText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function splitIntoParagraphs(text: string) {
  return text
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function createTaxKnowledgeChunks(text: string) {
  const cleaned = cleanText(text);
  const paragraphs = splitIntoParagraphs(cleaned);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= MAX_CHUNK_LENGTH) {
      current = candidate;
      continue;
    }

    if (current.length >= MIN_CHUNK_LENGTH) {
      chunks.push(current);
      current = paragraph;
      continue;
    }

    if (paragraph.length > MAX_CHUNK_LENGTH) {
      for (let index = 0; index < paragraph.length; index += MAX_CHUNK_LENGTH) {
        chunks.push(paragraph.slice(index, index + MAX_CHUNK_LENGTH));
      }

      current = "";
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    current = paragraph;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [cleaned];
}

export async function createTaxKnowledgeDocument(
  input: CreateTaxKnowledgeInput,
) {
  const originalText = cleanText(input.originalText);

  if (!originalText || originalText.length < 50) {
    throw new Error("Tax knowledge text is too short.");
  }

  const chunks = createTaxKnowledgeChunks(originalText);
  const verificationStatus = input.markVerified ? "VERIFIED" : "DRAFT";
  const lastVerifiedAt = input.markVerified ? new Date() : null;

  return prisma.$transaction(async (tx) => {
    const sourceDocument = await tx.taxSourceDocument.create({
      data: {
        countryCode: input.countryCode.trim().toUpperCase(),
        countryName: input.countryName.trim(),
        financialYear: input.financialYear.trim(),
        taxType: input.taxType,
        title: input.title.trim(),
        sourceName: input.sourceName.trim(),
        sourceUrl: input.sourceUrl?.trim() || null,
        fileName: input.fileName?.trim() || null,
        mimeType: input.mimeType?.trim() || null,
        originalText,
        uploadedBy: input.uploadedBy?.trim() || null,
        verificationStatus,
        lastVerifiedAt,
      },
    });

    await tx.taxKnowledgeChunk.createMany({
      data: chunks.map((chunk, index) => ({
        sourceDocumentId: sourceDocument.id,
        countryCode: sourceDocument.countryCode,
        countryName: sourceDocument.countryName,
        financialYear: sourceDocument.financialYear,
        taxType: sourceDocument.taxType,
        chunkIndex: index + 1,
        title: `${sourceDocument.title} — Part ${index + 1}`,
        content: chunk,
        sourceName: sourceDocument.sourceName,
        sourceUrl: sourceDocument.sourceUrl,
        verificationStatus,
        lastVerifiedAt,
      })),
    });

    return tx.taxSourceDocument.findUnique({
      where: {
        id: sourceDocument.id,
      },
      include: {
        chunks: {
          orderBy: {
            chunkIndex: "asc",
          },
        },
      },
    });
  });
}

function inferTaxTypeFromQuestion(question: string): TaxRuleType | null {
  const text = question.toLowerCase();

  if (text.includes("gst")) return "GST";
  if (text.includes("vat")) return "VAT";
  if (text.includes("sales tax")) return "SALES_TAX";
  if (text.includes("corporation") || text.includes("corporate")) {
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
    text.includes("expense") ||
    text.includes("allowance")
  ) {
    return "DEDUCTION";
  }
  if (
    text.includes("filing") ||
    text.includes("return") ||
    text.includes("register")
  ) {
    return "FILING";
  }
  if (
    text.includes("compliance") ||
    text.includes("tds") ||
    text.includes("notice")
  ) {
    return "COMPLIANCE";
  }
  if (text.includes("income tax")) return "INCOME_TAX";

  return null;
}

export async function searchVerifiedTaxKnowledge(params: {
  countryCode: string;
  financialYear: string;
  taxType?: TaxRuleType | null;
  query: string;
  limit?: number;
}) {
  const words = params.query
    .toLowerCase()
    .split(/\W+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4)
    .slice(0, 14);

  const chunks = await prisma.taxKnowledgeChunk.findMany({
    where: {
      countryCode: params.countryCode.trim().toUpperCase(),
      financialYear: params.financialYear.trim(),
      verificationStatus: "VERIFIED",
      ...(params.taxType
        ? {
            taxType: params.taxType,
          }
        : {}),
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 250,
  });

  return chunks
    .map((chunk) => {
      const haystack = `${chunk.title} ${chunk.content}`.toLowerCase();

      const score = words.reduce(
        (total, word) => total + (haystack.includes(word) ? 1 : 0),
        0,
      );

      return {
        chunk,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, params.limit ?? 6)
    .map((item) => item.chunk);
}

export async function buildTaxKnowledgePromptBlock(params: {
  country?: string | null;
  financialYear?: string | null;
  question: string;
}) {
  const country = normalizeTaxCountry(params.country);
  const financialYear = params.financialYear?.trim();

  if (!financialYear || financialYear === "Not set") {
    return `
Verified uploaded tax knowledge available: NO

Reason:
- Business financial year is not set.

Tax Agent instruction:
- Ask the user to complete Business Profile financial year before giving country-year-specific tax guidance.
- Continue with general document-readiness checklist only.
`;
  }

  const inferredTaxType = inferTaxTypeFromQuestion(params.question);

  const chunks = await searchVerifiedTaxKnowledge({
    countryCode: country.countryCode,
    financialYear,
    taxType: inferredTaxType,
    query: params.question,
    limit: 6,
  });

  if (chunks.length === 0) {
    return `
Verified uploaded tax knowledge available: NO

Search details:
- Country: ${country.countryName}
- Country code: ${country.countryCode}
- Financial year: ${financialYear}
- Inferred tax type: ${inferredTaxType ?? "Not specific"}

Tax Agent instruction:
- Do not claim uploaded official knowledge coverage for this question.
- Use only verified TaxRule database if available.
- If verified TaxRule coverage is also incomplete, give checklist guidance only.
- Recommend review by a ${country.professionalLabel}.
`;
  }

  return `
Verified uploaded tax knowledge available: YES

Use these verified uploaded knowledge chunks only:
${chunks
  .map(
    (chunk, index) => `
Knowledge chunk ${index + 1}
Title: ${chunk.title}
Country: ${chunk.countryName}
Financial year: ${chunk.financialYear}
Tax type: ${chunk.taxType}
Source: ${chunk.sourceName}
Source URL: ${chunk.sourceUrl ?? "Not available"}
Last verified: ${chunk.lastVerifiedAt?.toISOString() ?? "Not available"}
Content:
${chunk.content}
`,
  )
  .join("\n")}

Tax Agent instruction:
- You may use these chunks as verified uploaded tax knowledge.
- Do not go beyond the content shown above.
- If the user asks for exact tax payable, filing, legal interpretation, or final compliance decision, explain that Actic Finance provides support only and professional verification is still needed.
`;
}

export async function getTaxKnowledgeSummary() {
  const [documents, chunks] = await Promise.all([
    prisma.taxSourceDocument.groupBy({
      by: ["countryCode", "verificationStatus"],
      _count: {
        id: true,
      },
    }),
    prisma.taxKnowledgeChunk.groupBy({
      by: ["countryCode", "verificationStatus"],
      _count: {
        id: true,
      },
    }),
  ]);

  return {
    documents,
    chunks,
  };
}