# Recovery scope verification

This document complements `docs/recovery-drill.md`. The database workflow alone must not close `backup_restore_drill_passed`.

## Live storage audit — 1 September 2026

Supabase project: `dysfnytqpbfxpmerkyaz`

Observed state during launch-hardening:

- bucket count: `1`;
- bucket: `tenant-documents`;
- bucket visibility: private;
- object count: `0`;
- maximum configured file size: 25 MiB;
- allowed types include PDF, common images, CSV, DOCX and XLSX.

This snapshot proves only that there were no Storage objects at audit time. It does not prove future Storage recovery.

Supabase database backups and logical `db dump` backups do not contain Storage object bytes. Storage metadata and object bytes therefore require separate recovery treatment whenever objects exist.

## Storage verification rule

At the time of every recovery drill:

1. Query bucket and object counts from the production project.
2. Record bucket IDs, visibility and object counts without exposing object content.
3. If total object count is zero, record Storage as `not_applicable_at_snapshot`, not as a successful object restore.
4. If any object exists, `storage_verified` must remain false until object bytes are backed up and restored through an approved Storage/S3/API mechanism.
5. After a restore, verify object count, object paths, byte hashes or equivalent integrity evidence, and successful authorized download for a representative object.
6. Never modify `storage` schema records directly to simulate a restore. Use Storage APIs or an approved S3-compatible migration/backup path.

## Application recovery boundary

The current database recovery workflow restores into an isolated Postgres service. That is intentionally safe, but a bare Postgres target is not a complete Supabase application environment: Madarsa ERP also depends on Supabase Auth/API behavior and the deployed Next.js runtime.

Therefore `application_verified` must remain false after a database-only restore.

## Application-level verification requirements

Application recovery is considered verified only against an isolated environment that can safely run the application without writing to production.

Minimum smoke scope:

1. restored database is reachable through the same Supabase-compatible API boundary expected by the application;
2. application boots with recovery-environment credentials, never production service-role credentials in client code;
3. authentication boundary can be exercised safely;
4. tenant/branch context resolves;
5. read-only smoke checks pass for students, attendance, documents, transport, hostel, library and access administration where fixture/restored data exists;
6. critical privileged RPCs remain inaccessible to `anon`/ordinary authenticated roles unless explicitly designed otherwise;
7. no outbound WhatsApp, payment, email, biometric-device or AI-provider side effects are emitted from the recovery environment;
8. canonical production remains untouched throughout the test.

## Current architectural implication

The existing GitHub Actions drill can prove database logical backup/restore, RPO/RTO and selected database consistency checks. It cannot yet prove the full application recovery scope because its restore target is only Postgres.

Do not weaken this boundary by marking `application_verified=true` from SQL checks alone.

## Gate closure rule

`backup_restore_drill_passed=true` requires reviewed evidence covering:

- real database drill success;
- measured RPO/RTO;
- Storage scope determination at drill time;
- Storage object recovery proof when objects exist;
- application-level smoke verification in an isolated Supabase-compatible recovery environment;
- findings reviewed and material issues resolved or explicitly accepted.

Until all applicable parts are proven, the gate remains false.
