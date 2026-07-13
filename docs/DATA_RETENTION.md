# Data retention and deletion

Each workspace has a configurable retention period. New documents receive a `retentionUntil` date. The daily authenticated retention job deletes expired source objects and database records.

Production policy decisions must define:

- normal source-document retention;
- audit-event retention;
- extraction/correction history retention;
- backup expiration;
- legal hold procedure;
- deletion response time;
- countries in which data may be stored.

Account or business deletion removes private object-storage sources before database cascade deletion. Workspace ownership must be transferred before an owner with other members can delete the account.

Backups are not immediately mutable; deleted user data must expire from backups according to the documented backup retention window.
