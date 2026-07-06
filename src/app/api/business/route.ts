import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type BusinessProfilePayload = {
  name?: unknown;
  industry?: unknown;
  businessType?: unknown;
  financialYear?: unknown;
  currency?: unknown;
  country?: unknown;
};

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function requiredString(value: unknown, fallback = "") {
  const cleaned = cleanString(value);
  return cleaned || fallback;
}

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "You must be signed in to view business profile.",
        },
        {
          status: 401,
        },
      );
    }

    const business = await prisma.business.findUnique({
      where: {
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      business,
    });
  } catch (error) {
    console.error("Business profile GET error:", error);

    return NextResponse.json(
      {
        error: "Business profile could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "You must be signed in to save business profile.",
        },
        {
          status: 401,
        },
      );
    }

    const payload = (await request.json().catch(() => null)) as
      | BusinessProfilePayload
      | null;

    if (!payload) {
      return NextResponse.json(
        {
          error: "Invalid business profile data.",
        },
        {
          status: 400,
        },
      );
    }

    const name = cleanString(payload.name);

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

    const industry = requiredString(payload.industry, "Other");
    const businessType = requiredString(payload.businessType, "Other");
    const financialYear = requiredString(payload.financialYear, "2025-26");
    const currency = requiredString(payload.currency, "INR");
    const country = requiredString(payload.country, "India");

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
    });

    return NextResponse.json({
      message: "Business profile saved successfully.",
      business,
    });
  } catch (error) {
    console.error("Business profile POST error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Business profile could not be saved.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}