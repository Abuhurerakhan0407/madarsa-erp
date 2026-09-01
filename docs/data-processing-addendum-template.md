# Data Processing Addendum Template

> Status: **UNAPPROVED TEMPLATE — requires seller/privacy/legal review before signature.** This template operationalizes existing product/security boundaries; it is not legal advice and does not by itself satisfy `retention_schedule_approved`, `tax_boundary_approved`, or any other launch gate.

This Data Processing Addendum (**DPA**) forms part of the Founding Pilot SaaS Agreement between the Provider and Institution where the Provider processes personal data for the Institution through Madrasa ERP.

## 1. Parties and role allocation

**Provider:** [SELLER / LEGAL ENTITY NAME]  
**Institution:** [MADRASA / INSTITUTION LEGAL NAME]

The parties expect, subject to final legal review and the facts of the deployment, that:

- the Institution determines the educational/administrative purposes for most student, parent, staff and operational data processed in Madrasa ERP and therefore carries the corresponding institution/controller/Data Fiduciary responsibilities under applicable law; and
- the Provider processes that data to host, operate, secure, support and maintain the contracted service on the Institution's documented instructions, functioning as a service provider/Data Processor to the applicable extent.

Nothing in this template overrides a legal role that applicable law assigns based on the actual facts.

## 2. Processing subject matter and duration

**Subject matter:** provision of the contracted Madrasa ERP modules and related onboarding, support, security, recovery and offboarding operations.

**Duration:** the Agreement term plus the approved export, retention and deletion period, subject to documented legal holds or other lawful retention requirements.

No indefinite post-contract retention is authorized merely because data existed in the system.

## 3. Categories of personal data

Depending on enabled modules, processing may include:

- student identity/profile/contact information;
- guardian/parent identity, relationship and contact information;
- admissions/application information;
- enrollment, class/group and academic information;
- attendance and correction records;
- Quran/Hifz progress, teacher notes and learning records;
- exams, marks, results and report-card information;
- generated document/certificate/ID metadata;
- staff identity, employment-core, attendance and leave information;
- portal/access, audit and security metadata;
- transport, hostel/mess and library operational records;
- WhatsApp consent/dispatch metadata where enabled;
- external device mapping/event metadata where the biometric/NFC bridge is used;
- support, incident and operational evidence;
- subscription/payment-provider event metadata where billing is later enabled.

Current product boundaries must remain explicit:

- the ERP does **not** store fingerprint or face biometric templates in its attendance-device bridge;
- full payment-provider payloads are not intentionally stored by the current Razorpay webhook runtime; minimal event metadata/digests are used;
- Fees/Accounting, payroll and donation/fund accounting are deferred and must not be treated as ordinary production processing scope unless later enabled by signed change.

## 4. Categories of data subjects

Data subjects may include:

- applicants/prospective students;
- enrolled/former students;
- parents, guardians and authorized contacts;
- teachers, employees, volunteers or other Institution staff;
- Institution administrators and portal users;
- visitors or other persons only where an enabled operational module legitimately requires their data.

Because many Institution users/data subjects may be children, the Institution must identify and satisfy the notices, authority/consent and child-data obligations applicable to its processing. The Provider will reasonably support the Institution's documented implementation requirements within the product scope.

## 5. Documented processing purposes

The Provider may process Institution personal data only as reasonably necessary to:

- provide enabled Madrasa ERP functionality;
- configure and onboard the Institution;
- perform agreed imports/exports;
- authenticate users and enforce authorized access;
- maintain tenant isolation and security controls;
- provide support and investigate incidents/defects;
- perform approved communications/integration operations;
- maintain auditability, service reliability and disaster-recovery controls;
- satisfy documented legal obligations applicable directly to the Provider;
- complete approved offboarding/export/deletion operations.

The Provider must not sell Institution personal data or use it for unrelated advertising.

## 6. Institution instructions and responsibilities

