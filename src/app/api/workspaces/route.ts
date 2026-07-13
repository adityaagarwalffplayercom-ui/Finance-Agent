import { NextResponse } from "next/server";
import { WorkspaceRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultWorkspaceForUser, requireWorkspaceRole } from "@/lib/workspace-context";
import { createAuditEvent } from "@/lib/audit-log";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDefaultWorkspaceForUser(session.user.id);
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: session.user.id },
    include: {
      workspace: {
        include: {
          _count: { select: { documents: true, members: true, businesses: true } },
          monthlyUsage: { orderBy: { month: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    workspaces: memberships.map((membership) => ({
      ...membership.workspace,
      role: membership.role,
      monthlyUsage: membership.workspace.monthlyUsage.map((entry) => ({
        ...entry,
        storageBytes: entry.storageBytes.toString(),
        aiInputTokens: entry.aiInputTokens.toString(),
        aiOutputTokens: entry.aiOutputTokens.toString(),
        estimatedCostMicros: entry.estimatedCostMicros.toString(),
      })),
    })),
  });
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as {
    workspaceId?: string;
    name?: string;
    retentionDays?: number;
    acceptAiProcessing?: boolean;
    acceptTerms?: boolean;
  } | null;
  if (!body?.workspaceId) return NextResponse.json({ error: "Workspace ID required." }, { status: 400 });
  await requireWorkspaceRole(session.user.id, body.workspaceId, WorkspaceRole.ADMIN);

  const retentionDays = Number(body.retentionDays);
  const aiProcessingConsentAt =
    typeof body.acceptAiProcessing === "boolean"
      ? body.acceptAiProcessing
        ? new Date()
        : null
      : undefined;
  const termsAcceptedAt =
    typeof body.acceptTerms === "boolean"
      ? body.acceptTerms
        ? new Date()
        : null
      : undefined;

  const workspace = await prisma.$transaction(async (tx) => {
    const updated = await tx.workspace.update({
      where: { id: body.workspaceId },
      data: {
        name: body.name?.trim().slice(0, 100) || undefined,
        retentionDays: Number.isInteger(retentionDays)
          ? Math.min(3650, Math.max(1, retentionDays))
          : undefined,
        aiProcessingConsentAt,
        termsAcceptedAt,
      },
    });
    await tx.business.updateMany({
      where: { workspaceId: body.workspaceId },
      data: { aiProcessingConsentAt, termsAcceptedAt },
    });
    return updated;
  });

  await createAuditEvent({
    userId: session.user.id,
    workspaceId: body.workspaceId,
    eventType: "WORKSPACE_SETTINGS_UPDATED",
    title: "Workspace settings updated",
    description: "Workspace name, retention or consent settings were updated.",
    metadata: {
      retentionDays: workspace.retentionDays,
      aiProcessingConsent: Boolean(workspace.aiProcessingConsentAt),
      termsAccepted: Boolean(workspace.termsAcceptedAt),
    },
  });

  return NextResponse.json({ workspace });
}
