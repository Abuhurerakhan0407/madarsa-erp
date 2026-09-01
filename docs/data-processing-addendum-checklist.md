# Data Processing Addendum Checklist — Draft

> **Status: UNAPPROVED CHECKLIST.** This is a preparation tool for the pilot/commercial agreement. It is not final legal advice and does not satisfy `retention_schedule_approved` or any other launch gate by itself.

## 1. Parties and roles

Complete before signature:

- Provider / processor legal name: [TO BE APPROVED]
- Provider address: [TO BE APPROVED]
- Provider privacy contact: [TO BE APPROVED]
- Institution / controller legal name: [PILOT INSTITUTION]
- Institution address: [ADDRESS]
- Institution privacy/authorized contact: [NAME / CONTACT]
- Confirm whether any processing activity changes the controller/processor allocation for a specific workflow.

## 2. Processing purpose

Document the specific service purposes actually enabled for the institution, such as admissions, student administration, attendance, Qur'an/Hifz learning records, exams/results, reports/documents, portals, HR core, library, hostel/mess, transport administration and authorized communications.

Do not expand the purpose statement to deferred or Preview-only functionality that is not actually enabled.

## 3. Categories of data

Confirm which categories the pilot will process:

- student/person identity and contact information
- guardian/family relationships and contact information
- admissions/application records
- enrollment and academic records
- attendance
- Qur'an/Hifz learning history
- exam/results/report-card records
- staff/HR core records
- library/hostel/mess/transport operational records
- portal/access metadata
- communications/consent/audit metadata
- uploaded documents/files
- support/security/recovery evidence

Physical biometric templates are not stored by the current ERP bridge and should not be listed as ERP-held data unless a future vendor integration changes that fact.

## 4. Data subjects

Identify applicable groups:

- students, including minors where applicable
- parents/guardians
- applicants
- staff/teachers
- institution administrators/operators
- authorized portal users
- other institution-defined contacts

## 5. Processing instructions

The agreement should define that the Provider processes tenant data only for documented service instructions, security/reliability obligations, authorized support, and other expressly agreed purposes.

Record how instructions are approved and how out-of-scope custom requests are handled.

## 6. Access and confidentiality

Confirm:

- role-based institution access
- least-privilege operator access
- support access/escalation procedure
- confidentiality expectations for personnel with authorized access
- credential-handling responsibilities
- no use of tenant data to train unrelated AI models unless separately and explicitly agreed

## 7. Security measures

Reference implemented controls rather than generic promises:

- tenant-scoped database controls/RLS architecture
- authenticated application access
- server-side governed operations/RPCs where applicable
- auditability and operational evidence
- secure provider-secret handling
- webhook signature verification
- role/access administration
- recovery tooling and incident procedures

Known limitation to disclose until resolved: Supabase leaked-password protection is currently not enabled on the Free plan; do not represent that control as active.

## 8. Subprocessors / external providers

Create an approved list for the actual pilot. Potential dependencies include:

- Supabase — database/auth/storage platform
- Vercel — application hosting/deployment
- Razorpay — only if payments/subscriptions are enabled and verified
- WhatsApp/messaging provider — only when real outbound is configured
- biometric/NFC hardware/vendor — only for physical-device deployment
- other expressly approved integrations

For each enabled provider record purpose, data categories, location/contract considerations where relevant, and replacement/change notification process.

## 9. Cross-border / location considerations

Do not make a blanket residency or international-transfer promise without verifying the actual provider configuration and applicable requirements. Record the live deployment/database region and any provider-specific data flows that matter to the approved pilot.

## 10. Retention and deletion

Adopt an approved schedule from `docs/retention-offboarding-decision-draft.md` or a reviewed modification.

Record:

- active-service retention basis
- offboarding/export window
- deletion/anonymization windows
- legal-hold authority
- Storage-object handling
- backup/recovery artifact handling
- stale access-code/token expiry
- event/log retention
- academic/HR records requiring institution-specific longer retention

The live `tenant_offboarding_preflight_v1` is a read-only inventory/safety check. It is not a destructive deletion executor.

## 11. Data export / return

Before commercial sign-off define:

- export request authority
- supported export formats
- expected preparation window
- treatment of uploaded Storage objects
- how final export completeness is verified
- whether export is available during a post-termination window

Do not promise an export format that the product does not currently generate.

## 12. Deletion verification

Deletion completion evidence should include, as applicable:

- legal-hold check
- database tenant inventory/preflight
- deletion/anonymization job evidence when implemented and approved
- Storage-object verification
- disabled external integration credentials/jobs
- revoked access/session/invitation paths
- authorized completion sign-off

## 13. Data-subject / institution requests

Define how the Provider routes and assists with valid institution-authorized requests concerning access, correction, deletion or other applicable rights. The institution/controller should remain the primary decision-maker for its own records unless law or the agreed role allocation requires otherwise.

## 14. Security incident process

Define:

- reporting channel
- severity/escalation criteria
- responsible contacts
- evidence preservation
- institution notification process
- remediation tracking

Do not invent statutory notification deadlines in this template; insert only after the applicable legal obligations and roles are reviewed.

## 15. Recovery and continuity

Reference actual evidence only. Recovery tooling exists, but `backup_restore_drill_passed` remains open until a real protected drill plus application/Storage verification is completed.

## 16. Audit / assurance

Define a reasonable evidence process for the institution, such as security architecture summary, access-control evidence, incident/support records, recovery evidence and relevant provider documentation, while protecting other tenants and platform secrets.

## 17. End of service

The approved offboarding flow should cover:

1. authorized termination/offboarding request;
2. cutover date;
3. export/return;
4. access revocation;
5. provider/integration shutdown;
6. legal-hold check;
7. approved deletion/anonymization schedule;
8. database + Storage verification;
9. completion evidence/sign-off.

## 18. Approval record

Before treating this as contract-ready, record:

- Provider legal entity and privacy contact
- Institution/controller legal entity and contact
- approved processing purposes
- actual subprocessor list
- approved retention schedule
- deletion/export procedure
- security incident contacts/process
- applicable governing-law/venue clauses from qualified review
- approval date and signatories

## Launch-readiness effect

This checklist reduces preparation work but does not itself mark any launch gate complete. In particular, `retention_schedule_approved`, `tax_boundary_approved`, `messaging_packaging_approved`, and `pilot_institution_signed_off` require separate approval/evidence.