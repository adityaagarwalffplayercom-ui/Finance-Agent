import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  LedgerDirection,
  LedgerEntryStatus,
  LedgerSourceType,
  Prisma,
  WorkspaceRole,
} from "@prisma/client";
import { auth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceDataScope } from "@/lib/active-workspace-data";
import { requireWorkspaceRole } from "@/lib/workspace-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

function isStatus(
  value: unknown,
): value is LedgerEntryStatus {
  return (
    typeof value === "string" &&
    Object.values(LedgerEntryStatus).includes(
      value as LedgerEntryStatus,
    )
  );
}

function optionalString(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function parseTransactionDate(value: unknown) {
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

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
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

    const { workspace, ledgerWhere } = await getActiveWorkspaceDataScope(session.user.id);
    await requireWorkspaceRole(session.user.id, workspace.id, WorkspaceRole.ACCOUNTANT);
    const { id } = await context.params;

    const body = await request
      .json()
      .catch(() => null);

    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const existingEntry =
      await prisma.ledgerEntry.findFirst({
        where: { AND: [ledgerWhere, { id }] },
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
            },
          },
        },
      });

    if (!existingEntry) {
      return NextResponse.json(
        { error: "Ledger entry not found." },
        { status: 404 },
      );
    }

    const data: Prisma.LedgerEntryUpdateInput = {};

    if ("description" in body) {
      if (
        typeof body.description !== "string" ||
        !body.description.trim()
      ) {
        return NextResponse.json(
          {
            error:
              "Description cannot be empty.",
          },
          { status: 400 },
        );
      }

      data.description =
        body.description.trim().slice(0, 500);
    }

    if ("counterparty" in body) {
      const counterparty =
        optionalString(body.counterparty);

      if (counterparty === undefined) {
        return NextResponse.json(
          {
            error:
              "Counterparty must be text.",
          },
          { status: 400 },
        );
      }

      data.counterparty = counterparty;
    }

    if ("category" in body) {
      const category =
        optionalString(body.category);

      if (category === undefined) {
        return NextResponse.json(
          {
            error: "Category must be text.",
          },
          { status: 400 },
        );
      }

      data.category = category;
    }

    if ("transactionDate" in body) {
      const transactionDate =
        parseTransactionDate(
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

      data.transactionDate =
        transactionDate;
    }

    if ("amount" in body) {
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

      data.amount = new Prisma.Decimal(
        amount.toFixed(2),
      );
    }

    if ("direction" in body) {
      if (!isDirection(body.direction)) {
        return NextResponse.json(
          {
            error:
              "Invalid ledger direction.",
          },
          { status: 400 },
        );
      }

      data.direction = body.direction;
    }

    if ("status" in body) {
      if (!isStatus(body.status)) {
        return NextResponse.json(
          {
            error:
              "Invalid ledger status.",
          },
          { status: 400 },
        );
      }

      data.status = body.status;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          error:
            "No ledger changes were provided.",
        },
        { status: 400 },
      );
    }

    const updatedEntry =
      await prisma.ledgerEntry.update({
        where: {
          id: existingEntry.id,
        },
        data,
        select: {
          id: true,
          description: true,
          counterparty: true,
          category: true,
          transactionDate: true,
          amount: true,
          currency: true,
          direction: true,
          status: true,
          updatedAt: true,
        },
      });

    await createAuditEvent({
      userId: session.user.id,
      workspaceId: workspace.id,
      eventType: "LEDGER_ENTRY_UPDATED",
      title: "Ledger entry updated",
      description:
        `${existingEntry.description} was edited in the transaction ledger.`,
      documentId:
        existingEntry.document?.id ?? null,
      fileName:
        existingEntry.document?.fileName ?? null,
      metadata: {
        ledgerEntryId:
          existingEntry.id,
        previousStatus:
          existingEntry.status,
        newStatus:
          updatedEntry.status,
        previousDirection:
          existingEntry.direction,
        newDirection:
          updatedEntry.direction,
        previousAmount:
          existingEntry.amount.toString(),
        newAmount:
          updatedEntry.amount.toString(),
      },
    });

    revalidatePath("/ledger");
    revalidatePath("/dashboard");
    revalidatePath("/cash-flow");
    revalidatePath("/forecast");

    return NextResponse.json({
      success: true,
      entry: {
        ...updatedEntry,
        amount:
          updatedEntry.amount.toString(),
      },
    });
  } catch (error) {
    console.error(
      "Ledger entry update failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong while updating the ledger entry.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
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

    const { workspace, ledgerWhere } = await getActiveWorkspaceDataScope(session.user.id);
    await requireWorkspaceRole(session.user.id, workspace.id, WorkspaceRole.ACCOUNTANT);
    const { id } = await context.params;

    const entry =
      await prisma.ledgerEntry.findFirst({
        where: { AND: [ledgerWhere, { id }] },
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
            },
          },
        },
      });

    if (!entry) {
      return NextResponse.json(
        {
          error:
            "Ledger entry not found.",
        },
        { status: 404 },
      );
    }

    if (
      entry.sourceType !==
      LedgerSourceType.MANUAL
    ) {
      return NextResponse.json(
        {
          error:
            "Only manually-created entries can be deleted. Extracted entries should be rejected instead.",
        },
        { status: 400 },
      );
    }

    await prisma.ledgerEntry.delete({
      where: {
        id: entry.id,
      },
    });

    await createAuditEvent({
      userId: session.user.id,
      workspaceId: workspace.id,
      eventType:
        "MANUAL_LEDGER_ENTRY_DELETED",
      title:
        "Manual ledger entry deleted",
      description:
        `${entry.description} was removed from the transaction ledger.`,
      documentId:
        entry.document?.id ?? null,
      fileName:
        entry.document?.fileName ?? null,
      metadata: {
        ledgerEntryId: entry.id,
        direction: entry.direction,
        amount:
          entry.amount.toString(),
        currency: entry.currency,
      },
    });

    revalidatePath("/ledger");
    revalidatePath("/dashboard");
    revalidatePath("/cash-flow");
    revalidatePath("/forecast");

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Manual ledger deletion failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong while deleting the manual transaction.",
      },
      { status: 500 },
    );
  }
}
