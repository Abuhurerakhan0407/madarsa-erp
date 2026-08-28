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
- Local suite after implementation: 60 files / 291 tests passed before the final workspace selection tests; focused final tests passed. Lint has zero errors and one existing PostCSS warning; TypeScript passed; 41-page production build passed before the final small workspace resolver change.

## Remaining acceptance gates

- Feature branch commit, GitHub CI, Vercel preview and browser verification remain pending at document creation.
- A real preview flow would create records. It requires explicit action-time approval before browser submission. Read-only preview checks do not.
- Full Phase 5 still retains documents, assessments, guardian/household linkage, portal invitations, waitlists, imports, reporting, renewal/readmission and broader mobile acceptance.
