# Actic Finance production-hardening verification

Verification date: 13 July 2026

## Release scope

This release adds a backwards-compatible production foundation around the
existing Actic Finance financial engine:

- private S3-compatible source storage with signed direct uploads;
- database source-storage fallback for local development;
- file-signature, extension, encrypted-PDF, page-count and spreadsheet expansion checks;
- optional malware-scanning webhook integration;
- durable database processing jobs with idempotency, retries, heartbeat and stale-job recovery;
- extraction-run versioning and audited manual corrections;
- active workspaces, membership roles, invitations and workspace-isolated financial data;
- workspace-scoped documents, ledger entries, dashboard calculations, forecasts and AI chat history;
- persistent plan quotas and monthly usage/cost records;
- email verification, password recovery and persistent authentication rate limiting;
- privacy-aware source deletion, retention cleanup and safe health/debug routes;
- CI, migration verification, secret scanning, dependency updates and incident/deployment runbooks.

## Automated verification completed in the build sandbox

- Prisma schema validation through Prisma's local WASM schema validator: **passed**.
- ESLint across the repository: **0 errors, 0 warnings**.
- TypeScript/TSX syntax transpilation: **170 files passed**.
- Production hardening tests: **8/8 passed**.
- Financial parser regression tests: **8/8 passed**.
- Secret scan: **passed across repository files**.
- GitHub workflow/dependabot YAML parsing: **passed**.
- Patch apply-and-hash comparison: performed during artifact packaging.

## Uploaded financial PDF regression

Source: `AFRs31032026signed.pdf`

- Revenue: INR 231,546,000,000
- Expenses: INR 187,060,800,000
- Net income: INR 34,990,800,000
- Cash: INR 13,205,700,000
- Assets: INR 131,824,900,000
- Liabilities: INR 80,255,200,000
- Equity: INR 51,569,700,000
- Detailed current-period rows: 111
- Selected scope: consolidated
- Statement pages: 10, 11, 12
- Layout confidence: 0.99
- Balance-sheet equation: passed
- Extraction warnings: none

## Full semantic typecheck/build limitation in the sandbox

The isolated sandbox cannot download Prisma's platform schema/query engine from
`binaries.prisma.sh`. Therefore it cannot regenerate the final Prisma client,
run a trustworthy semantic `tsc --noEmit`, or complete `next build` against the
new schema. The existing generated client represents the previous schema and is
not a valid basis for judging the new workspace/storage/job fields.

The included CI workflow uses PostgreSQL 16 and performs the required final gates:

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

Run those commands on the development machine and in staging before production
traffic. A release must not be deployed when any gate fails.

## Operational limitation

Provider credentials and external infrastructure cannot be provisioned inside
source code. Production still requires a private bucket, verified email sender,
Gemini project, monitoring endpoint, database backup/PITR policy, domain/DNS and
optional malware-scanning service. Until those are configured, keep local-safe
fallback settings enabled and do not claim the deployment is fully production-ready.
