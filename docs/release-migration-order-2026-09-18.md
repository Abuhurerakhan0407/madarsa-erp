# Ilmgaah release migration order — 2026-09-18

Production baseline already applied through:
- `20260916124501_phase5_claim_only_portal_lifecycle`

Apply release migrations only after an isolated staging rehearsal succeeds against a schema-only copy of the current production baseline (a Supabase development branch or a separate $0 staging project are both acceptable):

1. `20260917023000_rescue04_academic_result_reporting_accuracy.sql`
2. `20260917024500_rescue_daily_ops_quran_teacher_scope.sql`
3. `20260917043000_rescue_daily_ops_quran_privacy_hardening.sql`
4. `20260917060000_rescue_daily_ops_quran_revision_branch_isolation.sql`
5. `20260917060001_rescue04_academic_report_branch_isolation.sql`
6. `20260917113000_portal_guardian_report_card_read.sql`
7. `20260917114500_portal_guardian_documents.sql`
8. `20260917174200_attendance_biometric_release_hardening.sql`
9. `20260917181000_academic_domain_provenance_reconciliation.sql`
10. `20260917200000_minimal_fees_runtime.sql`
11. `20260917200001_minimal_fees_integrity_hardening.sql`
12. `20260917201000_minimal_contributions_runtime.sql`
13. `20260917202000_minimal_payroll_runtime.sql`
14. `20260917202001_minimal_payroll_integrity_hardening.sql`
15. `20260917203000_access_admin_identity_labels.sql`
16. `20260917204000_operational_assistant_permission.sql`
17. `20260917205000_commercial_permission_scope_hardening.sql`
18. `20260918100000_retire_whatsapp_runtime.sql`
19. `20260918101500_lock_release_locales_en_ur.sql`
20. `20260918102000_lock_preferred_locales_en_ur.sql`
21. `20260918102500_explicit_fail_closed_rls_policies.sql`

## Required staging evidence

Do not mark `database_migrations_applied` complete until all are true:

- isolated staging environment created from the current production schema baseline, with no production tenant rows copied
- migrations apply in filename order without collision
- all P0 database/contract tests pass
- security advisors reviewed after apply
- ACL/RLS checks pass
- branch/tenant isolation checks pass
- exact migration history recorded
- production remains untouched during validation

## Production rule

Do not apply these migrations to primary Supabase until explicit production approval, backup confirmation, exact RC SHA selection, and rollback plan confirmation.
