export const AURELI_ENGINE_VERSION = "2026.07-production.1";
export const AURELI_PARSER_VERSION = "universal-layout-v2";
export const AURELI_PROMPT_VERSION = "financial-extraction-v2";

function booleanEnv(name: string, fallback = false) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

function integerEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export const productionConfig = {
  isProduction: process.env.NODE_ENV === "production",
  appUrl:
    process.env.APP_URL ??
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  processingMode:
    process.env.DOCUMENT_PROCESSING_MODE === "queue" ? ("queue" as const) : ("inline" as const),
  workerSecret: process.env.JOB_WORKER_SECRET ?? process.env.CRON_SECRET ?? "",
  maxJobsPerInvocation: integerEnv("MAX_JOBS_PER_INVOCATION", 2, 1, 10),
  staleJobMinutes: integerEnv("STALE_JOB_MINUTES", 15, 5, 120),
  maxPdfPages: integerEnv("MAX_PDF_PAGES", 500, 1, 5000),
  defaultRetentionDays: integerEnv("DEFAULT_RETENTION_DAYS", 365, 1, 3650),
  emailVerificationRequired: booleanEnv(
    "BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION",
    process.env.NODE_ENV === "production",
  ),
  directUploadsEnabled: booleanEnv("DIRECT_UPLOADS_ENABLED", true),
  objectStorageRequired: booleanEnv("OBJECT_STORAGE_REQUIRED", false),
  debugRoutesEnabled: booleanEnv("ENABLE_DEBUG_ROUTES", false),
  requireAiProcessingConsent: booleanEnv(
    "REQUIRE_AI_PROCESSING_CONSENT",
    false,
  ),
  strictProductionEnv: booleanEnv("STRICT_PRODUCTION_ENV", false),
  malwareScanRequired: booleanEnv("MALWARE_SCAN_REQUIRED", false),
};

export function getProductionConfigurationProblems() {
  if (!productionConfig.isProduction) return [];

  const problems: string[] = [];
  const required = ["DATABASE_URL", "DIRECT_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"];
  for (const key of required) {
    if (!process.env[key]?.trim()) problems.push(`${key} is required in production.`);
  }

  if (productionConfig.processingMode === "queue" && !productionConfig.workerSecret) {
    problems.push("JOB_WORKER_SECRET or CRON_SECRET is required for queued processing.");
  }

  if (productionConfig.emailVerificationRequired && !process.env.RESEND_API_KEY) {
    problems.push(
      "RESEND_API_KEY is required when BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION is enabled.",
    );
  }

  if (productionConfig.malwareScanRequired && !process.env.MALWARE_SCAN_WEBHOOK_URL) {
    problems.push("MALWARE_SCAN_WEBHOOK_URL is required when MALWARE_SCAN_REQUIRED is enabled.");
  }

  if (productionConfig.directUploadsEnabled || productionConfig.objectStorageRequired) {
    const storageKeys = [
      "OBJECT_STORAGE_ENDPOINT",
      "OBJECT_STORAGE_BUCKET",
      "OBJECT_STORAGE_ACCESS_KEY_ID",
      "OBJECT_STORAGE_SECRET_ACCESS_KEY",
    ];
    const configured = storageKeys.filter((key) => process.env[key]?.trim()).length;
    if (configured > 0 && configured < storageKeys.length) {
      problems.push("Object storage configuration is incomplete.");
    }
    if (productionConfig.objectStorageRequired && configured !== storageKeys.length) {
      problems.push("Private object storage is required for this production deployment.");
    }
  }

  return problems;
}

export function assertProductionConfiguration() {
  const problems = getProductionConfigurationProblems();
  if (problems.length > 0 && productionConfig.strictProductionEnv) {
    throw new Error(`Invalid production configuration:\n${problems.join("\n")}`);
  }
  return problems;
}
