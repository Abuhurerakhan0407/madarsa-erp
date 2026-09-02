# Recovery scope verification

This document complements `docs/recovery-drill.md` and defines the commercial recovery evidence required before `backup_restore_drill_passed` can close.

## Live recovery scope — 2 September 2026

Supabase project: `dysfnytqpbfxpmerkyaz`

Direct live verification during launch hardening established:

- Auth users: `1`;
- Auth identities: `1`;
- Storage bucket count in commercial scope: `1`;
- bucket: `tenant-documents`;
- bucket visibility: private;
- object count: `0`;
- maximum configured file size: 25 MiB;
- allowed MIME types: PDF, JPEG, PNG, WebP, CSV, DOCX and XLSX;
- four authenticated tenant-scoped Storage object policies exist for SELECT, INSERT, UPDATE and DELETE.

The zero-object fact is snapshot-specific. It must never be treated as proof that future Storage blobs can be recovered through a database dump.

## Storage verification rule

At every commercial recovery drill:

1. Query the production `tenant-documents` bucket and object count.
2. If the source object count is exactly zero, no blob bytes exist to restore for that snapshot.
3. In that zero-blob case, reconstruct the version-controlled bucket/policy contract in the isolated Supabase target and prove that bucket configuration and the four tenant-scoped policies match production.
4. If even one production Storage object exists, fail closed. Implement and prove a real Storage/S3/API blob backup-and-restore path before the recovery gate can close.
5. Never create a synthetic object or edit Storage metadata directly just to make the recovery gate green.

## Auth and privileged-access recovery rule

The isolated recovery target must preserve application-critical Supabase security scope, not merely public tables.

A passing run must prove:

- `auth.users` count matches the source snapshot;
- `auth.identities` count matches the source snapshot;
- the managed role baseline exists: `anon`, `authenticated`, `service_role`, `supabase_auth_admin`, `supabase_storage_admin`;
- a known privileged RPC boundary (`public.bootstrap_tenant`) remains executable by `service_role` but not by `anon` or ordinary `authenticated` roles.

If any of these differ between production and the isolated target, the recovery gate remains false.

## Restored application and API verification

The recovery workflow starts an initialized local Supabase stack and the real Next.js application against that isolated restored environment. Production must remain untouched.

A passing run must prove all of the following through GET-only probes:

1. the Next.js application boots against loopback recovery credentials;
2. `/apply/abu-school?lang=en` returns HTTP 200;
3. the restored response resolves `Al-Noor Islamic Academy` and `Central Campus`;
4. the restored Supabase API can read non-empty recovery data for:
   - Students (`student_profiles`);
   - Attendance (`attendance_records`);
   - Documents (`documents`);
   - Transport (`transport_routes`);
   - Hostel (`hostels`);
   - Library (`library_titles`);
   - Access administration (`memberships`);
5. anonymous requests cannot expose rows from sensitive `student_profiles` or `memberships` data;
6. the recovery probe performs no POST, PUT, PATCH or DELETE request;
7. no WhatsApp, payment, email, biometric-device or AI-provider side effect is emitted.

Response bodies containing student or operational rows are not stored in recovery artifacts. Module verification records only the module/table, HTTP result and count.

## Database evidence

The database portion of the same run must still prove:

- Supabase-aware logical schema/data backup succeeds;
- the backup archive is encrypted and can be decrypted;
- restore completes into the initialized isolated target;
- critical source/restored row counts match;
- public table, RLS-policy and public/private function counts match;
- measured RPO and RTO satisfy the configured objective.

## Gate closure rule

`backup_restore_drill_passed=true` is valid only when **one reviewed recovery run** proves all applicable scopes together:

- database backup/restore and consistency;
- Auth identity recovery;
- managed Supabase role baseline;
- privileged RPC access boundary;
- Storage zero-blob applicability/configuration, or real blob recovery when objects exist;
- restored Next.js application boot;
- GET-only operational-module API reads;
- anonymous sensitive-data boundary;
- no mutation/provider side effects;
- measured RPO/RTO.

The workflow evidence may say `gate_can_be_closed=true`, but `config/launch-readiness.json` is updated separately through normal tested repository change control after the artifact is reviewed.

Never weaken this standard or fabricate recovery evidence to reach a launch percentage.