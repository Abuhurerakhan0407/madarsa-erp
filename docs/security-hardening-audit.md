# Supabase security hardening audit — 1 September 2026

Project: `dysfnytqpbfxpmerkyaz`

Scope: current repository migrations plus live Supabase grants, RLS, functions, views and advisor output. This is a dated audit snapshot, not a permanent guarantee.

## Result

No code-level Supabase security defect requiring a migration was found in this sweep.

The launch gate `security_advisors_clear` must still remain `false` because the current security advisor reports leaked-password protection disabled. On the current Free plan, that control is plan/Auth-setting controlled rather than repairable through repository SQL.

## Live advisor evidence

Current security advisor:

- 1 WARN: leaked password protection disabled;
- 28 INFO notices: RLS enabled but no policy on internal/governed tables.

The 28 INFO tables were cross-checked against grants. None currently exposes direct table privileges to `anon` or `authenticated`. Adding permissive policies only to silence those notices would broaden the access surface and is not warranted.

## Function security

Live `public` schema inspection found four SECURITY DEFINER functions:

- `create_exam_series_v1`
- `get_exam_results_workspace_v2`
- `get_exam_setup_options_v1`
- `record_subscription_provider_event_v1`

For all four at this snapshot:

- explicit `search_path` is configured;
- `anon` EXECUTE = false;
- `authenticated` EXECUTE = false;
- `service_role` EXECUTE = true.

A separate live query across every `public` function returned zero functions executable by `anon` or `authenticated`.

Repository migration review also found no `GRANT EXECUTE ... TO public/anon/authenticated` statement. The SECURITY DEFINER migrations explicitly set `search_path`, revoke browser-role access, and grant execution to `service_role` only.

## Table and RLS security

Every current `public` table that grants `authenticated` SELECT has RLS enabled. A live query for authenticated-readable tables with RLS disabled returned zero rows.

The advisor's RLS-with-no-policy INFO tables are intentionally not made browser-readable merely to clear informational findings.

## Views

Current public views:

- `hr_effective_attendance_v1`
- `quran_effective_recitation_attempts_v1`

Neither view is directly selectable by `anon` or `authenticated`. The Qur'an effective read view is also marked `security_invoker=true`.

## Identity / authorization review

Repository migration sweep found no authorization path based on `raw_user_meta_data`. Existing privileged membership/permission helpers derive actor identity through trusted auth identity boundaries rather than user-editable profile metadata.

No tenant-ID trust bypass was found in the audited live privileged surface.

## New regression contract

`src/lib/database/security-surface-contract.test.ts` protects three high-risk invariants across all forward migrations:

1. browser roles cannot receive direct function EXECUTE through a migration;
2. every SECURITY DEFINER occurrence is paired with an explicit `search_path`, browser-role revoke, and `service_role` grant in its migration;
3. migrations cannot introduce authorization logic based on `raw_user_meta_data`.

This contract is intentionally narrow. It does not replace live advisor/RLS testing.

## External blocker

Leaked-password protection remains the only current advisor WARN. Do not mark `security_advisors_clear=true` unless that control is enabled (or the launch requirement is formally changed through an approved security decision) and the advisor is rerun clean enough for the approved policy.

## Gate discipline

This audit does **not** change `config/launch-readiness.json`.

Before the security gate can close:

1. resolve/approve the leaked-password protection requirement;
2. rerun the current Supabase security advisor;
3. review any new WARN/ERROR findings;
4. re-run repository CI and production verification on the exact head.
