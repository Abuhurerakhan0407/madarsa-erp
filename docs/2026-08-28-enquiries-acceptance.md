# Enquiries and follow-up checkpoint — 28 August 2026

Scope: the next Phase 5 slice in issue #14. This does not complete all admissions or the ERP.

## Implemented

- Branch-scoped enquiry list, create and detail screens in English, Urdu and Arabic.
- Consent, applicant/guardian contact, session, program, source, preferred language, notes, owner and required next follow-up capture.
- Phone/email normalization and branch-local possible-duplicate hints. Nothing auto-merges.
- Append-only follow-up history, controlled status transitions and next-action scheduling.
- Qualified enquiry to a submitted, version-pinned admission application with one-time tracking credentials.
- Duplicate application start requires explicit confirmation, override permission and a 20-character reason.
- Application enrollment synchronizes its linked enquiry to `converted`.
- Runtime functions are SECURITY INVOKER and executable only by service_role; authenticated browser roles retain scoped RLS reads.
- Workspace resolution now rejects future/expired memberships and selects only an allowed branch for branch-scoped staff.

## Evidence before integration

- Live migration version: `20260828195958_enquiries_followup_runtime`.
- Rollback database flow: create → duplicate hint → qualify → application → review → offer → enrollment → idempotent retry.
- Rollback denials: unscoped branch, future, expired, revoked, inactive role, missing permission, wrong identity and wrong tenant.
- Result: 16/16 flow and denial assertions passed; helper/create RPC execute denied to authenticated and allowed only to service_role.
- After rollback: zero enquiries/follow-ups; original application #11 remains enrolled revision 5; one student profile, one active enrollment and conversion link to person #4/enrollment #3.
- Initial feature commit `394f4ad8488a51ed0d3f18687a4f2f282a290878`: GitHub Actions run `33206637634` passed and its Vercel preview reached `READY`.
- Post-implementation React audit fixed three omissions: network/non-JSON failures can no longer leave forms busy, database duplicate hints now reach the staff UI, and enquiry/application states plus follow-up channels are localized instead of exposing raw enum values.
- Final local suite after the React audit: 62 files / 296 tests passed; lint has zero errors and one existing PostCSS warning; TypeScript passed; the 41-page production build passed.

## Remaining acceptance gates

- The final React-audit commit still requires GitHub CI and Vercel preview verification before merge.
- A real preview flow would create records. It requires explicit action-time approval before browser submission. Read-only preview checks do not.
- Full Phase 5 still retains documents, assessments, guardian/household linkage, portal invitations, waitlists, imports, reporting, renewal/readmission and broader mobile acceptance.
