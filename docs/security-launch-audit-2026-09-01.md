# Supabase security launch audit — 1 September 2026

Project: `dysfnytqpbfxpmerkyaz`

This is a dated evidence snapshot, not a permanent security guarantee.

## Advisor result

Current Supabase security advisor returned:

- one `WARN`: leaked password protection disabled;
- twenty-eight `INFO` notices: RLS enabled with no policy on internal/governed tables.

`security_advisors_clear` must remain `false` while the leaked-password warning is unresolved.

Supabase currently documents leaked password protection as a Pro-plan-or-higher feature. The project is on the Free plan, so clearing this required launch control is a user-controlled plan decision rather than an engineering code change.

## RLS/no-policy INFO review

The INFO notices were checked against direct `anon` and `authenticated` table grants for every advised table. At this audit snapshot, all twenty-eight had **no direct `anon` or `authenticated` table grants**.

That supports treating these advisor entries as informational for the current access model rather than evidence that browser users can directly access those tables.

Tables reviewed:

- `attendance_device_events`
- `attendance_device_subject_mappings`
- `attendance_devices`
- `backup_evidence`
- `custom_field_values`
- `document_links`
- `enrollment_events`
- `identity_person_links`
- `operational_incidents`
- `person_contacts`
- `person_relationships`
- `platform_feature_flags`
- `platform_job_controls`
- `platform_support_cases`
- `platform_tenant_actions`
- `portal_access_codes`
- `recitation_attempt_corrections`
- `restore_drills`
- `saas_usage_events`
- `security_rate_limit_events`
- `student_bulk_operation_items`
- `student_bulk_operation_jobs`
- `subscription_checkout_intents`
- `subscription_provider_events`
- `support_impersonation_sessions`
- `tenant_feature_assignments`
- `workflow_instances`
- `workflow_tasks`

Do not add permissive RLS policies merely to silence these INFO notices. A policy would expand an access surface and must exist only when the application access design requires it.

## Gate closure requirement

Before `security_advisors_clear=true`:

1. enable leaked password protection or formally change the launch requirement through an approved security decision;
2. rerun the current Supabase security advisor;
3. review any new WARN/ERROR findings;
4. recheck that internal tables have not gained unintended `anon`/`authenticated` grants;
5. preserve exact production/deployment evidence.

No gate is changed by this audit document alone.
