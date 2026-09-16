# Ilmgaah Rescue 01 — Foundation route audit

Date: 2026-09-17
Branch: `rescue/01-foundation-ui-routing`
Exact base: `a4ce612bfcb639df4afb8d7aa1790352da336530`

## Routed locales

- Release routes: English (`en`) and Urdu (`ur`).
- Urdu uses RTL through the locale layout.
- Arabic remains a legacy copy/data key only; `/ar/*` normalizes to English before authentication.

## Visible office navigation

- `/{locale}` — Dashboard
- `/{locale}/admissions` — Admissions
- `/{locale}/students` — Students
- `/{locale}/attendance` — Attendance
- `/{locale}/quran` — Qur'an / Hifz
- `/{locale}/portals` — Parent & Teacher Access
- `/{locale}/staff` — Teachers
- `/{locale}/exams` — Exams
- `/{locale}/documents` — IDs & Documents
- `/{locale}/reports` — Reports
- `/{locale}/settings/configuration` — Settings

## Visible teacher navigation

- `/{locale}` — Teacher home
- `/{locale}/my-students` — My Students
- `/{locale}/attendance` — Attendance
- `/{locale}/quran` — Qur'an / Hifz

## Unresolved authorization

- Missing, permission-less, or otherwise unclassified workspace authorization resolves to a neutral fail-closed audience.
- Neutral audiences receive no operational desktop or mobile navigation and render a minimal access-unavailable state with language and sign-out controls only.
- Teacher navigation requires a verified teacher role plus the required teaching/student-read permissions; teaching permissions alone never imply teacher navigation.

## Deferred / hidden release surfaces

These implementations remain in code but are not exposed by Client V3 navigation or dashboard quick routes:

- Fees / payments demo surfaces
- Donations / sponsorships demo surfaces
- AI assistant / preview surfaces
- Hostel
- Transport
- Library expansion
- WhatsApp automation
- Student lifecycle import/promotion/renewal
- Branches / raw access administration
- Internal demo suite
- Programs & syllabus as a normal daily operator destination
- People/academics as a normal daily operator destination

No destructive route deletion was performed. Existing capability boundaries remain authoritative for direct access.

## Dynamic route safety findings

- Authenticated navigation emits concrete URLs only; no visible item contains literal `[personId]`, `[employmentId]`, or other route placeholders.
- Valid identifiers whose records no longer resolve use domain-specific not-found states for student, teacher, admission, enquiry, student-status-document, and Qur'an detail routes.
- Malformed identifiers still use framework not-found handling.
- Qur'an detail distinguishes a missing student from service failures; non-not-found errors are rethrown.
- Localized unmatched routes use branded `WorkspaceState` 404 UI.

## Mobile shell rules enforced

- Office bottom navigation: four quick destinations plus one Menu control maximum.
- Teacher bottom navigation: four teacher-specific destinations; no unnecessary Menu control when no supplemental routes exist.
- Supplemental menu is derived by nav keys rather than array positions.
- Bottom content reserves safe-area-aware space for fixed navigation.
- Drawer focus is trapped while open and Escape restores focus.
- RTL drawer direction and arrow direction remain supported.

## Verification evidence

- Navigation/unit contracts validate visible keys, deferred-surface exclusion, role classification, concrete route files, and absence of literal placeholders.
- Entity routing contracts validate branded/domain not-found behavior.
- Chromium route matrix validates anonymous protection for core, deferred, demo, English, Urdu, and legacy Arabic-normalization paths.

## Production-vs-code note

This rescue branch did not deploy or mutate production. Production-authenticated crawling was not claimed because no real credentials were fabricated or reset. Therefore production-vs-code discrepancies are recorded only where repository behavior is determinable; live authenticated rendering remains a release-QA responsibility using authorized identities.
