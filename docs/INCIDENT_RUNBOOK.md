# Incident runbook

## First response

1. Stop unsafe posting by disabling the processing cron or setting queue processing capacity to zero.
2. Preserve logs, request IDs, job IDs, document IDs and deployment commit.
3. Do not delete failed documents until evidence is captured.
4. Check database health, queue age, Gemini quota, object storage and email provider independently.

## Extraction incident

- Move affected documents to `NEEDS_REVIEW`.
- Delete their posting ledger rows through the normal review reset flow.
- Record parser, prompt and model versions from `ExtractionRun`.
- Reproduce using the source hash and golden test harness.
- Release a parser fix through staging before reprocessing production documents.

## Stuck queue

- Inspect RUNNING jobs whose heartbeat is older than `STALE_JOB_MINUTES`.
- Call the authenticated cron endpoint; stale jobs are requeued automatically.
- Never manually mark a job completed unless the document and extraction run are verified.

## Suspected data exposure

- Rotate auth, database, storage, Gemini, email, admin and worker secrets.
- Revoke sessions and storage credentials.
- Identify affected workspace/document IDs from audit and provider logs.
- Follow applicable legal notification requirements.

## Recovery validation

After recovery, test sign-in, secure upload, queue processing, review, correction, ledger posting, privacy export and permanent deletion.