The Agreement, signed Order Form, this DPA and authorized support/configuration requests constitute the Institution's documented instructions.

The Institution is responsible for:

- ensuring its instructions and supplied data are lawful;
- determining what personal data should be entered/imported;
- identifying authorized users and roles;
- issuing required privacy notices and obtaining required permissions/consents where its role requires them;
- instructing the Provider on institution-specific retention/legal-hold requirements;
- reviewing exported/corrected data and role assignments;
- promptly requesting access revocation when users leave or roles change.

If the Provider reasonably believes an instruction creates a material security or legal risk, it may pause that instruction and ask for clarification rather than silently executing it.

## 7. Provider personnel and confidentiality

The Provider will restrict personal-data access to personnel/contractors who require it for the service and are subject to appropriate confidentiality obligations.

Privileged access should be used only for approved operational/support/security purposes and should follow the product's server-side/service-role boundaries and audit practices.

## 8. Security measures

The Provider maintains measures appropriate to the current product architecture, including:

- tenant-scoped data architecture;
- PostgreSQL row-level-security boundaries for browser-accessible tenant data;
- browser-role revocation for service-only/security-sensitive tables and functions;
- server-side privileged operations rather than exposing service-role credentials to clients;
- role/access administration and audit events;
- hashed device tokens rather than storing raw device secrets where implemented;
- idempotency/integrity controls for provider webhook processing;
- bounded webhook body processing and signature verification;
- CI quality gates including lint, typecheck, tests, production build and Desktop/Android E2E;
- documented recovery tooling and offboarding preflight;
- restricted Storage bucket access according to product policies.

The parties acknowledge that no system can guarantee absolute security and that third-party providers/hardware introduce their own security dependencies.

## 9. Security incidents

The Provider will maintain an incident/escalation process and will notify the Institution without undue delay after confirming a personal-data/security incident affecting Institution data where notification is reasonably required by the Agreement or applicable law.

Incident information should, as available, include:

- nature of the incident;
- affected systems/data categories;
- known impact;
- containment/remediation actions;
- recommended Institution actions;
- follow-up contact.

No fixed statutory notification period should be inserted here until final legal review confirms the applicable rule and commencement position.

## 10. Data-subject requests and corrections

Where a person seeks access, correction, erasure or another applicable data right from the Institution, the Provider will provide reasonable product/technical assistance for records within the service where the Institution is responsible for responding.

The Provider will not independently decide the validity of an Institution-controlled educational/employment record request unless applicable law directly requires it to do so.

Requests that conflict with documented legal holds, academic-record obligations, security evidence or another lawful retention requirement must be escalated before deletion.

## 11. Retention and deletion

The Provider will follow the **approved** retention/offboarding schedule selected in the Order Form/DPA schedule.

Until `retention_schedule_approved=true`, no generic 30/60/90/180-day proposal in repository documentation should be represented to the Institution as a binding deletion commitment.

The intended offboarding process is:

1. verify authorized request and cutover date;
2. provide the agreed export;
3. revoke/disable relevant access and integration credentials/jobs;
4. identify legal holds;
5. run the safe tenant-offboarding preflight;
6. execute approved deletion/anonymization only through a separately reviewed destructive workflow;
7. separately handle Storage object bytes;
8. verify completion and retain appropriate evidence.

Database backup evidence is not a substitute for Storage-object recovery/deletion.

## 12. Backups and recovery artifacts

Backups/recovery artifacts exist for service resilience and are not intended as permanent archives.

They must be rotated/deleted according to the approved retention schedule, subject to active incident/legal-hold needs. Restoration into an isolated environment for a recovery drill does not authorize unrelated use of Institution data.

The current launch gate `backup_restore_drill_passed` remains independent and requires real evidence; documentation alone is insufficient.

## 13. Subprocessors / third-party providers

The Provider may use subprocessors/infrastructure providers necessary to deliver enabled services. The final signed schedule should list each production provider that processes Institution personal data, its function and relevant location/contract link where appropriate.

