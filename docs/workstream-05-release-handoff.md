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
- Full Vitest on Windows: 753/758 passing; 5 unrelated platform/pre-existing failures recorded separately.
- GitHub Actions could not start due repository account billing/spending-limit restriction; no CI code result exists.
## Role matrix status
- Owner/admin: office surfaces are server-gated by domain permissions; static authorization contracts pass. Authenticated live role crawl not run.
- Office/clerk: office-capable permissions classify to office; unresolved memberships no longer inherit office/teacher UI. Authenticated live role crawl not run.
- Teacher: My Students requires teacher audience + verified employee link; student list is branch + assignment scoped. Student detail outside WS05 still uses timetable-only assignment checks.
- Parent: portal requires verified guardian identity link; guardian child scope derives from verified relationships and active/paused enrollment. Authenticated live role crawl not run.

## Security findings / cross-workstream defects
- **P0 | WS03 Qur'an/Hifz:** Qur'an workspace/detail/record RPCs authorize by tenant, branch, and learning permission but do not constrain teachers to assigned groups/students. A teacher granted recitation permission can read/record against other active students in the same branch. Integration must wait for assignment scoping.
- **P1 | WS02 Student Operations:** student detail teacher authorization only derives groups from `timetable_entries`; My Students and portal assignment scope recognize primary teacher + curriculum assignments too. Those teachers can see an assigned student in My Students but the detail link can fail closed.
- **P1 | Release infrastructure:** GitHub Actions job did not start because account payments/spending limit blocked Actions. Restore CI before release sign-off.
- **Release evidence gap:** no approved authenticated owner/office/teacher/parent storage state or disposable non-live QA tenant was available. No identities were fabricated to bypass this.

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
**Do not begin integration yet.** First fix WS03 Qur'an assignment scoping, align WS02 teacher student-detail assignment sources, restore CI, then run authenticated owner/office/teacher/parent + 360/390/430/desktop visual matrix. This is not production deployment permission.
