import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  upsertVerifiedTaxRule,
  type TaxRuleInput,
} from "@/lib/tax-rules-engine";

export const runtime = "nodejs";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isAuthorizedBySecret(request: Request) {
  const adminSecret = process.env.ADMIN_API_SECRET?.trim();

  if (!adminSecret) {
    return false;
  }

  const bearerHeader = request.headers.get("authorization")?.trim();
  const xAdminSecret = request.headers.get("x-admin-api-secret")?.trim();

  return (
    bearerHeader === `Bearer ${adminSecret}` ||
    xAdminSecret === adminSecret
  );
}

async function requireAdmin(request: Request) {
  if (isAuthorizedBySecret(request)) {
    return {
      userId: "admin-api-secret",
      email: "admin-api-secret",
    };
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const email = session?.user?.email?.toLowerCase();
  const adminEmails = getAdminEmails();

  if (!session?.user?.id || !email || !adminEmails.includes(email)) {
    return null;
  }

  return {
    userId: session.user.id,
    email,
  };
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validatePayload(payload: unknown): TaxRuleInput | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as Record<string, unknown>;

  const taxType = cleanString(data.taxType) as TaxRuleInput["taxType"];

  const validTaxTypes: TaxRuleInput["taxType"][] = [
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

  if (!validTaxTypes.includes(taxType)) {
    return null;
  }

  const input: TaxRuleInput = {
    countryCode: cleanString(data.countryCode).toUpperCase(),
    countryName: cleanString(data.countryName),
    financialYear: cleanString(data.financialYear),
    taxType,
    ruleKey: cleanString(data.ruleKey),
    title: cleanString(data.title),
    summary: cleanString(data.summary),
    ruleText: cleanString(data.ruleText),
    sourceName: cleanString(data.sourceName),
    sourceUrl: cleanString(data.sourceUrl),
    sourcePublishedAt: cleanString(data.sourcePublishedAt) || null,
    effectiveFrom: cleanString(data.effectiveFrom) || null,
    effectiveTo: cleanString(data.effectiveTo) || null,
    verifiedBy: cleanString(data.verifiedBy) || null,
    notes: cleanString(data.notes) || null,
  };

  const requiredFields = [
    input.countryCode,
    input.countryName,
    input.financialYear,
    input.ruleKey,
    input.title,
    input.summary,
    input.ruleText,
    input.sourceName,
    input.sourceUrl,
  ];

  if (requiredFields.some((value) => !value)) {
    return null;
  }

  return input;
}

function forbiddenResponse(request: Request) {
  return NextResponse.json(
    {
      error:
        "Admin access required. Login with an admin email or pass ADMIN_API_SECRET.",
      debug: {
        adminSecretConfigured: Boolean(process.env.ADMIN_API_SECRET?.trim()),
        adminEmailsConfigured: Boolean(process.env.ADMIN_EMAILS?.trim()),
        receivedAuthorizationHeader: Boolean(
          request.headers.get("authorization"),
        ),
        receivedXAdminSecretHeader: Boolean(
          request.headers.get("x-admin-api-secret"),
        ),
      },
    },
    {
      status: 403,
    },
  );
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return forbiddenResponse(request);
  }

  const rules = await prisma.taxRule.findMany({
    orderBy: [
      {
        countryCode: "asc",
      },
      {
        financialYear: "desc",
      },
      {
        taxType: "asc",
      },
    ],
    take: 200,
  });

  return NextResponse.json({
    rules,
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return forbiddenResponse(request);
  }

  const payload = await request.json().catch(() => null);
  const input = validatePayload(payload);

  if (!input) {
    return NextResponse.json(
      {
        error:
          "Invalid tax rule payload. Required: countryCode, countryName, financialYear, taxType, ruleKey, title, summary, ruleText, sourceName, sourceUrl.",
      },
      {
        status: 400,
      },
    );
  }

  const rule = await upsertVerifiedTaxRule({
    ...input,
    verifiedBy: input.verifiedBy ?? admin.email,
  });

  return NextResponse.json({
    message: "Tax rule verified and saved.",
    rule,
  });
}