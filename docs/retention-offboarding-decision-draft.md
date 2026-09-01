# Retention and offboarding decision draft

> Status: **UNAPPROVED decision draft**. This file prepares the `retention_schedule_approved` gate but does not satisfy or flip it.

## Purpose

Define a conservative, operationally usable retention/offboarding baseline for a Madrasa ERP tenant while preserving the need for owner/privacy/legal approval.

## Regulatory timing note

India's Digital Personal Data Protection Rules, 2025 use staged commencement. As of 2026-09-01, not every operational rule is yet in force. This draft therefore avoids claiming that one fixed statutory retention period applies to every Madrasa ERP record. The governing principle remains purpose limitation plus retention where needed for the specified purpose or another applicable legal requirement.

Official references:
- MeitY DPDP Rules 2025: https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa
- DPDP Act 2023: https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf

## Proposed operational schedule — requires approval

| Data class | Proposed active-tenant retention | Proposed post-offboarding handling | Notes |
| --- | --- | --- | --- |
| Student/person master records | While enrolled/actively required + institution-defined alumni period | Export to institution, then delete/anonymize after agreed offboarding window unless a documented legal hold applies | Avoid indefinite retention by default |
| Admissions/application records | Current admission cycle + institution-approved historical period | Export then delete/anonymize on schedule | Rejected/withdrawn applicants should not silently become permanent records |
| Enrollment/academic history | While needed for academic records and institution obligations | Preserve only the minimum agreed historical record; delete ancillary personal data that is no longer needed | Certificates/transcripts may justify longer historical retention |
| Attendance records | Active academic/administrative need + institution-approved history | Export then retain/delete according to approved institutional/legal need | Device raw events should have a shorter lifetime than final attendance records where feasible |
| Biometric/NFC bridge/device events | Short operational troubleshooting/audit window | Delete raw device-event evidence once no longer needed; preserve only normalized attendance/audit evidence required | Physical biometric templates are external/vendor-dependent and must have separate vendor policy |
| Quran/Hifz learning history | Active learning + approved historical academic period | Export/minimize after offboarding | Treat teacher notes/corrections as educational records |
| Exams/results/report cards | Institution-defined academic-record period | Export; retain only what is needed for legitimate historical verification | Generated document copies need not outlive authoritative result records |
| Generated IDs/certificates/documents | While active/useful + verification need | Revoke/archive verification metadata; delete redundant rendered copies on schedule | Keep issuance/audit metadata separately when justified |
| Parent/staff portal access/invitations | Until account/access purpose ends | Revoke immediately on offboarding/role termination; delete stale invites/tokens promptly | Access secrets/tokens should never be kept as historical records |
| HR core records | Employment period + institution/legal retention decision | Export then retain/delete per applicable employment/tax/labour requirements | Payroll is deferred; do not infer payroll statutory retention here |
| WhatsApp consent/queue/provider evidence | While messaging purpose and dispute/audit need remain | Export/minimize; remove provider payloads not needed for evidence | Real provider retention is governed separately by provider contract/policy |
| Subscription/webhook event metadata | Subscription lifecycle + dispute/accounting/security evidence period | Retain minimal event metadata/digests only for approved period | Full provider payloads are intentionally not stored by current webhook runtime |
| Support/incidents/security events | Operational/security investigation period | Anonymize or delete tenant/person identifiers when no longer needed | Preserve legal-hold/security evidence where documented |
| Recovery evidence/artifacts | Limited operational assurance window | Rotate/delete encrypted artifacts on approved schedule | A database backup is not a permanent archive |
| Uploaded Storage objects | Same purpose-based period as their linked record | Export then delete object bytes and dangling metadata | DB backup does not itself back up Storage object bytes |

## Proposed tenant offboarding workflow — requires approval

1. Record authorized offboarding request and effective date.
2. Freeze new tenant-originated changes at the agreed cutover point where operationally practical.
3. Export agreed tenant data and documents in documented formats.
4. Revoke user sessions, portal codes, service credentials and external integration access.
5. Disable WhatsApp/provider jobs, biometric/device ingress and scheduled tenant workflows.
6. Preserve only explicitly approved legal-hold/security evidence.
7. Start the approved deletion window for database records and Storage objects.
8. Delete/anonymize tenant data according to the approved schedule.
9. Verify no tenant-specific Storage objects or queued jobs remain.
10. Record deletion/offboarding evidence and authorized completion sign-off.

## Proposed deletion windows for owner decision

Choose one operating profile; do not silently apply either profile without approval.

### Profile A — fast/minimal retention
- Tenant export availability after offboarding: 30 days
- Operational logs and non-essential event evidence: 90 days
- Encrypted recovery artifacts: 30 days unless an active incident/legal hold exists
- Stale invitations/access codes: prompt expiry/revocation, not historical retention

### Profile B — conservative transition
- Tenant export availability after offboarding: 60 days
- Operational logs and non-essential event evidence: 180 days
- Encrypted recovery artifacts: 60 days unless an active incident/legal hold exists
- Stale invitations/access codes: prompt expiry/revocation, not historical retention

Academic, employment, tax, certificate and other legally/operationally required historical records must follow the institution's approved retention requirement rather than either generic window above.

## Required approval record

Before `retention_schedule_approved=true`, record:
- selected operating profile or modified periods;
- seller/operator privacy owner;
- institution/controller responsibility split;
- legal-hold authority;
- deletion/anonymization authority;
- backup/Storage deletion interaction;
- export format and offboarding window;
- date and approver.

No launch-readiness gate should change based on this draft alone.
