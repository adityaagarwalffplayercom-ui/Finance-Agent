ALTER TABLE "ledger_entry" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "business_chat_message" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
-- Aureli production hardening
-- Backwards-compatible additions for workspaces, private object storage,
-- durable processing jobs, extraction versioning, corrections, quotas and retention.

DO $$ BEGIN
  CREATE TYPE "DocumentStorageProvider" AS ENUM ('DATABASE', 'S3');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ProcessingJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ExtractionRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CorrectionStatus" AS ENUM ('ACTIVE', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'ACCOUNTANT', 'ANALYST', 'VIEWER', 'AUDITOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "WorkspacePlan" AS ENUM ('FREE', 'STARTER', 'BUSINESS', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'UPLOADING' BEFORE 'UPLOADED';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'QUEUED' AFTER 'UPLOADED';


ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "activeWorkspaceId" TEXT;

ALTER TABLE "document"
  ALTER COLUMN "content" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "detectedMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "storageProvider" "DocumentStorageProvider" NOT NULL DEFAULT 'DATABASE',
  ADD COLUMN IF NOT EXISTS "storageKey" TEXT,
  ADD COLUMN IF NOT EXISTS "sha256" TEXT,
  ADD COLUMN IF NOT EXISTS "pageCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "retentionUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "workspaceId" TEXT,
  ADD COLUMN IF NOT EXISTS "businessId" TEXT;

ALTER TABLE "business"
  ADD COLUMN IF NOT EXISTS "workspaceId" TEXT,
  ADD COLUMN IF NOT EXISTS "aiProcessingConsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);

ALTER TABLE "usage_event"
  ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

ALTER TABLE "audit_event"
  ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

CREATE TABLE IF NOT EXISTS "workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "plan" "WorkspacePlan" NOT NULL DEFAULT 'FREE',
  "retentionDays" INTEGER NOT NULL DEFAULT 365,
  "aiProcessingConsentAt" TIMESTAMP(3),
  "termsAcceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "workspace_member" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "processing_job" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "status" "ProcessingJobStatus" NOT NULL DEFAULT 'QUEUED',
  "idempotencyKey" TEXT NOT NULL,
  "documentVersion" INTEGER NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "lockToken" TEXT,
  "lockedAt" TIMESTAMP(3),
  "heartbeatAt" TIMESTAMP(3),
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "processing_job_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "extraction_run" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "runNumber" INTEGER NOT NULL,
  "status" "ExtractionRunStatus" NOT NULL DEFAULT 'RUNNING',
  "engineVersion" TEXT NOT NULL,
  "parserVersion" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "modelName" TEXT,
  "sourceFileHash" TEXT,
  "output" JSONB,
  "diagnostics" JSONB,
  "warnings" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "extraction_run_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "document_correction" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "extractionRunId" TEXT,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "fieldPath" TEXT NOT NULL,
  "originalValue" JSONB,
  "correctedValue" JSONB NOT NULL,
  "reason" TEXT,
  "status" "CorrectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_correction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "workspace_invitation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_invitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "workspace_usage_monthly" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "month" TIMESTAMP(3) NOT NULL,
  "plan" "WorkspacePlan" NOT NULL,
  "uploads" INTEGER NOT NULL DEFAULT 0,
  "aiProcesses" INTEGER NOT NULL DEFAULT 0,
  "processedPages" INTEGER NOT NULL DEFAULT 0,
  "storageBytes" BIGINT NOT NULL DEFAULT 0,
  "aiInputTokens" BIGINT NOT NULL DEFAULT 0,
  "aiOutputTokens" BIGINT NOT NULL DEFAULT 0,
  "estimatedCostMicros" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_usage_monthly_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "rateLimit" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "lastRequest" BIGINT NOT NULL,
  CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_slug_key" ON "workspace"("slug");
