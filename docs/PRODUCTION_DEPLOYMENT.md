# Aureli production deployment

## Release gates

Do not expose Aureli to real financial users until all of these pass in staging:

```bash
npm ci
npm run prisma:validate
npm run db:migrate
npm run lint
npm run typecheck
npm test
npm run secrets:check
npm run build
```

Use separate development, staging and production databases, storage buckets, Gemini projects, email domains and secrets. Never point preview deployments at production data.

## Required production architecture

1. PostgreSQL with pooling for runtime and a direct connection for migrations.
2. Private S3-compatible object storage with CORS limited to the Aureli domain.
3. `DOCUMENT_PROCESSING_MODE=queue` and the authenticated cron worker.
4. A verified email sender for verification, recovery and workspace invitations.
5. Error/uptime monitoring that consumes structured JSON logs.
6. Daily database backups, point-in-time recovery and tested restore drills.

## Deployment order

1. Create a database backup.
2. Deploy the code to staging.
3. Run `npm run db:migrate` against staging.
4. Upload and process the golden PDF set.
5. Verify corrections, approval, ledger posting, privacy export and deletion.
6. Deploy production code.
7. Run `npm run db:migrate` against production before serving traffic.
8. Check `/api/health`; it must not expose secrets or raw database errors.
9. Start with a small controlled beta and monitor queue failures and extraction review rates.

## Essential environment choices

```env
NODE_ENV=production
STRICT_PRODUCTION_ENV=true
DOCUMENT_PROCESSING_MODE=queue
DIRECT_UPLOADS_ENABLED=true
OBJECT_STORAGE_REQUIRED=true
BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION=true
REQUIRE_AI_PROCESSING_CONSENT=true
ENABLE_DEBUG_ROUTES=false
```

Object storage, job worker, email and Gemini credentials are listed in `.env.example`.

## Object storage migration

First run a dry run:

```bash
npm run storage:migrate
```

Then migrate database-stored source files:

```bash
npm run storage:migrate -- --apply
```

The script uploads and verifies each object before clearing its database byte column. Keep database backups until the migrated object count and random downloads are verified.

## Background processing

Vercel cron calls `/api/cron/process-jobs` every minute. Other hosts can call the same endpoint using:

```http
Authorization: Bearer <JOB_WORKER_SECRET>
```

The job table provides retries, idempotency, heartbeats and stale-job recovery. Run `npm run queue:drain` only for controlled operations.

## Rollback

- Roll code back to the previous deployment.
- Do not reverse a production migration without a reviewed rollback script.
- New nullable columns and tables are backwards compatible with the previous release.
- Restore the database only after confirming data corruption; a code rollback is normally safer.
