# Ilmgaah Workstream 05 — Access + Release Handoff

Branch: `rescue/05-access-release`
Base: `feature/client-v3-phase-5-qa-demo-hardening` @ `a4ce612bfcb639df4afb8d7aa1790352da336530`

## Completed
- Claim-only portal lifecycle reviewed; retired credential endpoint remains 410 and password-free.
- Parent/Teacher Access phone cards added; raw internal IDs removed from client UI.
- My Students gets searchable responsive UI and teacher-only fail-closed access.
- My Students assignment scope now includes primary-class, curriculum, and timetable assignments.
- Unresolved memberships now receive restricted home-only navigation.
- WhatsApp client surface hidden because no provider dispatch worker/runtime was found.
- Arabic legacy routes continue normalizing to English; supported product locales remain English + Urdu.

## Verification evidence
- Focused WS05/security suite before final delta: 71/71 passing.
- Final delta contracts: 41/41 passing.
- Chromium anonymous route + WhatsApp E2E delta: 42/42 passing.
- Earlier full Chromium WS05 route/security run: 73/73 passing.
- TypeScript `tsc --noEmit`: passing.
- ESLint on changed WS05 files: passing.
- Full Vitest under repository-supported Node 22.23.2: **763/763 passing** across 162 files after release-infrastructure-only cross-platform test normalization.
- Follow-up Windows stability: recovery validation uses a 60-second budget for the known WSL cold-start path while recursive brand-scan tests retain their 30-second budget; assertions and production behavior are unchanged. Full suite remained **763/763 passing**.
- Platform triage: one Phase 2 SQL contract assertion was CRLF-sensitive; four recovery-drill validation tests were blocked first by CRLF Bash parsing and then by WindowsApps/WSL custom-environment propagation. Test harnesses now normalize input newlines and pass synthetic validation values as Bash positional arguments; production SQL and recovery behavior were not changed.
- GitHub Actions run #942 triggered on WS05 head `3c6c86c562a9221d61b7b116641120cad8f9050e`; `checks` completed with zero steps and no job log while `e2e` was skipped. Run #939 preserved the exact GitHub annotation: "The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings". This remains an infrastructure blocker, not a product test result.
## Claim migration audit
- Repository migration is `supabase/migrations/20260916124501_phase5_claim_only_portal_lifecycle.sql`.
- Exact base `a4ce612bfcb639df4afb8d7aa1790352da336530` already contained that migration but its claim lifecycle contract still referenced nonexistent `20260916173000_phase5_claim_only_portal_lifecycle.sql`; the base commit itself is the history-alignment commit removing the duplicate timestamp.
- WS05 changed only the stale contract path (`b9cdb9033c09bd0a9b138b28d6b39f5019778497`); no migration was renamed, generated, applied, or reordered.
- Claim lifecycle contract under Node 22.23.2: **5/5 passing**.

## Parallel dependency checkpoint
- Chat 01 supplied SHA `cd974913fe96894ea0514ac755306e0ff0885638` was independently inspected and is **ACCEPTED** for the manager-selected navigation contract: known office/admin -> office, verified teacher -> teacher, unresolved -> `neutral`; `neutral` has no operational navigation and the home route redirects to the access-unavailable/forbidden surface. Parent navigation remains the separate guardian portal. The remote Chat 01 branch advanced after the manager snapshot, so this checkpoint intentionally verifies the supplied SHA rather than silently substituting a newer head.
- WS05 has an integration conflict with Chat 01 in `src/app/[locale]/page.tsx`, `src/lib/navigation/audience.ts`, `src/lib/navigation/client-v3-navigation.ts`, `src/lib/navigation/client-v3-navigation.test.ts`, `src/lib/navigation/audience-contract.test.ts`, and `src/components/restricted-home.tsx`. Integration must keep Chat 01's canonical `neutral` contract and remove/reconcile the competing WS05 `restricted` naming/surface deliberately.
- Chat 02: **WAITING FOR NEW COMMITTED SHA**. Student assignment consistency P1 remains open; no parallel-chat claim is accepted without a new pushed commit and independent My Students -> Student Detail/photo verification.
- Chat 03 supplied SHA `94ca86413f085a9e52dbe99fcab9c1f1583a0d98` was independently inspected. Its Qur'an focused suite passed **56/56** under Node 22, assignment helpers derive server-side teacher identity and retire direct service-role execution of legacy unscoped RPCs. **P0 remains OPEN**, however, because `revision_obligations` has no branch identity and the new scoped wrappers still read/update branchless revision rows through legacy internals; cross-branch revision history/state can therefore leak or be mutated for a student who is otherwise valid in the current branch.
- Chat 04 supplied SHA `b07589b09046ded51fb5a92be6ed5ad9544d4c4b` was independently inspected. Focused academic P0 tests passed **39/39** under Node 22; configured grading, state transitions, CSV escaping, and report-card issued-snapshot authorization are sound in the reviewed paths. **ISSUE / not accepted for integration**: `public.run_operational_report_v1`, report key `program_progress`, does not require its branch-scoped enrollment `LEFT JOIN` to match, while `student_curriculum_progress` and `curriculum_teaching_assignments` have no branch column. Same-tenant progress from another branch can enter the requested branch report, especially with broad/null filters.

