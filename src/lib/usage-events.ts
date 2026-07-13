import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ensureDefaultWorkspaceForUser } from "./workspace-context";
import { limitsForPlan } from "./plan-limits";

export type UsageEventType = "upload" | "ai_process";

type UsageLimitCheck = { allowed: boolean; message?: string; workspaceId?: string };
type UsageLimitOptions = {
  userId: string;
  workspaceId: string;
  eventType: UsageEventType;
  limit: number;
  windowMs: number;
  label: string;
};

const activeProcessingUsers = new Set<string>();

function formatDuration(ms: number) {
  const seconds = Math.ceil(Math.max(ms, 0) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

async function checkPersistentUsageLimit(options: UsageLimitOptions): Promise<UsageLimitCheck> {
  const now = Date.now();
  const windowStart = new Date(now - options.windowMs);
  const count = await prisma.usageEvent.count({
    where: {
      workspaceId: options.workspaceId,
      eventType: options.eventType,
      createdAt: { gte: windowStart },
    },
  });
  if (count < options.limit) return { allowed: true, workspaceId: options.workspaceId };

  const oldestEvent = await prisma.usageEvent.findFirst({
    where: {
      workspaceId: options.workspaceId,
      eventType: options.eventType,
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  const retryInMs = oldestEvent
    ? oldestEvent.createdAt.getTime() + options.windowMs - now
    : options.windowMs;
  return {
    allowed: false,
    workspaceId: options.workspaceId,
    message: `${options.label} limit reached. Try again in ${formatDuration(retryInMs)}.`,
  };
}

function monthStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

async function recordUsageEvent(params: {
  userId: string;
  workspaceId: string;
  eventType: UsageEventType;
  quantity?: number;
  metadata?: Prisma.InputJsonValue;
  storageBytes?: number;
}) {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: params.workspaceId } });
  await prisma.$transaction([
    prisma.usageEvent.create({
      data: {
        userId: params.userId,
        workspaceId: params.workspaceId,
        eventType: params.eventType,
        quantity: params.quantity ?? 1,
        metadata: params.metadata,
      },
    }),
    prisma.workspaceUsageMonthly.upsert({
      where: { workspaceId_month: { workspaceId: params.workspaceId, month: monthStart() } },
      create: {
        workspaceId: params.workspaceId,
        month: monthStart(),
        plan: workspace.plan,
        uploads: params.eventType === "upload" ? 1 : 0,
        aiProcesses: params.eventType === "ai_process" ? 1 : 0,
        storageBytes: BigInt(params.storageBytes ?? 0),
      },
      update: {
        plan: workspace.plan,
        uploads: params.eventType === "upload" ? { increment: 1 } : undefined,
        aiProcesses: params.eventType === "ai_process" ? { increment: 1 } : undefined,
        storageBytes: params.storageBytes ? { increment: BigInt(params.storageBytes) } : undefined,
      },
    }),
  ]);
}

async function workspaceAndLimits(userId: string) {
  const workspace = await ensureDefaultWorkspaceForUser(userId);
  return { workspace, limits: limitsForPlan(workspace.plan) };
}

export async function checkAndRecordUploadUsage(
  userId: string,
  options: { storageBytes?: number; metadata?: Prisma.InputJsonValue } = {},
): Promise<UsageLimitCheck> {
  const { workspace, limits } = await workspaceAndLimits(userId);
  const result = await checkPersistentUsageLimit({
    userId,
    workspaceId: workspace.id,
    eventType: "upload",
    limit: limits.uploadsPerDay,
    windowMs: 24 * 60 * 60 * 1000,
    label: "Daily upload",
  });
  if (!result.allowed) return result;
  await recordUsageEvent({
    userId,
    workspaceId: workspace.id,
    eventType: "upload",
    storageBytes: options.storageBytes,
    metadata: options.metadata,
  });
  return { allowed: true, workspaceId: workspace.id };
}

export async function checkAndRecordAiProcessUsage(userId: string): Promise<UsageLimitCheck> {
  const { workspace, limits } = await workspaceAndLimits(userId);
  const hourly = await checkPersistentUsageLimit({
    userId,
    workspaceId: workspace.id,
    eventType: "ai_process",
    limit: limits.aiProcessesPerHour,
    windowMs: 60 * 60 * 1000,
    label: "Hourly AI processing",
  });
  if (!hourly.allowed) return hourly;
  const daily = await checkPersistentUsageLimit({
    userId,
    workspaceId: workspace.id,
    eventType: "ai_process",
    limit: limits.aiProcessesPerDay,
    windowMs: 24 * 60 * 60 * 1000,
    label: "Daily AI processing",
  });
  if (!daily.allowed) return daily;
  await recordUsageEvent({ userId, workspaceId: workspace.id, eventType: "ai_process" });
  return { allowed: true, workspaceId: workspace.id };
}

export async function recordProcessingUsageDetails(params: {
  workspaceId: string | null | undefined;
  processedPages?: number | null;
  aiInputTokens?: number | null;
  aiOutputTokens?: number | null;
  estimatedCostMicros?: number | null;
}) {
  if (!params.workspaceId) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: params.workspaceId },
    select: { plan: true },
  });
  if (!workspace) return;

  const processedPages = Math.max(0, Math.trunc(params.processedPages ?? 0));
  const aiInputTokens = BigInt(Math.max(0, Math.trunc(params.aiInputTokens ?? 0)));
  const aiOutputTokens = BigInt(Math.max(0, Math.trunc(params.aiOutputTokens ?? 0)));
  const estimatedCostMicros = BigInt(
    Math.max(0, Math.trunc(params.estimatedCostMicros ?? 0)),
  );

  await prisma.workspaceUsageMonthly.upsert({
    where: {
      workspaceId_month: {
        workspaceId: params.workspaceId,
        month: monthStart(),
      },
    },
    create: {
      workspaceId: params.workspaceId,
      month: monthStart(),
      plan: workspace.plan,
      processedPages,
      aiInputTokens,
      aiOutputTokens,
      estimatedCostMicros,
    },
    update: {
      plan: workspace.plan,
      processedPages: processedPages ? { increment: processedPages } : undefined,
      aiInputTokens: aiInputTokens > BigInt(0) ? { increment: aiInputTokens } : undefined,
      aiOutputTokens: aiOutputTokens > BigInt(0) ? { increment: aiOutputTokens } : undefined,
      estimatedCostMicros:
        estimatedCostMicros > BigInt(0) ? { increment: estimatedCostMicros } : undefined,
    },
  });
}

export function tryAcquireProcessingLock(userId: string) {
  if (activeProcessingUsers.has(userId)) return false;
  activeProcessingUsers.add(userId);
  return true;
}
export function releaseProcessingLock(userId: string) {
  activeProcessingUsers.delete(userId);
}