CREATE INDEX IF NOT EXISTS "workspace_ownerId_idx" ON "workspace"("ownerId");
CREATE INDEX IF NOT EXISTS "user_activeWorkspaceId_idx" ON "user"("activeWorkspaceId");
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_member_workspaceId_userId_key" ON "workspace_member"("workspaceId", "userId");
CREATE INDEX IF NOT EXISTS "workspace_member_userId_idx" ON "workspace_member"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "document_storageKey_key" ON "document"("storageKey");
CREATE INDEX IF NOT EXISTS "document_userId_sha256_idx" ON "document"("userId", "sha256");
CREATE INDEX IF NOT EXISTS "document_workspaceId_uploadedAt_idx" ON "document"("workspaceId", "uploadedAt");
CREATE INDEX IF NOT EXISTS "business_chat_message_workspaceId_createdAt_idx" ON "business_chat_message"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "ledger_entry_workspaceId_transactionDate_idx" ON "ledger_entry"("workspaceId", "transactionDate");
CREATE INDEX IF NOT EXISTS "ledger_entry_workspaceId_isPosting_direction_status_idx" ON "ledger_entry"("workspaceId", "isPosting", "direction", "status");
CREATE INDEX IF NOT EXISTS "document_retentionUntil_idx" ON "document"("retentionUntil");
CREATE INDEX IF NOT EXISTS "business_workspaceId_idx" ON "business"("workspaceId");
CREATE INDEX IF NOT EXISTS "usage_event_workspaceId_eventType_createdAt_idx" ON "usage_event"("workspaceId", "eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_event_workspaceId_createdAt_idx" ON "audit_event"("workspaceId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "processing_job_idempotencyKey_key" ON "processing_job"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "processing_job_status_availableAt_priority_idx" ON "processing_job"("status", "availableAt", "priority");
CREATE INDEX IF NOT EXISTS "processing_job_documentId_createdAt_idx" ON "processing_job"("documentId", "createdAt");
CREATE INDEX IF NOT EXISTS "processing_job_workspaceId_createdAt_idx" ON "processing_job"("workspaceId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "extraction_run_documentId_runNumber_key" ON "extraction_run"("documentId", "runNumber");
CREATE INDEX IF NOT EXISTS "extraction_run_workspaceId_createdAt_idx" ON "extraction_run"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "extraction_run_status_createdAt_idx" ON "extraction_run"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "document_correction_documentId_status_idx" ON "document_correction"("documentId", "status");
CREATE INDEX IF NOT EXISTS "document_correction_workspaceId_createdAt_idx" ON "document_correction"("workspaceId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invitation_tokenHash_key" ON "workspace_invitation"("tokenHash");
CREATE INDEX IF NOT EXISTS "workspace_invitation_workspaceId_email_idx" ON "workspace_invitation"("workspaceId", "email");
CREATE INDEX IF NOT EXISTS "workspace_invitation_email_expiresAt_idx" ON "workspace_invitation"("email", "expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_usage_monthly_workspaceId_month_key" ON "workspace_usage_monthly"("workspaceId", "month");
CREATE INDEX IF NOT EXISTS "workspace_usage_monthly_month_idx" ON "workspace_usage_monthly"("month");
CREATE UNIQUE INDEX IF NOT EXISTS "rateLimit_key_key" ON "rateLimit"("key");

-- Give every existing user a stable default workspace and owner membership.
INSERT INTO "workspace" ("id", "name", "slug", "ownerId", "createdAt", "updatedAt")
SELECT
  'ws_' || substr(md5(u."id"), 1, 24),
  COALESCE(NULLIF(b."name", ''), NULLIF(u."name", ''), 'My Workspace'),
  'workspace-' || substr(md5(u."id"), 1, 20),
  u."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "user" u
LEFT JOIN "business" b ON b."userId" = u."id"
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "workspace_member" ("id", "workspaceId", "userId", "role", "createdAt", "updatedAt")
SELECT
  'wsm_' || substr(md5(u."id"), 1, 24),
  'ws_' || substr(md5(u."id"), 1, 24),
  u."id",
  'OWNER'::"WorkspaceRole",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "user" u
ON CONFLICT ("workspaceId", "userId") DO NOTHING;

UPDATE "user" u
SET "activeWorkspaceId" = 'ws_' || substr(md5(u."id"), 1, 24)
WHERE u."activeWorkspaceId" IS NULL;

UPDATE "business" b
SET "workspaceId" = 'ws_' || substr(md5(b."userId"), 1, 24)
WHERE b."workspaceId" IS NULL;

UPDATE "document" d
SET
  "workspaceId" = 'ws_' || substr(md5(d."userId"), 1, 24),
  "businessId" = COALESCE(d."businessId", b."id"),
  "retentionUntil" = COALESCE(d."retentionUntil", d."uploadedAt" + INTERVAL '365 days'),
  "storageProvider" = COALESCE(d."storageProvider", 'DATABASE'::"DocumentStorageProvider"),
  "version" = COALESCE(d."version", 1)
FROM "business" b
WHERE b."userId" = d."userId";

UPDATE "document" d
SET
  "workspaceId" = 'ws_' || substr(md5(d."userId"), 1, 24),
  "retentionUntil" = COALESCE(d."retentionUntil", d."uploadedAt" + INTERVAL '365 days'),
  "storageProvider" = COALESCE(d."storageProvider", 'DATABASE'::"DocumentStorageProvider"),
  "version" = COALESCE(d."version", 1)
WHERE d."workspaceId" IS NULL;

UPDATE "usage_event" e
SET "workspaceId" = 'ws_' || substr(md5(e."userId"), 1, 24)
WHERE e."workspaceId" IS NULL;

UPDATE "audit_event" e
SET "workspaceId" = 'ws_' || substr(md5(e."userId"), 1, 24)
WHERE e."workspaceId" IS NULL;

UPDATE "business_chat_message" m
SET "workspaceId" = COALESCE(u."activeWorkspaceId", 'ws_' || substr(md5(m."userId"), 1, 24))
FROM "user" u
WHERE u."id" = m."userId"
  AND m."workspaceId" IS NULL;

UPDATE "ledger_entry" le
SET "workspaceId" = COALESCE(
  (SELECT d."workspaceId" FROM "document" d WHERE d."id" = le."documentId"),
  (SELECT u."activeWorkspaceId" FROM "user" u WHERE u."id" = le."userId"),
  'ws_' || substr(md5(le."userId"), 1, 24)
)
WHERE le."workspaceId" IS NULL;

-- Foreign keys are added conditionally so rerunning the migration is safe in drifted development databases.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_activeWorkspaceId_fkey') THEN
    ALTER TABLE "user" ADD CONSTRAINT "user_activeWorkspaceId_fkey" FOREIGN KEY ("activeWorkspaceId") REFERENCES "workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_ownerId_fkey') THEN
    ALTER TABLE "workspace" ADD CONSTRAINT "workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_member_workspaceId_fkey') THEN
    ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_member_userId_fkey') THEN
    ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_workspaceId_fkey') THEN
    ALTER TABLE "business" ADD CONSTRAINT "business_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_workspaceId_fkey') THEN
    ALTER TABLE "document" ADD CONSTRAINT "document_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_businessId_fkey') THEN
    ALTER TABLE "document" ADD CONSTRAINT "document_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_chat_message_workspaceId_fkey') THEN
    ALTER TABLE "business_chat_message" ADD CONSTRAINT "business_chat_message_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entry_workspaceId_fkey') THEN
    ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_event_workspaceId_fkey') THEN
    ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_event_workspaceId_fkey') THEN
    ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'processing_job_documentId_fkey') THEN
    ALTER TABLE "processing_job" ADD CONSTRAINT "processing_job_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'processing_job_userId_fkey') THEN
    ALTER TABLE "processing_job" ADD CONSTRAINT "processing_job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'processing_job_workspaceId_fkey') THEN
    ALTER TABLE "processing_job" ADD CONSTRAINT "processing_job_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extraction_run_documentId_fkey') THEN
    ALTER TABLE "extraction_run" ADD CONSTRAINT "extraction_run_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extraction_run_userId_fkey') THEN
    ALTER TABLE "extraction_run" ADD CONSTRAINT "extraction_run_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extraction_run_workspaceId_fkey') THEN
    ALTER TABLE "extraction_run" ADD CONSTRAINT "extraction_run_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_correction_documentId_fkey') THEN
    ALTER TABLE "document_correction" ADD CONSTRAINT "document_correction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_correction_extractionRunId_fkey') THEN
    ALTER TABLE "document_correction" ADD CONSTRAINT "document_correction_extractionRunId_fkey" FOREIGN KEY ("extractionRunId") REFERENCES "extraction_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_correction_userId_fkey') THEN
    ALTER TABLE "document_correction" ADD CONSTRAINT "document_correction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_correction_workspaceId_fkey') THEN
    ALTER TABLE "document_correction" ADD CONSTRAINT "document_correction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_invitation_workspaceId_fkey') THEN
    ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_invitation_invitedById_fkey') THEN
    ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_usage_monthly_workspaceId_fkey') THEN
    ALTER TABLE "workspace_usage_monthly" ADD CONSTRAINT "workspace_usage_monthly_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