## Role matrix status
- Owner/admin: office surfaces are server-gated by domain permissions; static authorization contracts pass. Authenticated live role crawl not run.
- Office/clerk: office-capable permissions classify to office; unresolved memberships no longer inherit office/teacher UI. Authenticated live role crawl not run.
- Teacher: My Students requires teacher audience + verified employee link; student list is branch + assignment scoped. Student detail outside WS05 still uses timetable-only assignment checks.
- Parent: portal requires verified guardian identity link; guardian child scope derives from verified relationships and active/paused enrollment. Authenticated live role crawl not run.

## Security findings / cross-workstream defects
- **P0 | WS03 Qur'an/Hifz remains OPEN at `94ca86413f085a9e52dbe99fcab9c1f1583a0d98`:** assignment/list/student target gating is materially improved and the independent focused suite is 56/56, but revision isolation is incomplete. `revision_obligations` is tenant/student scoped with no `branch_id`. `get_quran_student_detail_v2` (called by `get_quran_student_detail_scoped_v1`) returns/counts revisions by tenant + student without origin-branch linkage; `get_quran_revision_queue_v2` likewise filters the student through current-branch access but not the obligation's originating branch. On writes, `record_quran_hifz_attempt_idempotent` and `correct_quran_recitation_attempt_v1`, reached through the new scoped wrappers, complete outstanding revisions by tenant + student + `source_key`, so a pass/correction in branch A can complete a same-key obligation created from branch B. Expected fix: give obligations a durable branch/source-attempt relation or derive branch from a durable source relation, and enforce it on detail, queue, record/save-next, legacy record, and correction paths with executable cross-branch regressions.
- **P0 | WS04 Reports at `b07589b09046ded51fb5a92be6ed5ad9544d4c4b`:** `run_operational_report_v1` / `program_progress` reads `student_curriculum_progress` tenant-wide and only `LEFT JOIN`s a current enrollment constrained to `p_branch_id`; it never requires `e.id is not null`. Progress rows and curriculum teaching assignments do not carry a branch column, so a progress row created in another branch can appear in the requested branch report. Expected fix: require a branch-valid enrollment/assignment relationship for every emitted progress row and add executable cross-branch tests, including null filters and assignment-derived session/program/group filters.
- **P1 | WS02 Student Operations:** My Students recognizes primary teacher + curriculum + timetable assignments, while the last independently inspected Student Detail path was not yet proven authorization-consistent. Await the manager-requested new Chat 02 SHA and test primary-only, curriculum-group-only, legitimate direct curriculum-student, timetable-only, unassigned, cross-program, cross-branch, cross-tenant, null-branch and photo access.
- **P1 | Release infrastructure:** GitHub Actions workflow triggers, but runner/application execution is blocked before steps by the account billing/spending restriction. Restore CI availability before release sign-off.
- **Release evidence gap:** no approved authenticated owner/office/teacher/parent storage state or disposable non-live QA tenant was available. No identities were fabricated to bypass this; authenticated role and visual matrices remain unchecked.

## WhatsApp decision
**HIDE.** Database queue, template, consent, handoff, and permission contracts exist, but no functional provider worker/API dispatch implementation was found. Client navigation already omitted WhatsApp; authenticated route now returns not-found. Backend contracts remain intact for future completion.

## Rollback plan
No merge or production deploy was performed. Rollback is branch-level: abandon `rescue/05-access-release` / draft PR and retain base SHA `a4ce612bfcb639df4afb8d7aa1790352da336530` unchanged.
## Authoritative release checklist
- [ ] zero navigation 404
- [ ] zero raw Next.js 404
- [ ] zero literal dynamic placeholders
- [x] no unfinished modules exposed
- [ ] no mobile horizontal overflow
- [ ] admissions verified
- [ ] students verified
- [ ] student attendance verified
- [ ] teacher attendance verified
- [ ] quran verified
- [ ] staff verified
- [ ] exams/results verified
- [ ] report cards verified
- [ ] IDs verified
- [ ] documents verified
- [ ] reports verified
- [ ] My Students verified end-to-end
- [ ] parent portal verified end-to-end
- [ ] teacher portal verified end-to-end
- [ ] settings verified
- [ ] English cross-product
- [ ] Urdu RTL cross-product
- [ ] biometric path checked
- [ ] PDFs checked
- [ ] 360×800
- [ ] 390×844
- [ ] 430×932
- [ ] desktop
- [ ] owner/admin permissions authenticated
- [ ] office permissions authenticated if role exists
- [ ] teacher permissions authenticated
- [ ] parent permissions authenticated
- [ ] preview smoke
- [x] rollback plan documented

Independently closed: **2/34** release checklist items. Remaining items require authenticated role fixtures and/or evidence from owning workstreams; they were not ticked from parallel-chat claims.

## Integration recommendation
**RED. Do not begin integration yet.** Close the WS03 branchless Qur'an revision read/write P0, close the WS04 `program_progress` branch-isolation P0, receive and independently verify Chat 02's new authorization-consistency SHA, reconcile WS05 navigation to Chat 01's canonical `neutral` contract, restore usable CI, then complete authenticated owner/office/teacher/parent plus 360/390/430/desktop English + Urdu RTL evidence. This is not merge or production-deployment permission.
