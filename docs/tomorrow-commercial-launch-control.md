# Commercial Launch Control — 2026-09-02

> Status: execution control sheet. It distinguishes Paid Founding Pilot launch from full General Availability (GA) and does not self-approve missing GA evidence.

## Current GA gate state

**9/13 required GA gates are complete** until the final audited recovery proof is merged to `main`, rerun, and the canonical gate is updated.

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
- prepare customer-specific Agreement / Order Form / DPA documents;
- issue a manual non-GST invoice/receipt and accept manual payment once the real customer contract path has completed its required seller/owner and legal/privacy review;
- schedule onboarding and implementation.

Do **not** call the product GA or fully production-certified yet.

The Agreement and DPA templates remain explicitly subject to the seller/owner and legal/privacy review stated in those templates. Commercial approval of price, tax, retention, and packaging does not self-approve every contract clause.

Meaningful real-client production-data activation remains blocked until the canonical recovery gate is closed from final audited recovery evidence.

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
The approved current seller/tax boundary is recorded in `docs/tax-boundary-decision-record-2026-09-01.md`.

Current launch rule:
- do not charge/display GST while unregistered and otherwise legally eligible;
- do not display a GSTIN;
- do not label the document a GST tax invoice;
- review GST status promptly if registration becomes mandatory or the seller registers voluntarily.

## Remaining GA blockers

### 1. Supabase security
Owner decision: remain on **Supabase Free** temporarily.

Current live advisor has one material WARN: leaked-password protection disabled.

Action when the owner upgrades:
1. enable leaked-password protection;
2. rerun the security advisor;
3. capture zero-blocking-WARN evidence;
4. only then set `security_advisors_clear=true`.

### 2. Recovery drill
A base end-to-end recovery run has already passed on `main`. The deep audit then strengthened the standard to require restored operational module/API reads and access-boundary evidence in the same isolated run.

Before closing the gate:
1. merge the patched/audited recovery implementation only after full CI and preview verification;
2. rerun the recovery workflow on the exact new `main` SHA;
3. inspect the resulting encrypted backup and recovery-evidence artifacts;
4. update `backup_restore_drill_passed=true` only if the final evidence passes every required scope;
5. verify the resulting production deployment.

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
1. complete required seller/owner and legal/privacy review of the customer documents;
2. execute Agreement / Order Form / DPA;
3. ensure the recovery gate is closed before meaningful production-data activation;
4. onboard agreed workflows;
5. observe for the agreed period;
6. capture authorized institution acceptance;
7. only then set `pilot_institution_signed_off=true`.

## Current order of operations

1. Finish the Next.js security patch + audited recovery implementation.
2. Run full CI, E2E and Vercel preview verification.
3. Merge only the exact tested head.
4. Rerun audited recovery on `main` and close only the recovery gate from the final evidence.
5. Verify production health and reconcile launch documentation/issue state.
6. Begin/continue Paid Founding Pilot outreach using the approved pricing/package language.
7. For the first willing institution, prepare customer-specific documents and complete the required review before signature.
8. Use manual non-GST invoicing/payment; do not promise auto-renew or verified Razorpay billing.
9. Start controlled pilot onboarding after recovery closure.
10. Capture pilot acceptance after the agreed observation period.
11. Upgrade Supabase security and verify Razorpay when the owner provides those dependencies.

## Launch language

Approved wording:

> **Madrasa ERP is open for a limited Founding Pilot with the first three institutions.**

Do not describe it as generally available until all 13 GA gates pass.
