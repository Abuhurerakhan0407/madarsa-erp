# Tomorrow Commercial Launch Control — 2026-09-02

> Status: execution control sheet. It does not self-approve any launch gate.

## Current formal gate state

5/13 required launch gates are complete.

Complete:
- database_migrations_applied
- production_build_green
- critical_e2e_green
- production_deployment_current
- support_runbook_ready

Open:
- security_advisors_clear
- pricing_approved
- tax_boundary_approved
- retention_schedule_approved
- backup_restore_drill_passed
- payment_webhooks_verified
- messaging_packaging_approved
- pilot_institution_signed_off

## Fastest responsible path to launch

### 1. Pricing approval — owner action
Recommended Founding Pilot offer for the first 3 institutions only:
- up to 300 students: ₹999/month
- 301–1,000: ₹1,999/month
- 1,001–2,500: ₹2,999/month
- 2,500+: ₹3,999/month
- annual option: pay 10 months, receive 12 months
- onboarding/data-import fee waived for first 3 pilot institutions
- no lifetime/grandfathered public-price promise
- post-pilot repricing after real support/usage evidence

Minimum approval evidence: owner explicitly approves this ladder or records modifications and date.

### 2. Messaging/package approval — owner action
Recommended approval: use the day-one scope and explicit limitations in `docs/commercial-offer-draft.md` without expansion.

Important boundaries remain visible:
- AI Assistant = Preview
- Fees/Accounting deferred
- Payroll deferred
- Donation/fund accounting deferred
- no proven live GPS
- physical biometric/NFC deployment external
- WhatsApp real outbound provider-dependent
- Razorpay provider verification outstanding
- full Urdu/Arabic generated-PDF parity incomplete

Minimum approval evidence: owner explicitly approves package/positioning and date.

### 3. Retention approval — owner/privacy action
Recommended fast-launch operating choice: Profile A from `docs/retention-offboarding-decision-draft.md` for operational/non-essential data:
- offboarding export availability: 30 days
- operational logs/non-essential event evidence: 90 days
- encrypted recovery artifacts: 30 days unless incident/legal hold exists
- stale access/invites revoked promptly

Academic, employment, tax, certificate and other required historical records remain institution/legal-rule specific and are not silently forced into the generic window.

Minimum approval evidence: approve Profile A or record modified periods, privacy owner, legal-hold authority, deletion authority and export window.

### 4. Tax boundary — owner/finance action
Cannot be completed from engineering evidence alone.
Required facts:
- provider/seller legal name
- entity type
- business/registered address
- GST registration status / GSTIN if registered
- invoice email
- approved tax display convention
- place-of-supply/invoicing treatment
- refund/credit-note owner/process

Until approved, customer material must say only: "Taxes and applicable third-party charges are additional where applicable."

### 5. Supabase security — paid-plan decision
Current live advisor has one real WARN: leaked-password protection disabled.
Engineering hardening is otherwise complete for the audited surface.

Required action: upgrade/operate on a Supabase plan that supports leaked-password protection and enable it, then rerun the advisor and capture zero blocking WARN evidence.

### 6. Recovery drill — operations/credential action
Engineering automation and operator documentation exist.
Required GitHub Actions secrets:
- MADARSA_ERP_DATABASE_URL
- MADARSA_ERP_RECOVERY_PASSPHRASE

Then manually dispatch `.github/workflows/recovery-drill.yml`, retain evidence, and separately verify application/Storage recovery scope where applicable. Do not mark the gate complete from a dry run.

### 7. Razorpay verification — provider/credential action
Engineering webhook runtime is implemented and hardened.
Required production evidence:
- real Razorpay merchant/account configuration
- production webhook URL configured
- RAZORPAY_WEBHOOK_SECRET configured in production
- real signed supported event accepted
- exact duplicate event behaves idempotently
- conflicting same-event-ID payload is quarantined
- invalid signature rejected
- evidence recorded

### 8. Pilot institution sign-off — real customer action
Use:
- `docs/founding-pilot-agreement-template.md`
- `docs/founding-pilot-order-form-template.md`
- `docs/data-processing-addendum-template.md`
- `docs/founding-pilot-onboarding-runbook.md`
- `docs/pilot-institution-signoff-pack.md`

Required evidence is a real institution + authorized approver + completed workflow acceptance. Never fabricate this gate.

## Tomorrow order of operations

1. Owner approves pricing + package + retention choice.
2. Owner supplies seller/GST facts for tax decision.
3. Configure/upgrade Supabase security and rerun advisor.
4. Configure recovery secrets and run real drill.
5. Configure Razorpay webhook secret/account and run real provider verification.
6. Fill pilot Order Form for the first real institution.
7. Run onboarding/acceptance checklist and capture authorized sign-off.
8. Only then change the corresponding launch-readiness booleans with evidence links/records.
9. Rerun production health, CI/E2E if code/config changed, and verify production deployment SHA.

## Launch rule

Do not call the product fully commercially launched until all 13 required gates are complete. It is already suitable for demos and pilot sales conversations, but the remaining gates above require real approvals, credentials/provider evidence or customer acceptance rather than more speculative product development.
