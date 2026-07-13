import { WorkspaceRole, type Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  OWNER: 6,
  ADMIN: 5,
  ACCOUNTANT: 4,
  ANALYST: 3,
  AUDITOR: 2,
  VIEWER: 1,
};

function slugPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

export async function ensureDefaultWorkspaceForUser(userId: string) {
  const userState = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      activeWorkspaceId: true,
      name: true,
      email: true,
      business: { select: { id: true, name: true } },
    },
  });
  if (!userState) throw new Error("User not found while resolving workspace.");

  if (userState.activeWorkspaceId) {
    const activeMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: userState.activeWorkspaceId,
          userId,
        },
      },
      include: { workspace: true },
    });
    if (activeMembership) return activeMembership.workspace;
  }

  const existing = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { workspace: true },
  });
  if (existing) {
    await prisma.user.update({
      where: { id: userId },
      data: { activeWorkspaceId: existing.workspaceId },
    });
    return existing.workspace;
  }

  const name = userState.business?.name?.trim() || `${userState.name || "My"} Workspace`;
  const baseSlug = slugPart(name) || "workspace";
  const slug = `${baseSlug}-${userId.slice(-8).toLowerCase()}`;

  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name,
        slug,
        ownerId: userId,
        members: { create: { userId, role: WorkspaceRole.OWNER } },
      },
    });

    await Promise.all([
      tx.user.update({ where: { id: userId }, data: { activeWorkspaceId: workspace.id } }),
      tx.business.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId: workspace.id } }),
      tx.document.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId: workspace.id } }),
      tx.usageEvent.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId: workspace.id } }),
      tx.auditEvent.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId: workspace.id } }),
      tx.ledgerEntry.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId: workspace.id } }),
    ]);

    return workspace;
  });
}

export async function setActiveWorkspace(userId: string, workspaceId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: true },
  });
  if (!membership) throw new Error("WORKSPACE_PERMISSION_DENIED");
  await prisma.user.update({ where: { id: userId }, data: { activeWorkspaceId: workspaceId } });
  return membership.workspace;
}

export async function getWorkspaceAccess(userId: string, workspaceId?: string | null) {
  const workspace = workspaceId
    ? await prisma.workspace.findUnique({ where: { id: workspaceId } })
    : await ensureDefaultWorkspaceForUser(userId);
  if (!workspace) return null;

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
  });
  if (!member) return null;
  return { workspace, member };
}

export function roleAtLeast(role: WorkspaceRole, minimum: WorkspaceRole) {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export async function requireWorkspaceRole(
  userId: string,
  workspaceId: string | null | undefined,
  minimum: WorkspaceRole,
) {
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access || !roleAtLeast(access.member.role, minimum)) {
    throw new Error("WORKSPACE_PERMISSION_DENIED");
  }
  return access;
}

export type WorkspaceTransaction = Prisma.TransactionClient;
