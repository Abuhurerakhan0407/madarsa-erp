# Paid Founding Pilot Launch Control — 2026-09-02

> Purpose: distinguish a paid founding-pilot commercial launch from full General Availability (GA). This does **not** weaken or replace the 13 GA launch gates.

## Current state

- GA launch readiness: **9/13 gates complete**.
- GA blockers remain:
  - `security_advisors_clear`
  - `backup_restore_drill_passed`
  - `payment_webhooks_verified`
  - `pilot_institution_signed_off`
- Owner decision: remain on **Supabase Free** for now because budget is unavailable. Leaked-password protection therefore remains unavailable and the GA security gate stays open.
- Production application, approved pricing, tax boundary, retention profile, package/messaging, and support runbook are already complete.

## Stage 1 — Paid Pilot Sales

Status: **READY TO SELL / CONTRACT**, subject to real customer details and acceptance.

Allowed at this stage:
- market and demo Madrasa ERP truthfully;
- quote the approved Founding Pilot pricing;
- issue the Founding Pilot Agreement / Order Form / DPA;
- use the approved non-GST seller position;
- issue a manual non-GST invoice/receipt;
- accept payment manually;
- schedule onboarding;
- create a controlled pilot plan and implementation checklist.

Not allowed to claim:
- GA / fully launched status;
- Supabase leaked-password protection is enabled;
- Razorpay production subscriptions are verified;
- backup/restore recovery has been proven;
- a pilot institution has signed off before it actually has;
- deferred/preview/external capabilities are production-complete.

## Stage 2 — Real Client Data Activation

Status: **BLOCKED ON REAL RECOVERY DRILL**.

Before importing or relying on meaningful real institution data, complete the existing recovery workflow and retain evidence:

- GitHub Actions secrets:
  - `MADARSA_ERP_DATABASE_URL`
  - `MADARSA_ERP_RECOVERY_PASSPHRASE`
- manually dispatch `.github/workflows/recovery-drill.yml`;
- verify encrypted backup creation;
- verify isolated restore succeeds;
- retain RPO/RTO/evidence artifacts;
- separately verify any Storage recovery scope once real tenant documents exist.

Until that is done, demos, contracting, manual invoicing and implementation planning may proceed, but real production-data activation should remain controlled/pending.

## Payments for the first pilot

Razorpay is **not required for Stage 1**.

Use manual invoicing/payment for founding pilots until provider verification is complete:
- seller issues a non-GST invoice/receipt using the approved tax boundary;
- payment instructions are supplied separately by the seller;
- no automatic debit or automatic-renewal claim;
- record amount, date, reference and institution manually;
- third-party/provider/hardware charges remain separate where applicable.

`payment_webhooks_verified` remains a GA blocker until a real Razorpay merchant configuration and signed webhook verification are completed.

## Security on Supabase Free

The owner has chosen to remain on Supabase Free temporarily.

Therefore:
- existing database/RLS/server-side hardening remains in force;
- the live security advisor still has one WARN: leaked-password protection disabled;
- do not mark `security_advisors_clear=true`;
- upgrade to a plan supporting leaked-password protection when budget becomes available, enable it, rerun the advisor and record evidence.

## Pilot completion vs pilot start

`pilot_institution_signed_off` is a **GA evidence gate**, not a prerequisite to begin selling the founding pilot.

For the first real institution:
1. sign the Founding Pilot Agreement / Order Form / DPA;
2. complete the recovery drill before meaningful real-data activation;
3. onboard the agreed workflows;
4. observe the pilot for the agreed period;
5. complete the institution acceptance/sign-off pack;
6. only then mark `pilot_institution_signed_off=true`.

## Truthful launch language for 2026-09-02

Approved positioning:

> **Madrasa ERP is open for a limited Founding Pilot with the first three institutions.**

Do not describe the product as generally available or fully production-certified until all GA gates pass.
