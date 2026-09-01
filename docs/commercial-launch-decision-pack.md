# Commercial launch decision pack

This document keeps non-engineering launch gates decision-ready without self-approving them.

## Current required gates

Engineering/operations gates that remain open:

- `security_advisors_clear`
- `backup_restore_drill_passed`
- `payment_webhooks_verified`

Commercial/legal/product gates that remain open:

- `pricing_approved`
- `tax_boundary_approved`
- `retention_schedule_approved`
- `messaging_packaging_approved`
- `pilot_institution_signed_off`

Do not flip any gate based on this document alone.

## Working decision artifacts

The following files now reduce the remaining owner/provider work to explicit evidence/approval steps:

- `docs/commercial-offer-draft.md` — proposed pricing and day-one package, still unapproved.
- `docs/tax-gst-decision-worksheet.md` — seller/GST/place-of-supply/refund decision worksheet, still unapproved.
- `docs/retention-offboarding-decision-draft.md` — purpose-based retention/offboarding proposal, still unapproved.
- `docs/pilot-institution-signoff-pack.md` — real institution acceptance template; synthetic sign-off is prohibited.
- GitHub Issue #78 — single commercial approval checkpoint.

## Pricing approval

Approval must record:

- billing unit: institution / student / branch / plan;
- billing period: monthly / quarterly / annual;
- exact INR prices and GST treatment statement approved separately by finance/legal;
- included branches/users/students or usage limits;
- implementation/onboarding fee, if any;
- renewal rule;
- cancellation/refund rule;
- whether WhatsApp, biometric hardware, payment fees, custom development or migration are included or separately charged.

No price should be represented as approved until the commercial owner signs off.

## Tax boundary approval

Finance/legal must decide and record:

- seller/legal entity used on invoices;
- GST registration position and applicable tax treatment;
- place-of-supply/invoice requirements relevant to target clients;
- whether payment gateway charges/taxes are passed through;
- refund/credit-note handling;
- whether any deferred financial modules create accounting claims the product must avoid.

Engineering must not invent tax percentages, invoice compliance claims or ledger behavior.

## Retention schedule approval

Privacy/legal must define minimum retention/deletion rules for:

- student/person records;
- admissions/enrollment history;
- attendance and device-event evidence;
- generated documents/certificates;
- portal access/invitation records;
- operational audit logs;
- WhatsApp consent/queue/provider evidence;
- subscription webhook/provider-event metadata;
- support/incidents;
- recovery evidence/artifacts;
- uploaded Storage objects when used.

The policy must also specify deletion/anonymization authority, legal holds, backup retention interaction and tenant offboarding procedure.

## Messaging and packaging approval

Commercial copy must preserve these boundaries:

- AI Assistant: Preview, not a live AI provider integration;
- biometrics/NFC: ERP-side bridge is ready; physical device/vendor integration requires selected hardware;
- WhatsApp: ERP runtime is complete; real outbound provider delivery requires credentials/sender/templates;
- Razorpay: governed webhook runtime exists; real provider verification is still required;
- backups: recovery automation exists; full recovery gate is not passed until real DB + applicable Storage/application verification succeeds;
- HR core is live; payroll is deferred;
- Fees/Accounting are intentionally deferred;
- donation/fund accounting is deferred with Accounting;
- GPS/live vehicle tracking is not proven;
- generated Urdu/Arabic PDFs do not have full parity.

Approved packaging should explicitly state what a paying institution receives on day one and what is optional/external.

## Pilot institution sign-off

A real pilot sign-off should include:

- institution identity and authorized approver;
- production/approved pilot environment used;
- agreed enabled module scope;
- onboarding/import outcome;
- access/role verification;
- critical daily workflows exercised;
- known limitations accepted;
- support contact/process confirmed;
- sign-off date and unresolved blockers.

Never create a fake pilot identity or synthetic approval.

## Gate update discipline

When a decision is genuinely approved:

1. preserve the approval evidence outside secrets;
2. update only the corresponding launch gate;
3. add/adjust tests if repository contracts depend on the gate;
4. run the full required CI discipline;
5. merge only the exact tested head;
6. verify production catches up before calling the state live.
