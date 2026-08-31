# Madarsa ERP Support Runbook

## Purpose

This runbook is the operator guide for supporting a real Madarsa ERP tenant. It covers triage, evidence collection, safe recovery, escalation, and the boundaries of features that are not yet commercially activated.

## Source of truth

Use these systems in this order when determining current state:

1. GitHub `main` and the exact deployed commit SHA.
2. Vercel deployment state, build logs, and runtime logs.
3. The tenant's Supabase project and applied migrations.
4. Application audit events and governed operational records.
5. This runbook and product documentation.

Never treat a scripted demo screen, memory, or an old handover as proof that a feature is live.

## Severity levels

- **SEV-1 — Critical:** authentication unavailable for most users, data corruption/loss suspected, cross-tenant exposure, or core production unavailable.
- **SEV-2 — High:** a major governed workflow is unusable for a tenant with no practical workaround.
- **SEV-3 — Medium:** degraded workflow, isolated error, incorrect UI state, or a workaround exists.
- **SEV-4 — Low:** cosmetic defect, copy issue, feature question, or enhancement request.

## First response checklist

For every incident:

1. Record tenant, branch, user role, page/API path, local time, and exact user action.
2. Capture the visible error without asking for passwords, OTPs, raw biometric material, provider secrets, or sensitive student documents unless the approved support process explicitly requires them.
3. Check whether the issue is production-only or reproducible on the exact tested preview/current `main` tree.
4. Confirm the canonical production deployment SHA before diagnosing a newly merged feature.
5. Check Vercel runtime errors/logs and Supabase health before changing data.
6. Prefer read-only inspection first. Do not repair by manually editing governed business tables unless an approved recovery procedure explicitly requires it.
7. Record the resolution or escalation outcome.

## Deployment incident procedure

1. Compare GitHub `main` SHA with the Vercel production deployment `githubCommitSha`.
2. If they differ, do not describe new code as production-live.
3. Inspect the GitHub Vercel commit status and Vercel deployment history.
4. If preview builds are green but production is stale, treat this as a deployment/promotion issue rather than an application build failure.
5. Do not create an unrelated manual Vercel deployment from an unknown local project context.
6. After production catches up, verify the canonical URL and the affected route before closing the incident.

## Authentication and access

- Never request or store user passwords in support notes.
- Membership, role, permission, and branch-scope changes must go through governed access-administration workflows.
- System roles are not edited through the custom-role workflow.
- The current administrator's own branch scope is protected from self-lockout in the access workspace.
- Escalate suspected cross-tenant access immediately as SEV-1.

## Student, admissions, attendance, exams, and documents

- Prefer application workflows and their audit trails over direct table changes.
- Duplicate student creation must remain blocked for review rather than forcing a second person record.
- Attendance corrections must preserve source/history rather than overwrite evidence silently.
- Generated documents and certificates should be treated as versioned/issued records where the runtime supports revision or superseding.
- The current dependency-free PDF renderer is English/Latin display safe; do not promise generated Urdu/Arabic PDF parity until a Unicode-capable renderer is implemented and tested.

## Parent and staff portals

- Verify relationship/identity scope before treating missing portal data as a rendering bug.
- Do not broaden a portal user's access to solve a data-visibility complaint.
- Confirm whether the issue affects institution-operator auth or the separate self-service portal boundary.

## WhatsApp automation boundary

The ERP-side notification runtime is implemented, but real outbound WhatsApp delivery requires an approved provider account, sender/template configuration, consent, and deployment secrets.

- A blocked dispatch due to missing opt-in or provider configuration is an expected safety state, not a delivery defect.
- Never invent consent or mark an unverified destination as opted in.
- Never paste provider secrets into tickets or audit notes.

## Attendance device boundary

The ERP-side biometric/NFC bridge stores device/event mappings and attendance evidence; it does not store raw fingerprint/face templates.

- Never upload raw biometric templates, fingerprint images, or face embeddings into ERP support tools.
- Physical scanner/vendor connectivity is only considered live after the selected device adapter has been tested against the deployed environment.

## Finance, payroll, donations, and sponsorships

Fees & Accounting are intentionally not commercially activated yet. Payroll posting and donation/fund operations depend on that accounting foundation.

- Do not create fake chart-of-account, journal, payment, payroll, fund, receipt, or tax state to make a demo look complete.
- Escalate requests for financial activation to the finance/legal + engineering launch process.
- Tax treatment must not be represented as approved until the tax-boundary launch gate is signed off.

## AI Assistant boundary

The navigation labels the AI Assistant as **Preview** until a real model provider/runtime, permission-aware retrieval boundary, logging policy, and production secret are configured and tested.

- Do not present scripted AI metrics as operational evidence.
- Do not send sensitive tenant data to an unapproved model provider.

## Data recovery and restore drills

A restore drill is not considered passed merely because backup/restore tables exist.

To close the restore gate, operations must have:

1. Real backup evidence with provider reference and completion state.
2. A non-production restore target or approved restore mechanism.
3. Measured RPO/RTO.
4. Database verification and, where applicable, storage/application verification.
5. Findings recorded and any material issue resolved or accepted.

Never fabricate `backup_evidence` or `restore_drills` rows.

## Security review

Before commercial launch:

- Review Supabase security advisors after schema changes.
- Resolve material warnings or explicitly document why an informational finding is intentional.
- Enable compromised/leaked-password protection in Supabase Auth before calling the security-advisors launch gate complete.
- Verify no production secrets are committed to GitHub.
- Keep privileged operational RPCs service-role-only unless a reviewed RLS/authenticated access design explicitly allows otherwise.

## Incident communications

For SEV-1/SEV-2, communicate only verified facts:

- what is affected;
- when it began or was detected;
- whether data integrity/confidentiality is at risk;
- the current mitigation;
- the next required decision, if any.

Do not provide speculative root causes as facts.

## Closure checklist

An incident is closed only when:

- the affected workflow is verified in the correct environment;
- no known data-integrity issue remains;
- any temporary workaround is documented;
- audit/evidence records are preserved where applicable;
- follow-up engineering, security, provider, or commercial work is captured.

## Current commercial-launch external dependencies

These are not support defects and should remain explicit until activated:

- Vercel production must deploy the current tested `main` tree.
- Supabase leaked-password protection must be enabled.
- Fees & Accounting activation requires approved financial/tax setup.
- Donation and payroll financial flows depend on Accounting.
- Real WhatsApp delivery requires provider/sender/template/secret setup.
- Physical biometric/NFC operation requires the chosen vendor/device adapter.
- AI Assistant requires an approved model provider/runtime and secret.
- A real backup/restore drill must be completed and evidenced.
