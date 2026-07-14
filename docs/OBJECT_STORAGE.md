# Private object storage

Actic Finance supports AWS S3, Cloudflare R2 and compatible private object stores using SigV4. Source documents are never public. The browser receives a short-lived PUT URL and the application issues short-lived GET URLs only after authorization.

Required environment variables are `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_ACCESS_KEY_ID` and `OBJECT_STORAGE_SECRET_ACCESS_KEY`.

Recommended bucket rules:

- block all public access;
- encrypt objects at rest;
- version or protect deletions according to the retention policy;
- allow CORS only from the production and staging origins;
- limit PUT/GET/HEAD to signed requests;
- lifecycle-abort incomplete multipart uploads;
- enable provider access logs.

Example CORS policy is in `docs/object-storage/cors.example.json`. Replace the example origins before applying it.

A malware-scanning service can be connected with `MALWARE_SCAN_WEBHOOK_URL`. It receives a short-lived private download URL and must explicitly return `{ "clean": true }`. Set `MALWARE_SCAN_REQUIRED=true` only after the provider is tested in staging.
