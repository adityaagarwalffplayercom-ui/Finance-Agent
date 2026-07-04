import { prisma } from "./prisma";

// Deliberately excludes `content` — the list view never needs the file
// bytes, only metadata (and now, once processed, the extracted data —
// that's small JSON, not the raw file, so it's cheap to include here).
export async function getDocumentsForUser(userId: string) {
  return prisma.document.findMany({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
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
    },
  });
}

export type DocumentListItem = Awaited<ReturnType<typeof getDocumentsForUser>>[number];
