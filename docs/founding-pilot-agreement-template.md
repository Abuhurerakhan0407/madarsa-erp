# Founding Pilot SaaS Agreement Template

> Status: **UNAPPROVED TEMPLATE — requires seller/owner and legal review before signature.** This document is operational preparation only. It does not approve pricing, tax, retention, messaging, payment-provider, or pilot launch gates.

## 1. Parties and order of documents

This Founding Pilot SaaS Agreement (the **Agreement**) is between:

- **Provider:** [SELLER / LEGAL ENTITY NAME], [ENTITY TYPE], of [REGISTERED ADDRESS] (**Provider**); and
- **Institution:** [MADRASA / INSTITUTION LEGAL NAME], of [ADDRESS] (**Institution**).

The commercial relationship consists of:

1. the signed Order Form;
2. this Agreement;
3. the Data Processing Addendum (DPA), where personal data is processed;
4. any signed implementation statement or approved change order.

If documents conflict, the Order Form controls commercial variables, the DPA controls personal-data processing, and this Agreement controls the general service terms.

## 2. Pilot purpose

The pilot is intended to let the Institution use the agreed Madrasa ERP modules in a controlled production/pilot environment, validate daily workflows, complete onboarding, and record acceptance or blockers before wider rollout.

A pilot is not evidence that every roadmap, preview, external-provider, hardware, or deferred module is production-ready.

## 3. Service scope

Only modules marked **Enabled** in the Order Form are included.

Possible day-one operational modules include:

- Dashboard;
- Admissions;
- Students, guardians and placement;
- Academics/timetable;
- Attendance;
- ERP-side biometric/NFC bridge;
- Quran/Hifz;
- Exams/results;
- Reports and documents, ID cards and status certificates;
- Parent and staff portals;
- Student lifecycle/import/promotion/rollover;
- Hostel & Mess;
- Transport/routes ERP-side;
- Library;
- HR & Staff core;
- WhatsApp ERP runtime;
- Access administration;
- Configuration.

The Institution must not treat an unmarked module, preview feature, mock/demo route, schema-only capability, or external-provider dependency as included production functionality.

## 4. Disclosed launch limitations

Unless a later signed Order Form expressly says otherwise, the following boundaries apply:

- AI Assistant is **Preview only**; no production AI provider/model is included.
- Fees/Accounting are **deferred**.
- Payroll is **deferred** while HR core is available.
- Donation/fund accounting is **deferred with Accounting**.
- WhatsApp outbound delivery requires separately approved provider credentials, sender registration and templates.
- Physical biometric/NFC deployment requires separately selected hardware/vendor and on-site/vendor setup where applicable.
- Live GPS/vehicle tracking is not represented as proven production functionality.
- Full Urdu/Arabic generated-PDF parity is incomplete.
- Payment-gateway/Razorpay subscription processing is not represented as production-verified until the real merchant/webhook verification gate is completed.

These limitations must be shown to the Institution before sign-off and recorded in the pilot sign-off pack.

## 5. Implementation and onboarding

Unless modified in the Order Form, the founding pilot includes:

- initial tenant setup;
- agreed system configuration;
- one structured data-import/onboarding pass using a supported format;
- administrator orientation;
- reasonable launch support for the agreed modules.

The Institution is responsible for supplying accurate source data, identifying authorized contacts, validating sample records, and promptly reporting migration discrepancies.

Major data cleanup, bespoke migrations, custom integrations, physical hardware installation, new modules, or materially custom workflows require a separate written quote/change order.

## 6. Institution responsibilities

The Institution will:

- provide only data it is authorized to process;
- keep user and administrator access limited to authorized persons;
- review role/access assignments;
- protect passwords, codes and connected-provider credentials;
- designate an authorized operational contact;
- test agreed workflows during the pilot;
- notify the Provider promptly of suspected security incidents or incorrect access;
- comply with applicable institutional, employment, education, tax and privacy obligations for its use of the service.

The Institution remains responsible for decisions made from its records and for obtaining any consents or notices it is legally responsible to obtain from students, parents, staff or other data subjects.

## 7. Provider responsibilities

The Provider will use reasonable efforts to:

- host and operate the agreed service;
- maintain tenant/access controls and the documented security architecture;
- provide the support/escalation path described in the current support runbook;
- preserve disclosed feature boundaries;
- investigate reproducible service defects;
- handle personal data according to the DPA and approved retention/offboarding rules;
- not fabricate or silently enable deferred/external functionality.

## 8. Availability, support and maintenance

No service-level guarantee applies unless the Order Form specifies one.

The Provider may perform maintenance, security fixes and compatible product updates. Emergency maintenance may occur without advance notice where reasonably required to protect the service or customer data.

Support channels, support hours, target response expectations and escalation contacts must be listed in the Order Form or support schedule.

## 9. Fees, taxes and third-party charges

Fees, billing frequency, pilot pricing, discounts, renewal rules and onboarding fees are stated only in the signed Order Form.

Until the tax boundary is formally approved, the Order Form must not make unsupported statements such as “GST included” or “+18% GST.” Taxes are handled according to the approved seller/GST position.

Unless expressly included, the Institution bears separately quoted or pass-through costs for:

- payment gateway charges;
- WhatsApp/provider usage;
- biometric/NFC hardware and vendor services;
- other third-party integrations or infrastructure specifically requested by the Institution.

## 10. Payment, suspension and refunds

