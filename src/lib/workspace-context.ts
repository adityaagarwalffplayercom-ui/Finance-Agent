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

const TRANSIENT_DATABASE_CODES = new Set([
  "P1001",
  "P1017",
  "P2024",
  "P2028",
]);

function slugPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

function getPrismaErrorCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return null;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function backfillLegacyWorkspaceData(
  userId: string,
  workspaceId: string,
) {
  // Keep these writes sequential. Parallel queries inside a fragile or slow
  // database connection can exhaust the local Prisma pool and previously made
  // the default-workspace bootstrap depend on an interactive transaction.
  await prisma.business.updateMany({
    where: {
      userId,
      workspaceId: null,
    },
    data: {
      workspaceId,
    },
  });

  await prisma.document.updateMany({
    where: {
      userId,
      workspaceId: null,
    },
    data: {
      workspaceId,
    },
  });

  await prisma.usageEvent.updateMany({
    where: {
      userId,
      workspaceId: null,
    },
    data: {
      workspaceId,
    },
  });

  await prisma.auditEvent.updateMany({
    where: {
      userId,
      workspaceId: null,
    },
    data: {
      workspaceId,
    },
  });

  await prisma.ledgerEntry.updateMany({
    where: {
      userId,
      workspaceId: null,
    },
    data: {
      workspaceId,
    },
  });

  // Set the active workspace last. If a transient database interruption occurs
  // during a backfill, the next request will see the membership but no active
  // workspace and safely continue the idempotent backfill.
  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      activeWorkspaceId: workspaceId,
    },
  });
}

async function findFirstWorkspaceMembership(userId: string) {
  return prisma.workspaceMember.findFirst({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      workspace: true,
    },
  });
}

async function ensureDefaultWorkspaceOnce(userId: string) {
  const userState = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      activeWorkspaceId: true,
      name: true,
      email: true,
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!userState) {
    throw new Error("User not found while resolving workspace.");
  }

  if (userState.activeWorkspaceId) {
    const activeMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: userState.activeWorkspaceId,
          userId,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (activeMembership) {
      return activeMembership.workspace;
    }
  }

  const existing = await findFirstWorkspaceMembership(userId);

  if (existing) {
    await backfillLegacyWorkspaceData(userId, existing.workspaceId);
    return existing.workspace;
  }

  const name =
    userState.business?.name?.trim() ||
    `${userState.name || "My"} Workspace`;
  const baseSlug = slugPart(name) || "workspace";
  const slug = `${baseSlug}-${userId.slice(-8).toLowerCase()}`;

  try {
    // Nested member creation is atomic, but the slower legacy backfills are
    // deliberately kept outside an interactive transaction. This prevents a
    // dropped Neon/PgBouncer connection from leaving Prisma with an expired
    // transaction ID.
    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: WorkspaceRole.OWNER,
          },
        },
      },
    });

    await backfillLegacyWorkspaceData(userId, workspace.id);
    return workspace;
  } catch (error) {
    const code = getPrismaErrorCode(error);

    // Concurrent first requests can race to create the same workspace slug.
    // The winning request creates the workspace and membership; the losing
    // request resolves that existing membership instead of failing the page.
    if (code === "P2002") {
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        await sleep(attempt * 150);
        const racedMembership = await findFirstWorkspaceMembership(userId);

        if (racedMembership) {
          await backfillLegacyWorkspaceData(
            userId,
            racedMembership.workspaceId,
          );
          return racedMembership.workspace;
        }
      }
    }

    throw error;
  }
}

export async function ensureDefaultWorkspaceForUser(userId: string) {
  let lastError: unknown = null;

  // One retry handles a Neon compute wake-up, a closed pooled connection, or a
  // brief pool-acquisition timeout without multiplying traffic indefinitely.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await ensureDefaultWorkspaceOnce(userId);
    } catch (error) {
      lastError = error;
      const code = getPrismaErrorCode(error);
      const retryable =
        code !== null && TRANSIENT_DATABASE_CODES.has(code);

      if (!retryable || attempt === 2) {
        throw error;
      }

      await sleep(500 * attempt);
    }
  }

  throw lastError;
}

export async function setActiveWorkspace(
  userId: string,
  workspaceId: string,
) {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    include: {
      workspace: true,
    },
  });

  if (!membership) {
    throw new Error("WORKSPACE_PERMISSION_DENIED");
  }

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      activeWorkspaceId: workspaceId,
    },
  });

  return membership.workspace;
}

export async function getWorkspaceAccess(
  userId: string,
  workspaceId?: string | null,
) {
  const workspace = workspaceId
    ? await prisma.workspace.findUnique({
        where: {
          id: workspaceId,
        },
      })
    : await ensureDefaultWorkspaceForUser(userId);

  if (!workspace) {
    return null;
  }

  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId,
      },
    },
  });

  if (!member) {
    return null;
  }

  return {
    workspace,
    member,
  };
}

export function roleAtLeast(
  role: WorkspaceRole,
  minimum: WorkspaceRole,
) {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export async function requireWorkspaceRole(
  userId: string,
  workspaceId: string | null | undefined,
  minimum: WorkspaceRole,
) {
  const access = await getWorkspaceAccess(userId, workspaceId);

  if (
    !access ||
    !roleAtLeast(access.member.role, minimum)
  ) {
    throw new Error("WORKSPACE_PERMISSION_DENIED");
  }

  return access;
}

export type WorkspaceTransaction = Prisma.TransactionClient;
