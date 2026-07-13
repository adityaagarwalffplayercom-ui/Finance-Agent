# Aureli production foundation

This release adds file signature validation, SHA-256 duplicate detection, persistent processing-job records, extraction versioning, production-safe debug routes, configurable email verification, security headers, structured logs, and CI.

## Deployment

1. Set production environment variables.
2. Run `npx prisma migrate deploy --schema=prisma/schema.prisma`.
3. Run `npm run verify:production`.
4. Deploy only after CI passes.

## Remaining infrastructure work

The database `Bytes` document payload is retained for backward compatibility. Before high-scale public launch, move binaries to private S3-compatible object storage and run processing in a dedicated queue worker. The new SHA-256, MIME and ProcessingJob fields are the migration foundation for that separation.
