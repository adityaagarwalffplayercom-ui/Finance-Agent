import type { Prisma } from "@prisma/client";
import { ensureDefaultWorkspaceForUser } from "./workspace-context";

export async function getActiveWorkspaceDataScope(userId: string) {
  const workspace = await ensureDefaultWorkspaceForUser(userId);

  const ledgerWhere: Prisma.LedgerEntryWhereInput = {
    OR: [
      { workspaceId: workspace.id },
      { workspaceId: null, userId },
    ],
  };

  const documentWhere: Prisma.DocumentWhereInput = {
    OR: [
      { workspaceId: workspace.id },
      { workspaceId: null, userId },
    ],
  };

  const businessWhere: Prisma.BusinessWhereInput = {
    OR: [
      { workspaceId: workspace.id },
      { workspaceId: null, userId },
    ],
  };

  return {
    workspace,
    ledgerWhere,
    documentWhere,
    businessWhere,
  };
}
