# Parent + Teacher Portal — Completion Acceptance

A portal is complete only when the integrated implementation satisfies all items below.

## Parent
- Parent sees only linked children.
- Child switching is safe and tenant scoped.
- Attendance, timetable, homework, Qur’an progress, published results/report cards, notices/events, documents/IDs/certificates, and fee status/receipts render from authoritative data where available.
- No office/admin controls appear.
- Disabled/unclaimed access fails safely.

## Teacher
- Teacher sees only assigned students/classes derived from authoritative assignment scope.
- Teacher workspace includes today's timetable, assigned-student roster, attendance actions, homework context, Qur’an/Hifz context, permitted academic/marks context, notices, and own attendance/leave information.
- No unrelated branch/program/student data is visible.
- No office/admin controls appear unless the same authenticated membership legitimately has those permissions through an explicit office role.

## Shared access lifecycle
- Claim/invite is single-use and scoped.
- Login and account state are explicit.
- Disable/revoke immediately blocks portal access.
- Cross-tenant and cross-branch access fail closed.
- English and Urdu RTL are supported.
- Mobile layouts are usable at 360, 390, and 430 px widths.
- No raw Next.js 404 is reachable from visible portal navigation.

## Evidence required before closure
- Focused unit/contract tests.
- Real isolated database authorization matrix.
- Parent and Teacher authenticated browser QA using legitimate staging/test identities.
- Mobile + desktop visual QA in English and Urdu.
- Production build passes.

Passing tests or route existence alone is not completion.
