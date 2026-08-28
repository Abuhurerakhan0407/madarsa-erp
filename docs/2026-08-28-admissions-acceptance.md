# Admissions acceptance checkpoint — 28 August 2026

This records verified evidence before integrating the existing PR #7 → #8 → #9 → #10 → #11 stack. It does not claim that Phase 5 or the complete ERP is finished. Check current GitHub state before continuing.

## Source of truth and scope

- Preserve the approved Madarsa ERP Master Product Specification V1 and its Phase 0–15 roadmap.
- Current work: the Phase 5 admissions vertical slice; no Fees/Phase 9 reorder.
- Existing repository: `Abuhurerakhan0407/madarsa-erp`.
- Starting main: `7bc63f2932c8e6b70a9eb5ad59b31892a1f987a9` (PR #6).
- Starting PR #11 head: `12c1c27de91bc1dce73cbb20eb93729b6cc340d8`.
- The Vercel project was not deleted. Reauthorization restored connector visibility to the original project and preview. No replacement project or credential rotation was needed.
- Supabase was resumed and verified `ACTIVE_HEALTHY`.

## Existing application accepted through the real browser

Used the original application #11; did not create another applicant to bypass the unfinished smoke.

| Evidence | Result |
| --- | --- |
| Starting state | `decision`, revision 3; earlier review already completed on 21 August |
| Offer admission | Browser succeeded; `offered`, revision 4 |
| Decision reason | `Smoke test: approved for enrollment.` |
| Enroll as student | Browser succeeded; `enrolled`, revision 5 |
| Governed student number | `STU-MAIN-2026_27-00001` |
| Student/person linkage | One student profile linked to application person |
| Enrollment | One active enrollment, version 1 |
| Enrollment event | One append-only `created` event |
| Number counter | Session counter next value 2 |
| Workflow | Completed at `enrolled` |
| Audit | All five transitions from submitted r1 to enrolled r5 present |
| Students screen | One student and one enrollment for Dars-e-Nizami |

Two service-role RPC retries returned the same student number and enrollment with `idempotent: true`, without changing person/profile/enrollment/event/audit counts, counter values, or revision. Checks ran in a rolled-back transaction.

Applicant tracking RPC returned `enrolled`; an invalid secret hash returned no status. This was a service-role database integration check using the existing stored hash. The original plaintext tracking key was not recovered, so this is **not** a claim of fresh successful public tracking-form verification.

## Review fixes

### Issue #12 — intake/conversion validation

Regression tests first demonstrated six failures: impossible calendar dates/year zero and applicant names outside conversion limits were accepted by intake. Intake now rejects those values, retains valid leap dates and empty optional dates, and checks trimmed applicant names against the 2–160 character conversion limit.

### Issue #13 — runtime membership scope

`progress_admission_staff` and `setup_student_number_sequence` omitted membership start-time and branch-scope checks. A rollback-only test reproduced numbering access without a branch scope and before membership start time.

Forward migration `20260828112449_enforce_admissions_runtime_membership_scopes.sql` adds both checks and authorizes staff before returning transition conflicts. It preserves SECURITY INVOKER, empty search_path, restricted execute grants, published configuration, and application data. The timestamp comes from the actual Supabase migration record; CLI installation was unavailable.

Ten post-fix rollback checks passed: authorized owner access, unscoped denial, explicit branch-scope access, future-membership denial, transition protection, and conversion idempotency. Membership #1 was verified restored to its original timing/all-branches state, with zero temporary scope rows remaining.

## Verification at this checkpoint

- Unit/database-contract tests: **58 files, 258 tests passed**.
- ESLint: no errors; one existing `postcss.config.mjs` anonymous-default-export warning.
- TypeScript and production Next.js build: passed.
- Public tables: **232/232 RLS enabled**.
- Three affected admissions/numbering RPCs: `anon=false`, `authenticated=false`, `service_role=true`; no SECURITY DEFINER.
- Security advisor: no ERROR findings. Existing INFO notices cover tables with RLS and no browser policy. Existing WARN: leaked-password protection disabled; assess before launch: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Fresh GitHub CI, updated Vercel preview, ordered merges, and production verification remain subsequent gates; do not infer them from this file alone.

## Continuation

1. Confirm the updated PR #11 head passes CI and Vercel preview.
2. Review and merge #7 → #8 → #9 → #10 → #11, retargeting each child onto main after its parent merges. Preserve ancestry with merge commits and verify the expected head SHA.
3. Verify production against the already-applied forward migrations and existing enrolled application; never create a duplicate student for this check.
4. Select the next incomplete Phase 5 requirement from the master specification. Do not silently jump to Fees.

No guardian messaging, payments, destructive resets, or architecture changes were part of this checkpoint.

## Post-acceptance audit

The follow-up audit found that nine admissions child-table read policies checked tenant permission with a null branch. A rollback-only reproduction showed application #11 itself hidden while its version, review and decision remained visible to an unscoped membership. Forward migration `20260828115335_scope_admissions_child_reads.sql` makes each child inherit its parent application/enquiry branch boundary. A 9-table × 9-scenario database matrix passed 81 checks.

The same audit found inactive roles still authorized five service-role runtime RPCs and found no immutable `admission_conversions` row for the accepted application. Forward migration `20260828115931_harden_runtime_roles_and_conversion_linkage.sql` rejects inactive roles, applies missing membership timing/branch checks, backfills only uniquely provable links from the original successful audit event, writes links for future conversions, and reads those links on retry. Application #11 now has a permanent link to person #4 and enrollment #3. A second rollback matrix passed 34 denials plus two positive/idempotency checks, including a simulated later matching enrollment.

Public submission body enforcement now counts streamed bytes instead of trusting `Content-Length`; the media-type check no longer accepts `application/jsonp`. Launch readiness correctly keeps `security_advisors_clear` false while leaked-password protection remains disabled. These post-acceptance source changes still require their own PR CI, preview, merge and production browser verification; this paragraph does not claim those gates passed.
