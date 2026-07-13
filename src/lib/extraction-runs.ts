import { ExtractionRunStatus, type Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  AURELI_ENGINE_VERSION,
  AURELI_PARSER_VERSION,
  AURELI_PROMPT_VERSION,
} from "./production-config";

export async function startExtractionRun(params: {
  documentId: string;
  userId: string;
  workspaceId?: string | null;
  sourceFileHash?: string | null;
  modelName?: string | null;
}) {
  const latest = await prisma.extractionRun.findFirst({
    where: { documentId: params.documentId },
    orderBy: { runNumber: "desc" },
    select: { runNumber: true },
  });
  return prisma.extractionRun.create({
    data: {
      documentId: params.documentId,
      userId: params.userId,
      workspaceId: params.workspaceId ?? null,
      runNumber: (latest?.runNumber ?? 0) + 1,
      engineVersion: AURELI_ENGINE_VERSION,
      parserVersion: AURELI_PARSER_VERSION,
      promptVersion: AURELI_PROMPT_VERSION,
      modelName: params.modelName ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite",
      sourceFileHash: params.sourceFileHash ?? null,
    },
  });
}

export async function finishExtractionRun(params: {
  runId: string;
  status: ExtractionRunStatus;
  output?: Prisma.InputJsonValue;
  diagnostics?: Prisma.InputJsonValue;
  warnings?: Prisma.InputJsonValue;
}) {
  return prisma.extractionRun.update({
    where: { id: params.runId },
    data: {
      status: params.status,
      output: params.output,
      diagnostics: params.diagnostics,
      warnings: params.warnings,
      finishedAt: new Date(),
    },
  });
}
