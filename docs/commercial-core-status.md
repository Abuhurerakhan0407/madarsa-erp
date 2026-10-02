# Commercial core implementation checkpoint

Branch: `rescue/11-commercial-core`

This branch is a non-production integration/work branch. It is not approved for production deployment.

Implemented in this branch:

- Minimal Fees & Payments runtime with fee definitions, assignment, concessions, payment recording, receipts and branch-scoped read model.
- Minimal Contributions runtime for Donation / Zakat / Sponsorship with contributor records, optional beneficiary, receipts and summary totals.
- Minimal Payroll runtime with salary setup, monthly draft run, line calculation, finalize, mark-paid and payslip output.
- Roles & Access remains an exposed required launch surface.
- Operational AI Assistant uses aggregate operational context and a deterministic fallback; it is not allowed to fabricate student/person records.
- Client release navigation removes WhatsApp, Hostel, Transport and Library.
- English and Urdu are the only routable release locales. Arabic resources may remain dormant for migration/history compatibility.

Still blocked before launch:

- Parent/Teacher portal completion must be integrated into the release candidate.
- Qur'an/report academic provenance P0 must be independently re-verified and integrated.
- Remaining rescue workstreams must be reconciled into one release candidate.
- Combined migrations must be applied to an isolated/staging database.
- Full typecheck, tests, build, authenticated role matrix, mobile/RTL QA and document/PDF QA must pass on the integrated head.
- Production merge/deploy requires explicit approval.
