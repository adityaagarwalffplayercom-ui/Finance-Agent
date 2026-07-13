import type { Prisma } from "@prisma/client";

function parsePath(path: string) {
  const tokens: Array<string | number> = [];
  for (const match of path.matchAll(/([^[.]+)|\[(\d+)\]/g)) {
    if (match[1]) tokens.push(match[1]);
    else if (match[2]) tokens.push(Number(match[2]));
  }
  return tokens;
}

export function getValueAtPath(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const token of parsePath(path)) {
    if (typeof token === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[token];
    } else {
      if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
      current = (current as Record<string, unknown>)[token];
    }
  }
  return current;
}

export function setValueAtPath<T>(value: T, path: string, correctedValue: unknown): T {
  const clone = structuredClone(value);
  const tokens = parsePath(path);
  if (tokens.length === 0) throw new Error("Invalid correction path.");
  let current: unknown = clone;

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];
    if (typeof token === "number") {
      if (!Array.isArray(current)) throw new Error("Correction path does not point to an array.");
      if (current[token] === undefined) current[token] = typeof next === "number" ? [] : {};
      current = current[token];
    } else {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        throw new Error("Correction path does not point to an object.");
      }
      const record = current as Record<string, unknown>;
      if (record[token] === undefined) record[token] = typeof next === "number" ? [] : {};
      current = record[token];
    }
  }

  const last = tokens.at(-1)!;
  if (typeof last === "number") {
    if (!Array.isArray(current)) throw new Error("Correction path does not point to an array.");
    current[last] = correctedValue;
  } else {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      throw new Error("Correction path does not point to an object.");
    }
    (current as Record<string, unknown>)[last] = correctedValue;
  }
  return clone;
}

export function validateCorrectionValue(fieldPath: string, value: unknown) {
  if (value === undefined) {
    throw new Error("A correction value is required.");
  }

  const headlineFields = new Set([
    "revenue",
    "totalRevenue",
    "expenses",
    "totalExpenses",
    "netIncome",
    "profit",
    "loss",
    "cash",
    "assets",
    "liabilities",
    "equity",
  ]);
  const lineItemMatch = fieldPath.match(
    /^lineItems\[(\d{1,5})\]\.(amount|description|category|date)$/u,
  );

  if (!headlineFields.has(fieldPath) && !lineItemMatch) {
    throw new Error("This field is not available for manual correction.");
  }

  const isNumeric = headlineFields.has(fieldPath) || lineItemMatch?.[2] === "amount";
  if (isNumeric) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("This correction requires a finite numeric value.");
    }
    return value as Prisma.InputJsonValue;
  }

  if (typeof value !== "string") {
    throw new Error("This correction requires text.");
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > 500) {
    throw new Error("Correction text must be between 1 and 500 characters.");
  }
  return normalized as Prisma.InputJsonValue;
}