### Initial subprocessor schedule — complete before signature

| Provider | Purpose | Data involved | Hosting/processing region or relevant location | Status |
| --- | --- | --- | --- | --- |
| Supabase | Database/Auth/Storage backend | Institution application data, user auth, stored objects | [CONFIRM CURRENT PROJECT/CONTRACT] | Production dependency |
| Vercel | Web application hosting/deployment | Application requests/log metadata as applicable | [CONFIRM CURRENT CONFIG/CONTRACT] | Production dependency |
| WhatsApp provider | Messaging | Only if real outbound integration is enabled | [PROVIDER NOT YET APPROVED] | External dependency |
| Razorpay | Payment/subscription events | Only when real merchant billing is enabled | [NOT YET VERIFIED] | External dependency |
| Biometric/NFC vendor | Physical attendance integration | Vendor-controlled device data; ERP bridge receives mapped events | [VENDOR NOT YET SELECTED] | External dependency |
| Other | | | | |

Do not mark an unselected provider as a production subprocessor.

## 14. New subprocessors

The final agreement should define how the Provider informs the Institution of a material new subprocessor and how legitimate data-protection objections are handled. Exact notice periods require commercial/legal approval.

## 15. International/cross-border processing

The Provider will not make unsupported claims that all processing is India-only unless every relevant production/subprocessor configuration is verified to support that statement.

Any required transfer safeguards, localization commitments or contractual restrictions must be inserted after reviewing the actual provider regions/contracts and applicable law.

## 16. Audit and assurance

The Provider will make reasonable existing security/architecture evidence available to the Institution without exposing secrets, other tenants' data, exploitable security detail or proprietary source code.

Where a customer requests a bespoke audit, penetration test, certification or on-site review beyond normal evidence, the parties may agree scope, confidentiality and reasonable cost separately.

## 17. Return/export of data

Export format(s), export window and responsibility for validating the export must be stated in the Order Form.

The Institution should download and verify its export before the approved deletion window expires. The Provider is not required to maintain a permanent post-termination hosted archive unless separately contracted and lawful.

## 18. Legal holds

A documented legal hold can pause ordinary deletion for the records/scope it covers. The hold record should identify authority, reason, scope, start date and release authority.

Legal hold must not become a blanket excuse for indefinite retention of unrelated tenant data.

## 19. Provider-generated service metadata

The Provider may retain minimal security, billing, audit or service-integrity metadata where independently necessary and lawful, subject to the approved retention schedule and data-minimization principles.

Where feasible after offboarding, identifiers should be deleted/anonymized when they are no longer required for legitimate evidence/security purposes.

## 20. DPA schedule — complete before signature

**Approved retention profile / custom schedule:** [REQUIRED]  
**Export window:** [REQUIRED]  
**Institution privacy contact:** [REQUIRED]  
**Provider privacy contact:** [REQUIRED]  
**Legal-hold authority:** [REQUIRED]  
**Approved subprocessors:** [REQUIRED]  
**Special-category / child-data instructions:** [REQUIRED IF APPLICABLE]  
**Approved cross-border/location commitments:** [REQUIRED / NONE]

## 21. Conflict and termination

If this DPA conflicts with the general Agreement on personal-data processing, the DPA controls for that processing.

The DPA terminates after the Provider completes the approved post-termination processing/export/deletion obligations, except provisions that by nature must survive (for example confidentiality or required evidence retention).

## 22. Signatures

### Provider

Name:  
Title:  
Entity:  
Date:  
Signature / accepted electronic record:

### Institution

Name:  
Title:  
Institution:  
Date:  
Signature / accepted electronic record:

---

## Launch-gate discipline

This template does not itself approve privacy roles, subprocessors, retention periods or legal wording. Do not set `retention_schedule_approved=true` until the required schedule and approver evidence are recorded, and do not claim a real Institution DPA exists until an authorized Institution has accepted it.