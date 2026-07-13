import { prisma } from "./prisma";

export async function getWorkspaceStorageBytes(workspaceId: string) {
  const result = await prisma.document.aggregate({
    where: { workspaceId },
    _sum: { fileSize: true },
  });
  return result._sum.fileSize ?? 0;
}

export async function checkWorkspaceStorageCapacity(params: {
  workspaceId: string;
  incomingBytes: number;
  limitBytes: number;
}) {
  const usedBytes = await getWorkspaceStorageBytes(params.workspaceId);
  const allowed = usedBytes + params.incomingBytes <= params.limitBytes;
  return {
    allowed,
    usedBytes,
    remainingBytes: Math.max(0, params.limitBytes - usedBytes),
  };
}
