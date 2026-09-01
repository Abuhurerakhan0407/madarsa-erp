# Database recovery drill

This repository contains a manual, fail-closed database recovery drill for Madarsa ERP. It exists because the current Supabase organization is on the Free plan, where managed daily backup retention is not available as the commercial recovery mechanism. Supabase recommends maintaining logical dumps for Free projects.

The workflow follows the current Supabase CLI backup/restore pattern: roles, schema, and data are dumped separately, encrypted, restored into an isolated Supabase Postgres 17 target, and compared with the source snapshot.

## What this proves

A successful run proves all of the following for the database scope:

- the production database can be read using the approved database connection;
- a Supabase-aware logical backup can be created;
- the backup archive can be encrypted and decrypted with the configured recovery passphrase;
- the logical dump can be restored into an isolated Supabase Postgres target;
- critical Madarsa ERP table counts match the source snapshot after restore;
- public table, public/private function, and public RLS-policy counts match after restore;
- a measured database RPO and RTO can be produced.

It does **not** claim that Supabase Storage objects or the deployed Next.js application have been restored and verified. The workflow therefore leaves `backup_restore_drill_passed` false in its evidence. Do not change that gate merely because the database-only drill succeeds.

## Required GitHub Actions secrets

Create these repository Actions secrets before running the workflow:

1. `MADARSA_ERP_DATABASE_URL`
   - Use the **Session pooler** connection string for Supabase project `dysfnytqpbfxpmerkyaz` unless direct IPv6 connectivity is intentionally available.
   - The workflow rejects a connection string that does not contain the Madarsa ERP project ref.
   - Never paste this value into issues, PR comments, logs, or chat.
2. `MADARSA_ERP_RECOVERY_PASSPHRASE`
   - Use a unique random passphrase of at least 24 characters.
   - Keep it independent from the database password.
   - Retain it securely for as long as an encrypted recovery artifact may need to be decrypted.

## Running the drill

1. Open GitHub Actions for `Abuhurerakhan0407/madarsa-erp`.
2. Select **Database recovery drill**.
3. Choose **Run workflow** on `main`.
4. Enter the operational reason for the drill.
5. Keep the default 24-hour logical-backup RPO target unless an approved recovery objective says otherwise.

The workflow is intentionally `workflow_dispatch` only. It does not read production on every push or pull request.

## Artifacts

A successful run emits two private workflow artifacts:

- an AES-256-CBC/PBKDF2 encrypted logical backup, retained for 7 days;
- a non-secret evidence bundle, retained for 30 days.

Plain SQL dump files are kept only in the temporary runner workspace and removed before artifact upload. The evidence bundle contains digests, timings, row-count verification, schema metrics, and the GitHub Actions run reference. It must not contain the database URL or recovery passphrase.

## Evidence and launch-gate policy

The database drill is only one part of the commercial restore gate. To mark `backup_restore_drill_passed=true`, the product runbook still requires the complete approved recovery scope, including storage/application verification where applicable and review of any findings.

Do not insert `backup_evidence` or `restore_drills` rows with a passed state before the real run is complete and the evidence has been reviewed. Never create synthetic recovery evidence just to make the launch checklist green.
