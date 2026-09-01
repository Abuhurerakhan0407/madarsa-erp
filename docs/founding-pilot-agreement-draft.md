# Founding Pilot Agreement — Draft

> **Status: UNAPPROVED TEMPLATE.** This is a commercial drafting aid for review by the seller/operator and, where appropriate, legal/tax counsel. It is not a representation that legal, tax, privacy, or launch-readiness approval has been completed.

## 1. Parties

**Provider / Seller:** [LEGAL NAME TO BE APPROVED]\
**Address:** [SELLER ADDRESS]\
**GSTIN / tax registration:** [TO BE CONFIRMED]\
**Institution:** [PILOT MADRASA / INSTITUTION LEGAL NAME]\
**Institution address:** [ADDRESS]\
**Authorized representative:** [NAME / TITLE]

## 2. Pilot purpose

The pilot is intended to validate Madarsa ERP in a real institution before broader commercial rollout. It is not an acceptance of any feature that is explicitly marked Preview, Deferred, Bridge-only, provider-dependent, or otherwise excluded below.

## 3. Founding Pilot commercial proposal

The currently proposed introductory monthly pricing is:

- up to 300 students — ₹999/month
- 301–1,000 students — ₹1,999/month
- 1,001–2,500 students — ₹2,999/month
- 2,500+ students — ₹3,999/month

Optional pilot annual offer: pay for 10 months, receive 12 months.

For the first 3 approved pilot institutions, onboarding/data-import charges may be waived if separately approved in writing.

**Important:** these are Founding Pilot prices only. They are not permanent public pricing and create no lifetime/grandfathered price commitment unless expressly written into the signed order form.

Third-party/provider charges are separate unless expressly included: WhatsApp/message-provider charges, Razorpay/payment-gateway fees, biometric/NFC hardware/vendor charges, custom integrations, domain costs, or other external services.

## 4. Day-one operational scope

Subject to final packaging approval, the pilot may include:

- Dashboard
- Admissions
- Students, guardians and placement
- Academics/timetable
- Student attendance
- ERP-side biometric/NFC attendance bridge
- Qur'an/Hifz
- Exams/results
- Reports and document workflows
- ID cards and student status certificates
- Parent/staff portals
- Student lifecycle, import, promotion and rollover
- Hostel & Mess
- Transport/routes ERP workspace
- Library
- HR & Staff core
- WhatsApp ERP runtime
- Access administration
- Configuration

## 5. Explicit exclusions and limitations

The institution acknowledges the following current boundaries:

- AI Assistant is Preview only; no production AI provider/model is committed.
- Fees/Accounting is deferred.
- Payroll is deferred.
- Donation/fund accounting is deferred with Accounting.
- Live GPS vehicle tracking is not proven or included unless separately contracted and verified.
- Physical biometric/NFC deployment depends on selected hardware/vendor and on-site integration.
- WhatsApp real outbound delivery requires an approved sender/provider/templates/credentials.
- Urdu/Arabic generated PDF parity is incomplete and must not be assumed.
- Razorpay subscription webhook engineering exists, but real provider verification remains a separate launch gate until completed.

## 6. Pilot term and acceptance

**Pilot start:** [DATE]\
**Pilot observation period:** proposed 7–14 days after production onboarding, subject to final agreement.\
**Pilot end / review:** [DATE]

Acceptance should use `docs/pilot-institution-signoff-pack.md` and record:

- authorized institution representative;
- workflows exercised;
- desktop/mobile verification;
- known limitations accepted;
- blockers and remediation commitments;
- explicit sign-off outcome.

No pilot sign-off should be recorded solely because the application is deployed.

## 7. Data onboarding

The institution is responsible for confirming that data supplied for import is authorized, accurate enough for the intended use, and legally permitted to be processed by the Provider for the agreed service.

The Provider should use controlled imports, sample verification, and tenant-scoped validation before completing a full production import.

## 8. Security and access

- Access is role/permission controlled.
- The service uses Supabase/Postgres tenant-scoped controls, authenticated application access, and auditable server-side operations.
- Known external security dependencies or paid-plan features are not represented as complete until actually enabled and evidenced.
- Institution administrators are responsible for timely user-access changes and for protecting their own credentials.

## 9. Privacy, data processing and retention

The parties must approve the controller/processor responsibilities, authorized processing purposes, contact details, subprocessors/provider boundaries, retention/offboarding schedule, legal-hold authority, and deletion/export procedure before treating the privacy/legal launch boundary as complete.

See:

- `docs/data-processing-addendum-checklist.md`
- `docs/retention-offboarding-decision-draft.md`
- `docs/tenant-offboarding-preflight.md`

The current tenant-offboarding preflight is read-only; destructive deletion is intentionally not enabled until the approved policy and authority are in place.

## 10. Backups and recovery

Database-recovery tooling exists, but the production recovery gate is not complete until a real protected recovery drill is executed and application/Storage scope is separately verified. No stronger recovery promise should be inserted into a client agreement before that evidence exists.

## 11. Payments and taxes

Final invoicing entity, GST registration/treatment, place-of-supply handling, invoice fields and tax responsibility must be approved before commercial invoicing. See `docs/tax-gst-decision-worksheet.md`.

Prices in this draft should therefore be treated as **tax-exclusive or tax-treatment-pending** until the seller/tax position is finalized in writing.

## 12. Support and escalation

Support channels, response expectations, critical-incident escalation, maintenance windows and institution contacts should be copied from the approved support runbook/order form rather than invented per client.

## 13. Third-party services

Where the pilot uses external providers (for example Supabase, Vercel, Razorpay, WhatsApp providers, biometric/NFC vendors), their availability, fees, policies and technical limits may apply. The Provider should disclose the relevant dependency when it materially affects the agreed workflow.

## 14. Change control

Any feature outside the agreed pilot scope—especially Accounting, Payroll, real GPS, custom hardware integrations or other custom development—requires written scope, timeline and commercial approval before it becomes a delivery commitment.

## 15. Exit / offboarding

On pilot termination or service exit, follow the approved retention/offboarding workflow, including authorized export, access revocation, provider-job shutdown, legal-hold checks, database/Storage handling and completion evidence.

## 16. Approval block

This template must not be signed in its placeholder state.

**Provider legal name:** ____________________\
**Authorized signatory:** ____________________\
**Date:** ____________________

**Institution legal name:** ____________________\
**Authorized signatory:** ____________________\
**Date:** ____________________

## Launch-readiness effect

Creating or reviewing this draft does **not** mark `pricing_approved`, `tax_boundary_approved`, `retention_schedule_approved`, `messaging_packaging_approved`, or `pilot_institution_signed_off` complete. Those gates require the specific approvals/evidence defined in `config/launch-readiness.json`.