import { prisma } from "./prisma";
import { ensureDefaultWorkspaceForUser } from "./workspace-context";

// Deliberately excludes `content`.
// The list view only needs metadata, extracted JSON, and review status.
export async function getDocumentsForUser(userId: string) {
  const workspace = await ensureDefaultWorkspaceForUser(userId);
  return prisma.document.findMany({
    where: {
      workspaceId: workspace.id,
    },
    orderBy: {
      uploadedAt: "desc",
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      category: true,
      status: true,
      uploadedAt: true,
      extractedData: true,
      extractedAt: true,
      processingError: true,
      reviewStatus: true,
      reviewedAt: true,
      reviewNote: true,
    },
  });
}

export type DocumentListItem = Awaited<
  ReturnType<typeof getDocumentsForUser>
>[number];