import { NextResponse } from "next/server";
import { claimNextProcessingJob, failProcessingJob, requeueStaleProcessingJobs } from "@/lib/processing-jobs";
import { productionConfig } from "@/lib/production-config";
import { logger, getRequestId } from "@/lib/logger";
import { secureTokenEqual } from "@/lib/secure-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return secureTokenEqual(bearer, productionConfig.workerSecret);
}

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requeued = await requeueStaleProcessingJobs();
  const processed: Array<{ jobId: string; documentId: string; ok: boolean; status: number }> = [];

  for (let index = 0; index < productionConfig.maxJobsPerInvocation; index += 1) {
    const job = await claimNextProcessingJob();
    if (!job) break;
    try {
      const response = await fetch(`${productionConfig.appUrl}/api/documents/${job.documentId}/process`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${productionConfig.workerSecret}`,
          "x-aureli-job-id": job.id,
          "x-request-id": requestId,
        },
        cache: "no-store",
      });
      processed.push({ jobId: job.id, documentId: job.documentId, ok: response.ok, status: response.status });
      if (!response.ok) {
        const body = await response.text().catch(() => "Worker request failed.");
        await failProcessingJob(job.id, body || `Worker request returned ${response.status}.`);
      }
    } catch (error) {
      logger.error("worker.job_request_failed", error, { requestId, jobId: job.id });
      await failProcessingJob(job.id, error instanceof Error ? error.message : "Worker request failed.");
      processed.push({ jobId: job.id, documentId: job.documentId, ok: false, status: 0 });
    }
  }

  return NextResponse.json({ requestId, requeued, processed });
}
