export const USAGE_LIMITS = {
  MAX_UPLOAD_FILE_SIZE_BYTES: 15 * 1024 * 1024,
  MAX_AI_PROCESS_FILE_SIZE_BYTES: 15 * 1024 * 1024,

  MAX_UPLOADS_PER_DAY: 25,

  MAX_AI_PROCESSES_PER_HOUR: 10,
  MAX_AI_PROCESSES_PER_DAY: 40,

  MAX_TEXT_CHARS_FOR_AI: 250_000,
  MAX_SPREADSHEET_SHEETS_FOR_AI: 10,
};

type RateLimitCheck = {
  allowed: boolean;
  message?: string;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  label: string;
};

const usageBuckets = new Map<string, number[]>();
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

export function formatUsageSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function checkAndConsumeRateLimit({
  key,
  limit,
  windowMs,
  label,
}: RateLimitOptions): RateLimitCheck {
  const now = Date.now();
  const existing = usageBuckets.get(key) ?? [];

  const validTimestamps = existing.filter(
    (timestamp) => now - timestamp < windowMs,
  );

  if (validTimestamps.length >= limit) {
    const oldestTimestamp = validTimestamps[0];
    const retryInMs = oldestTimestamp + windowMs - now;

    usageBuckets.set(key, validTimestamps);

    return {
      allowed: false,
      message: `${label} limit reached. Try again in ${formatDuration(
        retryInMs,
      )}.`,
    };
  }

  validTimestamps.push(now);
  usageBuckets.set(key, validTimestamps);

  return {
    allowed: true,
  };
}

export function getUploadRateLimitKey(userId: string) {
  return `upload:${userId}`;
}

export function getProcessHourlyRateLimitKey(userId: string) {
  return `process-hour:${userId}`;
}

export function getProcessDailyRateLimitKey(userId: string) {
  return `process-day:${userId}`;
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

export function getUsageLimitMessage() {
  return [
    `Max upload size: ${formatUsageSize(
      USAGE_LIMITS.MAX_UPLOAD_FILE_SIZE_BYTES,
    )}`,
    `Max AI processing size: ${formatUsageSize(
      USAGE_LIMITS.MAX_AI_PROCESS_FILE_SIZE_BYTES,
    )}`,
    `${USAGE_LIMITS.MAX_UPLOADS_PER_DAY} uploads/day`,
    `${USAGE_LIMITS.MAX_AI_PROCESSES_PER_HOUR} AI processes/hour`,
    `${USAGE_LIMITS.MAX_AI_PROCESSES_PER_DAY} AI processes/day`,
  ].join(" · ");
}