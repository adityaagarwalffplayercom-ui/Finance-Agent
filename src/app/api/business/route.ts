import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type BusinessProfilePayload = {
  name?: unknown;
  industry?: unknown;
  businessType?: unknown;
  financialYear?: unknown;
  currency?: unknown;
  country?: unknown;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalStringValue(value: unknown) {
  const normalized = stringValue(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeCurrency(value: unknown) {
  const normalized = stringValue(value).toUpperCase();

  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }

  return "INR";
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: "You must be signed in to update business profile.",
      },
      {
        status: 401,
      },
    );
  }

  let body: BusinessProfilePayload;

  try {
    body = (await request.json()) as BusinessProfilePayload;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request body.",
      },
      {
        status: 400,
      },
    );
  }

  const name = stringValue(body.name);

  if (!name) {
    return NextResponse.json(
      {
        error: "Business name is required.",
      },
      {
        status: 400,
      },
    );
  }

  const industry = optionalStringValue(body.industry);
  const businessType = optionalStringValue(body.businessType);
  const financialYear = optionalStringValue(body.financialYear);
  const currency = normalizeCurrency(body.currency);
  const country = optionalStringValue(body.country);

  const business = await prisma.business.upsert({
    where: {
      userId: session.user.id,
    },
    create: {
      userId: session.user.id,
      name,
      industry,
      businessType,
      financialYear,
      currency,
      country,
    },
    update: {
      name,
      industry,
      businessType,
      financialYear,
      currency,
      country,
    },
    select: {
      id: true,
      name: true,
      industry: true,
      businessType: true,
      financialYear: true,
      currency: true,
      country: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    business,
  });
}