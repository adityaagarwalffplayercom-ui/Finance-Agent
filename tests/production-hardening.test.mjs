import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  detectMimeType,
  estimatePdfPageCount,
  inspectFile,
  sanitizeFileName,
} from "../src/lib/file-security.ts";
import {
  getValueAtPath,
  setValueAtPath,
  validateCorrectionValue,
} from "../src/lib/document-corrections.ts";

function minimalPdf({ encrypted = false, pages = 1 } = {}) {
  const pageObjects = Array.from({ length: pages }, (_, index) => `${index + 1} 0 obj\n<< /Type /Page >>\nendobj`).join("\n");
  return Buffer.from(`%PDF-1.7\n${encrypted ? "/Encrypt 9 0 R\n" : ""}${pageObjects}\n%%EOF`, "latin1");
}

test("validates real file signatures instead of trusting browser MIME", () => {
  const pdf = minimalPdf();
  assert.equal(detectMimeType(pdf), "application/pdf");
  assert.equal(inspectFile(pdf, "report.pdf", "application/octet-stream").detectedMimeType, "application/pdf");
  assert.throws(() => inspectFile(pdf, "report.xlsx", "application/pdf"), /extension/i);
});

test("detects encrypted PDFs and page counts", () => {
  const pdf = minimalPdf({ encrypted: true, pages: 3 });
  const inspection = inspectFile(pdf, "locked.pdf", "application/pdf");
  assert.equal(inspection.isEncryptedPdf, true);
  assert.equal(estimatePdfPageCount(pdf), 3);
});

test("sanitizes path traversal and unsafe upload names", () => {
  assert.equal(sanitizeFileName("../../quarter<>:report?.pdf"), "quarter_report_.pdf");
});

test("applies nested audited corrections without mutating the original", () => {
  const original = { revenue: 10, lineItems: [{ amount: 4 }] };
  const updated = setValueAtPath(original, "lineItems[0].amount", 7);
  assert.equal(original.lineItems[0].amount, 4);
  assert.equal(getValueAtPath(updated, "lineItems[0].amount"), 7);
  assert.equal(validateCorrectionValue("revenue", 20), 20);
  assert.throws(() => validateCorrectionValue("assets", Number.NaN), /finite numeric/i);
});

test("production migration contains queue, workspace, storage, correction and rate-limit tables", async () => {
  const sql = await readFile("prisma/migrations/20260713100000_production_hardening/migration.sql", "utf8");
  for (const table of [
    "workspace",
    "workspace_member",
    "processing_job",
    "extraction_run",
    "document_correction",
    "workspace_usage_monthly",
    "workspace_invitation",
    "rateLimit",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS \\"${table}\\"`, "i"));
  }
});

test("production documentation and CI workflow are present", async () => {
  const [deployment, ci] = await Promise.all([
    readFile("docs/PRODUCTION_DEPLOYMENT.md", "utf8"),
    readFile(".github/workflows/ci.yml", "utf8"),
  ]);
  assert.match(deployment, /object storage/i);
  assert.match(deployment, /background/i);
  assert.match(ci, /npm run db:migrate/i);
  assert.match(ci, /npm run build/i);
});

test("workspace isolation covers ledger entries and AI chat history", async () => {
  const [schema, migration, chat, ledgerScope] = await Promise.all([
    readFile("prisma/schema.prisma", "utf8"),
    readFile("prisma/migrations/20260713100000_production_hardening/migration.sql", "utf8"),
    readFile("src/lib/business-chat.ts", "utf8"),
    readFile("src/lib/active-workspace-data.ts", "utf8"),
  ]);

  assert.match(schema, /model LedgerEntry[\s\S]*workspaceId\s+String\?/);
  assert.match(schema, /model BusinessChatMessage[\s\S]*workspaceId\s+String\?/);
  assert.match(migration, /ledger_entry_workspaceId_fkey/);
  assert.match(migration, /business_chat_message_workspaceId_fkey/);
  assert.match(chat, /workspaceId: workspace\.id/);
  assert.match(ledgerScope, /workspaceId: workspace\.id/);
});

test("production auth diagnostics avoid returning raw failures", async () => {
  const health = await readFile("src/app/api/health/route.ts", "utf8");
  const debug = await readFile("src/app/api/debug/auth/route.ts", "utf8");
  assert.doesNotMatch(health, /databaseError:\s*error instanceof Error\s*\?\s*error\.message/);
  assert.match(debug, /NODE_ENV/);
});

test("production hotfix loads Prisma env and keeps workspace/type wiring intact", async () => {
  const [
    prismaConfig,
    cashFlow,
    completeness,
    forecast,
    ledgerForecast,
    learningPage,
    learningEngine,
    processingJobs,
  ] = await Promise.all([
    readFile("prisma.config.ts", "utf8"),
    readFile("src/lib/cash-flow-engine.ts", "utf8"),
    readFile("src/lib/document-completeness-engine.ts", "utf8"),
    readFile("src/lib/forecast-engine.ts", "utf8"),
    readFile("src/lib/ledger-forecast-engine.ts", "utf8"),
    readFile("src/app/(app)/learning-center/page.tsx", "utf8"),
    readFile("src/lib/learning-feedback-engine.ts", "utf8"),
    readFile("src/lib/processing-jobs.ts", "utf8"),
  ]);

  assert.match(prismaConfig, /loadEnvFile/);
  assert.match(prismaConfig, /process\.env\.DIRECT_URL \?\?=/);

  for (const source of [cashFlow, completeness, forecast, ledgerForecast]) {
    assert.match(source, /getActiveWorkspaceDataScope/);
    assert.match(source, /active-workspace-data/);
  }

  assert.match(learningPage, /LearningOptimizedAction/);
  assert.match(learningEngine, /originalRank:\s*number/);
  assert.match(learningEngine, /optimizedScore:\s*number/);
  assert.doesNotMatch(
    processingJobs,
    /\[DocumentStatus\.QUEUED, DocumentStatus\.PROCESSING\]\.includes/,
  );
});
