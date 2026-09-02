# Commercial recovery drill

Madarsa ERP uses a fail-closed recovery drill to prove that the current production state can be recovered into an isolated Supabase environment before `backup_restore_drill_passed` is allowed to close.

The current Supabase project is on the Free plan, so the repository keeps an encrypted logical-backup workflow rather than claiming provider-managed daily backup retention as the commercial recovery mechanism.

## What one passing run proves

A passing run must prove all of the following in the same isolated workflow run:

1. **Database backup and restore**
   - production is read through the approved Supabase database endpoint;
   - Supabase-aware role, schema and data dumps are created;
   - the backup archive survives AES-256-CBC/PBKDF2 encryption and decryption;
   - schema and data restore into an initialized local Supabase Postgres target;
   - critical row counts and schema metrics match the source snapshot;
   - measured RPO and RTO satisfy the configured target.
2. **Auth recovery scope**
   - `auth.users` and `auth.identities` counts match between source and restored target;
   - the required managed Supabase role baseline (`anon`, `authenticated`, `service_role`, `supabase_auth_admin`, `supabase_storage_admin`) exists in both environments.
3. **Storage recovery/applicability**
   - the production `tenant-documents` object count is measured;
   - the current commercial gate can use the zero-blob applicability path only while that count is exactly zero;
   - the private `tenant-documents` bucket configuration and its four tenant-scoped object policies are reconstructed from `database/contracts/phase2_storage.sql` in the isolated target and must match production;
   - if production contains any Storage object, the drill fails closed until a real blob backup/restore mechanism is implemented and proven. Database dumps alone are never treated as blob recovery.
4. **Restored application**
   - the real Next.js application starts against the isolated restored Supabase stack;
   - a GET-only probe to `/apply/abu-school?lang=en` returns HTTP 200;
   - the restored response contains the expected tenant and branch context;
   - the recovery probe performs no POST, PUT, PATCH or DELETE request.

Only after all four scopes pass may the run evidence set `backup_restore_drill_passed=true` and `gate_can_be_closed=true`.

## Safety rules

- Never restore into production during a drill.
- Never paste the production database URL or recovery passphrase into issues, pull requests, logs or chat.
- Never upload plaintext SQL dumps as workflow artifacts.
- Never create synthetic recovery evidence, fake Storage objects, fake Auth identities or fabricated application results to make a launch gate green.
- The Storage zero-object path is valid only for the exact measured snapshot. As soon as real blobs exist, the workflow must fail until blob recovery is implemented.

## Required GitHub Actions secrets

### `MADARSA_ERP_DATABASE_URL`

Use the approved Madarsa ERP Supabase project connection for project `dysfnytqpbfxpmerkyaz`. The recovery script accepts only the exact direct project host or a Supabase pooler connection whose username contains the exact project reference. Libpq host/service query overrides are rejected.

### `MADARSA_ERP_RECOVERY_PASSPHRASE`

Use a unique passphrase of at least 24 characters, independent from the database password. Keep it for at least as long as any encrypted backup artifact is retained.

The restore target URL is supplied by the workflow and must resolve directly to loopback (`localhost`, `127.0.0.1`, or `::1`).

## Triggering the drill

The workflow supports:

- manual `workflow_dispatch`, with an explicit reason and RPO target;
- a guarded push trigger on `main` when recovery scripts, the Storage recovery contract, or the recovery workflow itself changes.

It is not scheduled and does not read production on unrelated pushes.

## Artifacts

A run can emit three private artifact classes:

1. **Sanitized stage diagnostics** — retained 3 days. Contains stage status and non-secret verification summaries useful when a run fails.
2. **Encrypted logical backup** — retained 7 days. Contains only the encrypted archive; plaintext SQL remains runner-temporary.
3. **Recovery evidence** — retained 30 days. Contains the final evidence JSON, checksums, Auth/Storage scope evidence and application-smoke evidence after a full pass.

Raw database URLs, recovery passphrases, local API keys and raw SQL are not intended to appear in these artifacts.

## Gate discipline

The database-only script deliberately begins with the launch gate false. The Auth/Storage scope check still leaves the gate false. The application verification is the finalizer and may turn the evidence true only after it confirms the prerequisite booleans from the same run.

A successful workflow artifact is evidence for a subsequent repository gate update; the workflow does not silently edit `config/launch-readiness.json` itself.

Never create synthetic recovery evidence. Review the passing run, preserve its provider/run reference, then update only the corresponding launch gate through normal tested repository change control.