# Ilmgaah commercial release-candidate checkpoint

Branch: `rescue/13-commercial-release-candidate`

This branch is the current non-production release candidate. It is not approved for production deployment and must not update the installed app/APK yet.

Integrated on this release candidate:

- Parent Portal and Teacher Portal, including teacher-scoped workspace and guardian-facing documents/results.
- Admissions and Student Information System rescue work.
- Student documents, IDs, certificates, report-card PDFs and portal document access.
- Student and staff attendance plus biometric bridge/reconciliation work.
- Qur'an/Hifz rescue hardening and branch/privacy protections.
- Exams, results, reports and academic provenance reconciliation.
- Programs & Syllabus.
- Academics, timetable, homework and calendar workspace.
- Student import, promotion and renewal lifecycle.
- Roles & Access.
- Institution configuration.
- Minimal Fees & Payments runtime.
- Minimal Contributions runtime for Donation / Zakat / Sponsorship.
- Minimal Payroll runtime.
- Operational AI Assistant using aggregate authorized context.
- Hostel & Mess workspace reactivated on the reintegration branch using the existing governed database/runtime contract.
- English and Urdu as the only routable release locales.

Removed from the commercial product:

- Student Portal.
- WhatsApp Automation.
- Transport / Routes.
- Library.
- Internal scripted demo suite.

WhatsApp-specific application/API/runtime code has been removed. Historical migration history is retained for database consistency, followed by a retirement migration that disables WhatsApp configuration/templates and drops WhatsApp RPC entrypoints.

Current launch blockers:

- Apply the complete integrated migration stack to an isolated/staging database.
- Re-run the academic/Qur'an provenance adversarial database matrix on the integrated head.
- Run full TypeScript, lint, unit/contract tests, production build and Playwright on the integrated head.
- Run authenticated role QA for owner/admin/office, teacher and parent.
- Run mobile QA at 360/390/430 widths plus desktop.
- Run English and Urdu/RTL visual/workflow QA.
- Run document/PDF/print QA on representative real staging records.
- Verify biometric device-event-to-attendance flow against the selected real device/provider if hardware delivery is in the client handoff.
- Close security advisor findings.
- Resolve the payment-webhook gate according to the intentionally-small Fees scope.
- Obtain pilot/client acceptance.
- Only after those gates: production backup, migration, deploy, smoke test and rollback confirmation.

Production merge/deployment and APK/PWA release update remain blocked until explicit approval.
