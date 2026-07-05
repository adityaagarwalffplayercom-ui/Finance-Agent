import { prisma } from "./prisma";
import { USAGE_LIMITS } from "./usage-limits";

export type UsageEventType = "upload" | "ai_process";

type UsageLimitCheck = {
  allowed: boolean;
  message?: string;
};

type UsageLimitOptions = {
  userId: string;
  eventType: UsageEventType;
  limit: number;
  windowMs: number;
  label: string;
};

const activeProcessingUsers = new Set<string>();

function formatDuration(ms: number) {
  const safeMs = Math.max(ms, 0);
  const totalSeconds = Math.ceil(safeMs / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.ceil(totalSeconds / 60);

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

async function checkPersistentUsageLimit({
  userId,
  eventType,
  limit,
  windowMs,
  label,
}: UsageLimitOptions): Promise<UsageLimitCheck> {
  const now = Date.now();
  const windowStart = new Date(now - windowMs);

  const count = await prisma.usageEvent.count({
    where: {
      userId,
      eventType,
      createdAt: {
        gte: windowStart,
      },
    },
  });

  if (count < limit) {
    return {
      allowed: true,
    };
  }

  const oldestEvent = await prisma.usageEvent.findFirst({
    where: {
      userId,
      eventType,
      createdAt: {
        gte: windowStart,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      createdAt: true,
    },
  });

  const retryInMs = oldestEvent
    ? oldestEvent.createdAt.getTime() + windowMs - now
    : windowMs;

  return {
    allowed: false,
    message: `${label} limit reached. Try again in ${formatDuration(
      retryInMs,
    )}.`,
  };
}

async function recordUsageEvent(userId: string, eventType: UsageEventType) {
  await prisma.usageEvent.create({
    data: {
      userId,
      eventType,
    },
  });
}

export async function checkAndRecordUploadUsage(
  userId: string,
): Promise<UsageLimitCheck> {
  const result = await checkPersistentUsageLimit({
    userId,
    eventType: "upload",
    limit: USAGE_LIMITS.MAX_UPLOADS_PER_DAY,
    windowMs: 24 * 60 * 60 * 1000,
    label: "Daily upload",
  });

  if (!result.allowed) {
    return result;
  }

  await recordUsageEvent(userId, "upload");

  return {
    allowed: true,
  };
}

export async function checkAndRecordAiProcessUsage(
  userId: string,
): Promise<UsageLimitCheck> {
  const hourly = await checkPersistentUsageLimit({
    userId,
    eventType: "ai_process",
    limit: USAGE_LIMITS.MAX_AI_PROCESSES_PER_HOUR,
    windowMs: 60 * 60 * 1000,
    label: "Hourly AI processing",
  });

  if (!hourly.allowed) {
    return hourly;
  }

  const daily = await checkPersistentUsageLimit({
    userId,
    eventType: "ai_process",
    limit: USAGE_LIMITS.MAX_AI_PROCESSES_PER_DAY,
    windowMs: 24 * 60 * 60 * 1000,
    label: "Daily AI processing",
  });

  if (!daily.allowed) {
    return daily;
  }

  await recordUsageEvent(userId, "ai_process");

  return {
    allowed: true,
  };
}

export function tryAcquireProcessingLock(userId: string) {
  if (activeProcessingUsers.has(userId)) {
    return false;
  }

  activeProcessingUsers.add(userId);
  return true;
}

export function releaseProcessingLock(userId: string) {
  activeProcessingUsers.delete(userId);
}