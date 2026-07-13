import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { LedgerEntryStatus, WorkspaceRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceDataScope } from "@/lib/active-workspace-data";
import { requireWorkspaceRole } from "@/lib/workspace-context";

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

function isBulkStatus(
  value: unknown,
): value is
  | typeof LedgerEntryStatus.APPROVED
  | typeof LedgerEntryStatus.REJECTED {
  return (
    value === LedgerEntryStatus.APPROVED ||
    value === LedgerEntryStatus.REJECTED
  );
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

    const { workspace, ledgerWhere } = await getActiveWorkspaceDataScope(session.user.id);
    await requireWorkspaceRole(session.user.id, workspace.id, WorkspaceRole.ACCOUNTANT);

    const body = await request
      .json()
      .catch(() => null);

    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.entryIds)) {
      return NextResponse.json(
        {
          error:
            "Select at least one ledger entry.",
        },
        { status: 400 },
      );
    }

    const entryIds = Array.from(
      new Set(
        body.entryIds.filter(
          (value): value is string =>
            typeof value === "string" &&
            value.trim().length > 0,
        ),
      ),
    );

    if (entryIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "Select at least one ledger entry.",
        },
        { status: 400 },
      );
    }

    if (entryIds.length > 500) {
      return NextResponse.json(
        {
          error:
            "A maximum of 500 entries can be reviewed together.",
        },
        { status: 400 },
      );
    }

    if (!isBulkStatus(body.status)) {
      return NextResponse.json(
        {
          error:
            "Bulk status must be APPROVED or REJECTED.",
        },
        { status: 400 },
      );
    }

    const matchingEntries =
      await prisma.ledgerEntry.findMany({
        where: { AND: [ledgerWhere, { id: { in: entryIds } }] },
        select: {
          id: true,
          status: true,
        },
      });

    if (matchingEntries.length === 0) {
      return NextResponse.json(
        {
          error:
            "No matching ledger entries were found.",
        },
        { status: 404 },
      );
    }

    const accessibleIds =
      matchingEntries.map(
        (entry) => entry.id,
      );

    const result =
      await prisma.ledgerEntry.updateMany({
        where: { AND: [ledgerWhere, { id: { in: accessibleIds } }] },
        data: {
          status: body.status,
        },
      });

    await createAuditEvent({
      userId: session.user.id,
      workspaceId: workspace.id,
      eventType:
        "LEDGER_ENTRY_UPDATED",
      title:
        body.status ===
        LedgerEntryStatus.APPROVED
          ? "Ledger entries approved"
          : "Ledger entries rejected",
      description:
        `${result.count} ledger entr${
          result.count === 1 ? "y was" : "ies were"
        } ${
          body.status ===
          LedgerEntryStatus.APPROVED
            ? "approved"
            : "rejected"
        } through bulk review.`,
      metadata: {
        action: "BULK_LEDGER_REVIEW",
        status: body.status,
        updatedCount: result.count,
        entryIds:
          accessibleIds.slice(0, 100),
      },
    });

    revalidatePath("/ledger");
    revalidatePath("/dashboard");
    revalidatePath("/cash-flow");
    revalidatePath("/forecast");
    revalidatePath("/chat");

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      status: body.status,
    });
  } catch (error) {
    console.error(
      "Bulk ledger review failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong during bulk ledger review.",
      },
      { status: 500 },
    );
  }
}