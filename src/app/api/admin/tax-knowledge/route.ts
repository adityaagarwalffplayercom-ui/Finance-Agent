import { NextResponse } from "next/server";
import type { TaxRuleType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createTaxKnowledgeDocument,
  getTaxKnowledgeSummary,
} from "@/lib/tax-knowledge-engine";
import { extractTaxSourceTextFromFile } from "@/lib/tax-source-extractor";

export const runtime = "nodejs";
export const maxDuration = 300;

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

function getExpectedAdminSecret() {
  return process.env.ADMIN_API_SECRET?.trim() ?? "";
}

function isAuthorizedBySecret(request: Request) {
  const expectedSecret = getExpectedAdminSecret();

  if (!expectedSecret) {
    return false;
  }

  const receivedSecret =
    request.headers.get("x-admin-api-secret")?.trim() ?? "";

  return receivedSecret === expectedSecret;
}

function forbiddenResponse(request: Request) {
  const receivedSecret =
    request.headers.get("x-admin-api-secret")?.trim() ?? "";

  return NextResponse.json(
    {
      error: "Admin API secret required.",
      debug: {
        adminSecretConfigured: Boolean(getExpectedAdminSecret()),
        receivedXAdminSecretHeader: Boolean(receivedSecret),
        receivedSecretLength: receivedSecret.length,
        expectedSecretLength: getExpectedAdminSecret().length,
        secretMatched: receivedSecret === getExpectedAdminSecret(),
      },
    },
    {
      status: 403,
    },
  );
}

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

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function errorJson(error: unknown, status = 500) {
  const message = errorToMessage(error);

  console.error("Tax knowledge API error:", error);

  return NextResponse.json(
    {
      error: message || "Tax knowledge API failed.",
    },
    {
      status,
    },
  );
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

export async function GET(request: Request) {
  try {
    if (!isAuthorizedBySecret(request)) {
      return forbiddenResponse(request);
    }

    const documents = await prisma.taxSourceDocument.findMany({
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
      message: "Tax knowledge API working.",
      summary,
      documents,
    });
  } catch (error) {
    return errorJson(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isAuthorizedBySecret(request)) {
      return forbiddenResponse(request);
    }

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

      const fileSizeInMb = file.size / 1024 / 1024;

      if (fileSizeInMb > 25) {
        return NextResponse.json(
          {
            error:
              "File is too large for direct upload. Use a smaller TXT file or split the PDF into smaller parts.",
            received: {
              fileName,
              mimeType,
              sizeMb: Number(fileSizeInMb.toFixed(2)),
            },
          },
          {
            status: 413,
          },
        );
      }

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
      message: "Tax knowledge document uploaded, extracted, and chunked.",
      sourceDocument,
    });
  } catch (error) {
    return errorJson(error);
  }
}