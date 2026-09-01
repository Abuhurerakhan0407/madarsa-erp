# Tomorrow Commercial Launch Control — 2026-09-02

> Status: execution control sheet. It distinguishes Paid Founding Pilot launch from full General Availability (GA) and does not self-approve missing GA evidence.

## Current GA gate state

**9/13 required GA gates are complete.**

Complete:
- database_migrations_applied
- production_build_green
- critical_e2e_green
- production_deployment_current
- pricing_approved
- tax_boundary_approved
- retention_schedule_approved
- messaging_packaging_approved
- support_runbook_ready

Open:
- security_advisors_clear
- backup_restore_drill_passed
- payment_webhooks_verified
- pilot_institution_signed_off

## Commercial launch decision for 2026-09-02

Madrasa ERP may open a **limited Paid Founding Pilot** for the first three institutions.

This means we may:
- market and demo the product truthfully;
- quote the approved founding-pilot pricing;
- sign the pilot Agreement / Order Form / DPA;
- issue a manual non-GST invoice/receipt;
- accept manual payment;
- schedule onboarding and implementation.

Do **not** call the product GA or fully production-certified yet.

Meaningful real-client production-data activation remains blocked until the recovery drill is completed.

See `docs/paid-founding-pilot-launch-control.md`.

## Approved commercial baseline

### Pricing
Founding Pilot pricing for the first 3 institutions only:
- up to 300 students: ₹999/month
- 301–1,000: ₹1,999/month
- 1,001–2,500: ₹2,999/month
- 2,500+: ₹3,999/month
- annual option: pay 10 months, receive 12 months
- onboarding/data-import fee waived for first 3 pilot institutions
- no lifetime/grandfathered public-price promise

### Package boundary
Approved day-one package retains these explicit limitations:
- AI Assistant = Preview
- Fees/Accounting deferred
- Payroll deferred
- Donation/fund accounting deferred
- no proven live GPS
- physical biometric/NFC deployment external
- WhatsApp real outbound provider-dependent
- Razorpay provider verification outstanding
- full Urdu/Arabic generated-PDF parity incomplete

### Retention
Approved Profile A for operational/non-essential data:
- offboarding export availability: 30 days
- operational logs/non-essential event evidence: 90 days
- encrypted recovery artifacts: 30 days unless incident/legal hold exists
- institution/legal-rule-specific records are not silently forced into the generic window

### Seller / tax boundary
Approved seller profile:
- Seller/legal name: Abu hurera khan
- Trade name: Madrasa ERP
- Entity type: Sole Proprietorship
- GST status: Not GST registered
- Business address: rm no 2 mahavir bldg no 2 opp p and t colony vakola Santacruz East Mumbai
- Invoice email: abuhurerak8@gmail.com
- Owner confirmed aggregate annual PAN-based business turnover is below ₹20 lakh on 2026-09-01

Current launch rule:
- do not charge/display GST while unregistered and otherwise legally eligible;
- do not display a GSTIN;
- do not label the document a GST tax invoice;
- review GST status promptly if registration becomes mandatory or the seller registers voluntarily.

## Remaining GA blockers

### 1. Supabase security
Owner decision: remain on **Supabase Free** temporarily because budget is unavailable.

Current live advisor has one real WARN: leaked-password protection disabled.
Engineering hardening is otherwise complete for the audited surface.

Action when budget becomes available:
1. upgrade to a plan supporting leaked-password protection;
2. enable the feature;
3. rerun the security advisor;
4. capture zero-blocking-WARN evidence;
5. only then set `security_advisors_clear=true`.

### 2. Recovery drill
Engineering automation and operator documentation exist.
Required GitHub Actions secrets:
- `MADARSA_ERP_DATABASE_URL`
- `MADARSA_ERP_RECOVERY_PASSPHRASE`

Then manually dispatch `.github/workflows/recovery-drill.yml`, retain encrypted backup/restore evidence and separately verify Storage recovery scope once applicable.

**This is the priority operational blocker before meaningful real-client production data is activated.**

### 3. Razorpay verification
Not required for Paid Founding Pilot sales if manual invoicing/payment is used.

It remains a GA blocker until real provider evidence exists:
- merchant/account configured;
- production webhook URL and secret configured;
- real signed supported event accepted;
- exact duplicate behaves idempotently;
- conflicting same-event-ID payload is quarantined;
- invalid signature rejected.

### 4. Pilot institution sign-off
Not required to **start** a pilot; it is evidence produced after a real pilot has been delivered and accepted.

For the first institution:
1. execute Agreement / Order Form / DPA;
2. complete recovery drill before meaningful production-data activation;
3. onboard agreed workflows;
4. observe for the agreed period;
5. capture authorized institution acceptance;
6. only then set `pilot_institution_signed_off=true`.

## Tomorrow order of operations

1. Begin Paid Founding Pilot outreach/sales using the approved package and pricing.
2. For the first willing institution, fill the customer-specific Order Form and DPA.
3. Use manual non-GST invoicing/payment; do not promise auto-renew or verified Razorpay billing.
4. Configure the two recovery-workflow secrets and run the real recovery drill before meaningful production-data activation.
5. Start controlled pilot onboarding after the recovery evidence is retained.
6. Capture pilot acceptance after the agreed observation period.
7. Upgrade Supabase security and verify Razorpay when budget/provider access becomes available.
8. Maintain the GA gate file separately; do not flip any remaining gate without evidence.

## Launch language

Approved wording:

> **Madrasa ERP is open for a limited Founding Pilot with the first three institutions.**

Do not describe it as generally available until all 13 GA gates pass.
