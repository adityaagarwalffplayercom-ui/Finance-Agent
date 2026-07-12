import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  LedgerDirection,
  LedgerEntryStatus,
  LedgerSourceType,
  Prisma,
} from "@prisma/client";
import { auth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isDirection(
  value: unknown,
): value is LedgerDirection {
  return (
    typeof value === "string" &&
    Object.values(LedgerDirection).includes(
      value as LedgerDirection,
    )
  );
}

function optionalString(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function parseDate(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized =
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00.000Z`
      : value;

  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime())
    ? undefined
    : parsed;
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 },
      );
    }

    const body = await request
      .json()
      .catch(() => null);

    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    if (
      typeof body.description !== "string" ||
      !body.description.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Transaction description is required.",
        },
        { status: 400 },
      );
    }

    const amount =
      typeof body.amount === "number"
        ? body.amount
        : typeof body.amount === "string"
          ? Number(
              body.amount
                .replace(/,/g, "")
                .trim(),
            )
          : Number.NaN;

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Amount must be greater than zero.",
        },
        { status: 400 },
      );
    }

    if (!isDirection(body.direction)) {
      return NextResponse.json(
        {
          error:
            "Select a valid transaction direction.",
        },
        { status: 400 },
      );
    }

    const currency =
      typeof body.currency === "string"
        ? body.currency
            .trim()
            .toUpperCase()
        : "INR";

    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json(
        {
          error:
            "Currency must be a valid three-letter code.",
        },
        { status: 400 },
      );
    }

    const transactionDate = parseDate(
      body.transactionDate,
    );

    if (transactionDate === undefined) {
      return NextResponse.json(
        {
          error:
            "Transaction date is invalid.",
        },
        { status: 400 },
      );
    }

    const counterparty = optionalString(
      body.counterparty,
    );

    const category = optionalString(
      body.category,
    );

    if (counterparty === undefined) {
      return NextResponse.json(
        {
          error:
            "Counterparty must be text.",
        },
        { status: 400 },
      );
    }

    if (category === undefined) {
      return NextResponse.json(
        {
          error:
            "Category must be text.",
        },
        { status: 400 },
      );
    }

    const entry =
      await prisma.ledgerEntry.create({
        data: {
          userId: session.user.id,
          documentId: null,
          transactionDate,
          description:
            body.description
              .trim()
              .slice(0, 500),
          counterparty,
          category,
          direction: body.direction,
          amount: new Prisma.Decimal(
            amount.toFixed(2),
          ),
          currency,
          confidence: 1,
          status:
            LedgerEntryStatus.APPROVED,
          sourceType:
            LedgerSourceType.MANUAL,
          sourceLineKey:
            `manual-${randomUUID()}`,
          metadata: {
            manuallyCreated: true,
            createdAt:
              new Date().toISOString(),
          },
        },
        select: {
          id: true,
          transactionDate: true,
          description: true,
          counterparty: true,
          category: true,
          direction: true,
          amount: true,
          currency: true,
          status: true,
          sourceType: true,
          createdAt: true,
        },
      });

    await createAuditEvent({
      userId: session.user.id,
      eventType:
        "MANUAL_LEDGER_ENTRY_CREATED",
      title:
        "Manual ledger entry created",
      description:
        `${entry.description} was manually added to the transaction ledger.`,
      documentId: null,
      fileName: null,
      metadata: {
        ledgerEntryId: entry.id,
        direction: entry.direction,
        amount:
          entry.amount.toString(),
        currency: entry.currency,
        category:
          entry.category ?? null,
      },
    });

    revalidatePath("/ledger");
    revalidatePath("/dashboard");
    revalidatePath("/cash-flow");
    revalidatePath("/forecast");

    return NextResponse.json({
      success: true,
      entry: {
        ...entry,
        amount:
          entry.amount.toString(),
      },
    });
  } catch (error) {
    console.error(
      "Manual ledger creation failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong while creating the manual transaction.",
      },
      { status: 500 },
    );
  }
}