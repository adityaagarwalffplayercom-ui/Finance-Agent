import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isS3StorageConfigured } from "@/lib/object-storage";
import { productionConfig, getProductionConfigurationProblems } from "@/lib/production-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [queued, running, failed] = await Promise.all([
      prisma.processingJob.count({ where: { status: "QUEUED" } }),
      prisma.processingJob.count({ where: { status: "RUNNING" } }),
      prisma.processingJob.count({ where: { status: "FAILED", finishedAt: { gte: new Date(Date.now() - 86400000) } } }),
    ]);
    const problems = getProductionConfigurationProblems();
    return NextResponse.json(
      {
        status: problems.length === 0 ? "ok" : "degraded",
        database: "ok",
        processingMode: productionConfig.processingMode,
        objectStorage: isS3StorageConfigured() ? "s3" : "database-fallback",
        queue: { queued, running, failedLast24Hours: failed },
        configuration: {
          valid: problems.length === 0,
          problemCount: problems.length,
          ...(productionConfig.isProduction ? {} : { problems }),
        },
        latencyMs: Date.now() - startedAt,
      },
      { status: problems.length === 0 ? 200 : 503 },
    );
  } catch {
    return NextResponse.json({ status: "down", database: "error", latencyMs: Date.now() - startedAt }, { status: 503 });
  }
}
