# Paid Founding Pilot Launch Control — 2026-09-02

> Purpose: distinguish a paid founding-pilot commercial launch from full General Availability (GA). This does **not** weaken or replace the 13 GA launch gates.

## Current state

- GA launch readiness: **9/13 gates complete** until the final audited recovery gate is merged and proven on `main`.
- GA blockers remain:
  - `security_advisors_clear`
  - `backup_restore_drill_passed`
  - `payment_webhooks_verified`
  - `pilot_institution_signed_off`
- Owner decision: remain on **Supabase Free** for now. Leaked-password protection therefore remains unavailable and the GA security gate stays open.
- Production application, approved pricing, tax boundary, retention profile, package/messaging, and support runbook are already complete.

## Stage 1 — Paid Pilot Sales

Status: **READY TO MARKET / QUOTE / PREPARE CONTRACT**, subject to real customer details and the review boundary below.

Allowed at this stage:
- market and demo Madrasa ERP truthfully;
- quote the approved Founding Pilot pricing;
- prepare a customer-specific Founding Pilot Agreement / Order Form / DPA;
- use the approved non-GST seller position;
- issue a manual non-GST invoice/receipt after the customer contract path is approved;
- accept payment manually after the customer contract path is approved;
- schedule onboarding;
- create a controlled pilot plan and implementation checklist.

Contract execution boundary:
- the Agreement and DPA templates explicitly require seller/owner and legal/privacy review before signature;
- do not remove those warnings or represent the templates as legally approved merely because pricing, tax, retention, and packaging are approved;
- once that required review is completed for the real institution, execute the Agreement / Order Form / DPA and retain the signed copies outside repository secrets.

Not allowed to claim:
- GA / fully launched status;
- Supabase leaked-password protection is enabled;
- Razorpay production subscriptions are verified;
- backup/restore recovery has been proven until the canonical recovery gate is closed from final evidence;
- a pilot institution has signed off before it actually has;
- deferred/preview/external capabilities are production-complete.

## Stage 2 — Real Client Data Activation

Status: **BLOCKED UNTIL THE FINAL AUDITED RECOVERY GATE IS CLOSED**.

The recovery workflow must retain evidence covering:

- encrypted logical backup creation;
- isolated database restore;
- measured RPO/RTO;
- Auth identity and managed-role recovery scope;
- current Storage applicability/configuration and real blob recovery once blobs exist;
- restored Next.js tenant/branch rendering;
- read-only operational module/API verification;
- access-boundary verification;
- no outbound provider side effects.

Until the canonical `backup_restore_drill_passed` gate is updated from that evidence, demos, quoting, contract preparation, manual-invoice preparation and implementation planning may proceed, but meaningful real production-data activation remains controlled/pending.

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
- when the owner upgrades to a plan supporting leaked-password protection, enable it, rerun the advisor and record evidence before closing the gate.

## Pilot completion vs pilot start

`pilot_institution_signed_off` is a **GA evidence gate**, not a prerequisite to begin selling the founding pilot.

For the first real institution:
1. complete the required seller/owner and legal/privacy review of the real customer documents;
2. execute the Founding Pilot Agreement / Order Form / DPA;
3. ensure the recovery gate is closed before meaningful real-data activation;
4. onboard the agreed workflows;
5. observe the pilot for the agreed period;
6. complete the institution acceptance/sign-off pack;
7. only then mark `pilot_institution_signed_off=true`.

## Truthful launch language for 2026-09-02

Approved positioning:

> **Madrasa ERP is open for a limited Founding Pilot with the first three institutions.**

Do not describe the product as generally available or fully production-certified until all GA gates pass.
