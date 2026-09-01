# Commercial approval record — 2026-09-01

Status: **APPROVED by product/commercial owner**

The owner explicitly approved decision bundle **A, B, C** on 2026-09-01.

## A — Founding Pilot pricing — APPROVED

Approved for the first 3 pilot institutions only:

- Small — up to 300 students: ₹999/month
- Growth — 301–1,000 students: ₹1,999/month
- Pro — 1,001–2,500 students: ₹2,999/month
- Enterprise — 2,500+ students: ₹3,999/month
- Annual pilot option: pay for 10 months, receive 12 months
- First 3 pilots: onboarding/data-import fee waived
- No lifetime/grandfathered pricing promise unless separately approved
- Post-pilot/public pricing must be reviewed from real deployment/support evidence

## B — Day-one package and messaging boundary — APPROVED

Approved as documented in `docs/commercial-offer-draft.md` and the founding-pilot agreement/order-form pack.

Included operational scope remains the current live ERP modules. The following limitations remain explicit and must not be overstated:

- AI Assistant: Preview only
- Fees/Accounting: deferred
- Payroll: deferred; HR core live
- Donation/fund accounting: deferred with Accounting
- Live GPS tracking: not proven
- Physical biometric/NFC deployment: external hardware/vendor required
- WhatsApp: runtime exists; real outbound needs provider credentials/sender/templates
- Razorpay: runtime exists; real provider verification still required
- Urdu/Arabic generated-PDF parity: incomplete

## C — Retention Profile A — APPROVED

Approved default operational retention profile:

- Offboarding export window: 30 days
- Operational logs: 90 days
- Recovery evidence/artifacts: 30 days
- Statutory, academic, admissions, attendance, generated-document and institution-governed records remain subject to institution-specific/legal requirements and must not be destructively purged merely from this default profile
- Legal holds override deletion
- Storage must be included in offboarding/recovery checks when objects exist
- Destructive deletion still requires the governed deletion workflow and must not bypass legal-hold/preflight controls

## Gate effect

This approval is sufficient evidence to mark these required launch gates complete:

- `pricing_approved`
- `messaging_packaging_approved`
- `retention_schedule_approved`

It does **not** approve or satisfy:

- `tax_boundary_approved`
- `security_advisors_clear`
- `backup_restore_drill_passed`
- `payment_webhooks_verified`
- `pilot_institution_signed_off`

No other launch gate may be changed from this approval record.
