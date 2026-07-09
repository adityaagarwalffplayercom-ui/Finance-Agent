import { NextResponse } from "next/server";
import type { TaxRuleType } from "@prisma/client";
import {
  adminForbiddenResponse,
  isAuthorizedByAdminSecret,
} from "@/lib/admin-auth";
import {
  adminPrisma,
  assertGlobalAdminResource,
} from "@/lib/privacy-firewall";
import { extractTaxSourceTextFromFile } from "@/lib/tax-source-extractor";

export const runtime = "nodejs";

const VALID_TAX_TYPES: TaxRuleType[] = [
  "INCOME_TAX",
  "GST",
  "VAT",
  "SALES_TAX",
  "CORPORATE_TAX",
  "PAYROLL_TAX",
  "DEDUCTION",
  "FILING",
  "COMPLIANCE",
  "OTHER",
];

const MAX_CHUNK_LENGTH = 2500;
const MIN_CHUNK_LENGTH = 500;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTaxType(value: unknown): TaxRuleType | null {
  const cleaned = cleanString(value).toUpperCase() as TaxRuleType;

  if (VALID_TAX_TYPES.includes(cleaned)) {
    return cleaned;
  }

  return null;
}

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

function createTaxKnowledgeChunks(text: string) {
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

function isTextFile(fileName: string, mimeType: string) {
  const lowerName = fileName.toLowerCase();

  return (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("csv") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".json")
  );
}

function isGeminiReadableFile(fileName: string, mimeType: string) {
  const lowerName = fileName.toLowerCase();

  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("image/") ||
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".webp")
  );
}

async function fileToBase64(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString("base64");
}

async function getTaxKnowledgeSummary() {
  const [documents, chunks] = await Promise.all([
    adminPrisma.taxSourceDocument.groupBy({
      by: ["countryCode", "verificationStatus"],
      _count: {
        id: true,
      },
    }),
    adminPrisma.taxKnowledgeChunk.groupBy({
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

async function createTaxKnowledgeDocument(input: {
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
}) {
  const originalText = cleanText(input.originalText);

  if (!originalText || originalText.length < 50) {
    throw new Error("Tax knowledge text is too short.");
  }

  const chunks = createTaxKnowledgeChunks(originalText);
  const verificationStatus = input.markVerified ? "VERIFIED" : "DRAFT";
  const lastVerifiedAt = input.markVerified ? new Date() : null;

  return adminPrisma.$transaction(async (tx) => {
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

export async function GET(request: Request) {
  if (!isAuthorizedByAdminSecret(request)) {
    return adminForbiddenResponse(request);
  }

  assertGlobalAdminResource("tax_knowledge");

  const documents = await adminPrisma.taxSourceDocument.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    select: {
      id: true,
      countryCode: true,
      countryName: true,
      financialYear: true,
      taxType: true,
      title: true,
      sourceName: true,
      sourceUrl: true,
      fileName: true,
      mimeType: true,
      verificationStatus: true,
      lastVerifiedAt: true,
      createdAt: true,
      _count: {
        select: {
          chunks: true,
        },
      },
    },
  });

  const summary = await getTaxKnowledgeSummary();

  return NextResponse.json({
    message: "Tax knowledge API working with Admin Privacy Firewall.",
    privacy: {
      adminCanAccessUserData: false,
      adminScope: "Global tax knowledge only",
    },
    summary,
    documents,
  });
}

export async function POST(request: Request) {
  if (!isAuthorizedByAdminSecret(request)) {
    return adminForbiddenResponse(request);
  }

  assertGlobalAdminResource("tax_knowledge");

  const formData = await request.formData();

  const countryCode = cleanString(formData.get("countryCode")).toUpperCase();
  const countryName = cleanString(formData.get("countryName"));
  const financialYear = cleanString(formData.get("financialYear"));
  const taxType = normalizeTaxType(formData.get("taxType"));
  const title = cleanString(formData.get("title"));
  const sourceName = cleanString(formData.get("sourceName"));
  const sourceUrl = cleanString(formData.get("sourceUrl")) || null;
  const markVerified = cleanString(formData.get("markVerified")) === "true";
  const text = cleanString(formData.get("text"));

  if (
    !countryCode ||
    !countryName ||
    !financialYear ||
    !taxType ||
    !title ||
    !sourceName
  ) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: countryCode, countryName, financialYear, taxType, title, and sourceName.",
      },
      {
        status: 400,
      },
    );
  }

  const file = formData.get("file");

  let originalText = text;
  let fileName: string | null = null;
  let mimeType: string | null = null;

  if (file instanceof File && file.size > 0) {
    fileName = file.name;
    mimeType = file.type || "application/octet-stream";

    if (isTextFile(fileName, mimeType)) {
      originalText = await file.text();
    } else if (isGeminiReadableFile(fileName, mimeType)) {
      const base64Data = await fileToBase64(file);

      originalText = await extractTaxSourceTextFromFile({
        fileName,
        mimeType,
        base64Data,
        countryCode,
        countryName,
        financialYear,
        taxType,
        sourceName,
      });
    } else {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Upload TXT, MD, CSV, JSON, PDF, PNG, JPG, JPEG, or WEBP.",
          received: {
            fileName,
            mimeType,
          },
        },
        {
          status: 400,
        },
      );
    }
  }

  if (!originalText || originalText.trim().length < 50) {
    return NextResponse.json(
      {
        error:
          "Tax knowledge text is missing or too short. Upload a supported file or paste extracted text.",
      },
      {
        status: 400,
      },
    );
  }

  const sourceDocument = await createTaxKnowledgeDocument({
    countryCode,
    countryName,
    financialYear,
    taxType,
    title,
    sourceName,
    sourceUrl,
    fileName,
    mimeType,
    originalText,
    uploadedBy: "admin-api-secret",
    markVerified,
  });

  return NextResponse.json({
    message:
      "Tax knowledge document uploaded, extracted, chunked, and saved through Admin Privacy Firewall.",
    privacy: {
      adminCanAccessUserData: false,
      savedScope: "Global tax knowledge only",
    },
    sourceDocument,
  });
}