import { randomUUID } from "node:crypto";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    };
  }
  return error;
}

function forwardToProvider(payload: Record<string, unknown>) {
  const endpoint = process.env.OBSERVABILITY_WEBHOOK_URL?.trim();
  if (!endpoint) return;

  void fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.OBSERVABILITY_WEBHOOK_SECRET
        ? { authorization: `Bearer ${process.env.OBSERVABILITY_WEBHOOK_SECRET}` }
        : {}),
    },
    body: JSON.stringify(payload, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
    signal: AbortSignal.timeout(5000),
  }).catch(() => undefined);
}

function write(level: LogLevel, event: string, context: LogContext = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    service: "aureli-web",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    ...context,
  };
  const line = JSON.stringify(payload, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  if (level === "error" || level === "warn") {
    forwardToProvider(payload);
  }
}

export const logger = {
  debug(event: string, context?: LogContext) {
    if (process.env.NODE_ENV !== "production") write("debug", event, context);
  },
  info(event: string, context?: LogContext) {
    write("info", event, context);
  },
  warn(event: string, context?: LogContext) {
    write("warn", event, context);
  },
  error(event: string, error: unknown, context: LogContext = {}) {
    write("error", event, { ...context, error: serializeError(error) });
  },
};

export function getRequestId(headers: Headers) {
  return (
    headers.get("x-request-id") ??
    headers.get("x-vercel-id") ??
    headers.get("cf-ray") ??
    randomUUID()
  );
}
