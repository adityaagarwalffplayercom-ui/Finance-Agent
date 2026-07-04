import { prisma } from "./prisma";

// Deliberately excludes `content`.
// The list view only needs metadata, extracted JSON, and review status.
export async function getDocumentsForUser(userId: string) {
  return prisma.document.findMany({
    where: {
      userId,
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