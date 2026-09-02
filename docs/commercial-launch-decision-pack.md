# Commercial launch decision pack

This document keeps the current commercial launch state aligned with the canonical gate file and preserved approval evidence. It does not self-approve missing live-evidence gates.

## Current required gates

The canonical source of truth remains `config/launch-readiness.json`.

Approved/complete commercial and operational decisions already evidenced:

- `pricing_approved`
- `tax_boundary_approved`
- `retention_schedule_approved`
- `messaging_packaging_approved`
- `support_runbook_ready`

Separate live-evidence gates that remain open until their own proof exists:

- `security_advisors_clear`
- `backup_restore_drill_passed`
- `payment_webhooks_verified`
- `pilot_institution_signed_off`

Do not flip any gate based on this document alone.

## Preserved approval evidence

- `docs/commercial-approval-record-2026-09-01.md` — owner approval for Founding Pilot pricing, day-one packaging/messaging, and Retention Profile A.
- `docs/tax-boundary-decision-record-2026-09-01.md` — approved current non-GST seller/tax boundary.
- `docs/pilot-institution-signoff-pack.md` — real institution acceptance template; synthetic sign-off is prohibited.
- `docs/founding-pilot-agreement-template.md` — pilot SaaS terms template with product/external-provider boundaries; still requires the seller/owner and legal review stated in the template before signature.
- `docs/founding-pilot-order-form-template.md` — customer-specific scope, price, tax, support, retention and acceptance variables.
- `docs/data-processing-addendum-template.md` — processing-role/security/retention template; still requires the privacy/legal review stated in the template before signature.

Older proposal/worksheet documents may remain for history, but their `UNAPPROVED` labels do not reopen a decision that has a later explicit approval record. The approval records above control the current approved commercial state.

## Approved pricing boundary

Founding Pilot pricing is approved for the first three institutions only:

- up to 300 students: ₹999/month;
- 301–1,000: ₹1,999/month;
- 1,001–2,500: ₹2,999/month;
- 2,500+: ₹3,999/month;
- annual pilot option: pay 10 months, receive 12 months;
- first three pilots: onboarding/data-import fee waived;
- no lifetime/grandfathered public-price promise without separate approval.

## Approved tax boundary

The current approved seller boundary is the non-GST-registered sole-proprietor profile preserved in `docs/tax-boundary-decision-record-2026-09-01.md`.

Engineering and sales must not invent GST percentages, display a GSTIN, or describe a non-GST document as a GST tax invoice. The tax position must be reviewed if the seller's registration obligation or registration status changes.

## Approved retention boundary

Retention Profile A is approved for operational/non-essential data:

- offboarding export window: 30 days;
- operational logs: 90 days;
- recovery evidence/artifacts: 30 days unless an incident/legal hold requires longer;
- statutory, academic, admissions, attendance, generated-document and institution-governed records remain subject to applicable legal/institution requirements;
- legal holds override deletion;
- Storage must be included in offboarding/recovery checks when objects exist;
- destructive deletion must use the governed deletion workflow.

## Approved messaging and packaging boundary

Commercial copy must preserve these limits:

- AI Assistant: Preview, not a live AI-provider integration;
- biometrics/NFC: ERP-side bridge is ready; physical device/vendor integration requires selected hardware;
- WhatsApp: ERP runtime exists; real outbound delivery requires provider credentials/sender/templates;
- Razorpay: governed webhook runtime exists; real provider verification is still required;
- recovery: commercial recovery is complete only when the final verified recovery gate is closed from real evidence;
- HR core is live; payroll is deferred;
- Fees/Accounting are intentionally deferred;
- donation/fund accounting is deferred with Accounting;
- GPS/live vehicle tracking is not proven;
- generated Urdu/Arabic PDFs do not have full parity.

## Contract/DPA review boundary

Commercial approval of price, tax, retention, and packaging is not the same as legal approval of every contract clause.

Before a real institution signs:

1. fill only customer-specific factual variables;
2. preserve all disclosed product/provider limitations;
3. complete the seller/owner and legal/privacy review explicitly required by the Agreement and DPA templates;
4. do not remove legal-review warnings merely to make a document appear final;
5. preserve the executed customer documents outside repository secrets.

## Pilot institution sign-off

A real pilot sign-off must include:

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

When a remaining gate genuinely passes:

1. preserve its approval/live evidence without exposing secrets;
2. update only the corresponding launch gate;
3. add/adjust tests if repository contracts depend on the gate;
4. run the required CI discipline;
5. merge only the exact tested head;
6. verify production catches up before calling the state live.