The Order Form must state:

- amount and due date;
- billing cycle;
- payment method;
- approved tax display convention;
- grace period, if any;
- suspension rules;
- refund/cancellation treatment;
- renewal/expiry behavior.

The Provider should not suspend access for a disputed amount without following the agreed escalation/grace process, except where continued use creates a material security, abuse or legal risk.

## 11. Data ownership and processing

As between the parties, the Institution retains ownership/control of the Institution data it supplies, subject to applicable law and third-party rights.

The Provider may process Institution data only to operate, secure, support and improve the contracted service within the DPA and documented purposes. The Provider must not sell Institution data or use it for unrelated advertising.

Operational metadata may be used in appropriately minimized/aggregated form for security, reliability and product operations where permitted by the DPA and applicable law.

## 12. Security and access

The parties acknowledge that no internet service can guarantee absolute security.

The Provider maintains documented tenant isolation, access controls, auditability and secure server-side privileged operations. External-provider and hardware security remains partly dependent on those providers/vendors and the Institution's configuration.

The Institution must notify the Provider promptly if credentials are compromised, staff access should be revoked, or an unauthorized user is suspected.

## 13. Confidentiality

Each party will protect the other party's non-public business, technical and personal information with reasonable care and will use it only for this relationship, except where disclosure is required by law or authorized in writing.

Confidentiality does not cover information that is public without breach, independently developed without use of confidential information, or lawfully received from another source without confidentiality duty.

## 14. Intellectual property

The Provider retains all rights in the Madrasa ERP software, platform design, source code, documentation and general reusable know-how, excluding Institution data and Institution-owned materials.

No source-code ownership or exclusive software license transfers unless expressly agreed in writing.

Institution-specific exports remain usable by the Institution subject to third-party rights and applicable law.

## 15. Third-party services

The service may rely on third-party infrastructure/providers, including hosting/database, payment, communications or hardware vendors. Enabled third-party integrations must be identified in the Order Form/DPA where relevant.

A third-party outage or policy change may affect dependent functionality. The Provider remains responsible for reasonable integration management but cannot promise control over an independent provider's network/service.

## 16. Pilot acceptance

The pilot is accepted only through the real `pilot-institution-signoff-pack` process or another written acceptance record signed/approved by an authorized Institution representative.

Open issues must be categorized as:

- launch-blocking;
- accepted limitation;
- post-pilot enhancement; or
- external/provider dependency.

Internal tests, demo screenshots, synthetic users or Provider-only sign-off do not constitute Institution acceptance.

## 17. Term and termination

The pilot term and any paid subscription term are stated in the Order Form.

Either party may terminate for material breach if the breach is not cured within the written cure period in the Order Form, unless immediate termination is reasonably required for fraud, security abuse, unlawful use or serious confidentiality/privacy breach.

The Order Form must state any convenience cancellation right for the founding pilot.

## 18. Offboarding and data return

On termination/offboarding:

1. authorized Institution access is restricted according to the agreed cutover;
2. the Provider makes the agreed export available for the approved export window;
3. integrations, provider jobs and access credentials are disabled as applicable;
4. legal holds are respected;
5. data is deleted/anonymized according to the **approved** retention/offboarding schedule;
6. Storage objects are handled separately from database backups;
7. completion evidence is recorded when the approved deletion workflow is executed.

No destructive offboarding period becomes binding until the retention schedule is approved and reflected in the Order Form/DPA.

## 19. Warranties and disclaimers

Each party warrants it has authority to enter the Agreement.

The Provider warrants that it will provide the service materially in accordance with the signed scope and disclosed limitations using reasonable skill and care.

Except where law does not permit exclusion, the service is not warranted to be uninterrupted, error-free, suitable for every institutional process, or a substitute for professional legal, tax, accounting, educational or safety advice.

## 20. Liability — requires legal approval

**Do not sign this section until the seller/legal reviewer selects the final liability structure.**

Proposed negotiation baseline:

- exclude indirect, consequential, special and lost-profit damages to the extent legally permitted;
- cap ordinary aggregate contractual liability to fees paid/payable for an agreed lookback period;
- use appropriate carve-outs for fraud, wilful misconduct, confidentiality, data-protection obligations and liabilities that cannot legally be limited.

Final cap, exclusions and carve-outs: **[LEGAL REVIEW REQUIRED]**.

## 21. Indemnity — requires legal approval

No indemnity wording is approved by this template. Any IP, data, unlawful-use or third-party-claim indemnity must be explicitly reviewed and inserted by the seller's legal adviser before signature.

## 22. Changes

Material scope changes require written agreement/change order. Routine maintenance, security fixes and non-material compatible product updates do not require a new contract.

## 23. Notices

Provider notice email: [EMAIL]

Institution notice email: [EMAIL]

Formal notices must be sent using the method approved in the Order Form.

## 24. Governing law and dispute process — requires approval

Governing law, courts/arbitration venue, escalation period and dispute procedure must be selected only after the seller/legal entity and operating jurisdiction are confirmed.

Approved governing-law clause: **[LEGAL REVIEW REQUIRED]**.

## 25. Signatures

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

This template **does not** set `pricing_approved`, `tax_boundary_approved`, `retention_schedule_approved`, `messaging_packaging_approved`, `payment_webhooks_verified`, or `pilot_institution_signed_off` to true. Those gates require the specific approvals/evidence defined in the repository.