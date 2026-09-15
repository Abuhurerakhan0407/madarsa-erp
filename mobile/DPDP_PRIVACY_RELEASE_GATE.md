# Ilmgaah Mobile — DPDP & Child-Data Release Gate

**Status:** release-blocking engineering standard for Android and iOS.

Ilmgaah handles student, guardian, academic, attendance, identity, document, photo and potentially biometric information. Mobile work must therefore be designed for child-data privacy from the start, not patched after store submission.

This checklist is an engineering control set, not legal advice. Before public/client release, re-check the current Digital Personal Data Protection Act, 2023, the final Digital Personal Data Protection Rules, 2025, their phased commencement, and any education-specific child-data exemptions/conditions against Ilmgaah's exact processing.

Official references:
- MeitY DPDP Act 2023: https://www.meity.gov.in/content/digital-personal-dataprotection-act-2023
- MeitY DPDP Rules 2025: https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa

## Gate 1 — Data map and minimisation

Before enabling a production mobile feature, record:
- personal-data fields it reads/writes;
- exact purpose;
- user roles allowed to access it;
- tenant/institution scope;
- device/cache location, if any;
- server/database location;
- third-party processor, if any;
- retention/deletion rule;
- whether the data concerns a child;
- whether the data is biometric/high-risk operational data.

Do not collect a field merely because the database can store it. Do not expose a desktop/admin field to mobile unless the role needs it.

## Gate 2 — Children and guardians

- Treat student data as child data wherever the student's age falls within applicable law.
- Do not assume a blanket educational-institution exemption. Map each processing purpose to the current Act/Rules and obtain legal review where an exemption is relied on.
- Maintain a verifiable parent/guardian-consent capable flow for processing that requires it.
- Store only the minimum evidence needed to prove consent/authority; do not copy identity documents into the app unless necessary and approved.
- Never use behavioural advertising, targeted advertising, or unrelated tracking on child profiles.
- Guardian views must be server-authorised to the correct child/children; never trust a child ID supplied only by the client.
- Teacher-private notes must never appear in parent/student surfaces.

## Gate 3 — Notice, choice, rights and grievance path

Before production:
- provide a clear in-app `Privacy & data` entry;
- make the applicable privacy notice available before or at collection where required;
- describe data categories, purposes, sharing/processors, retention/deletion and contact route in plain language;
- make consent withdrawal no harder than consent where consent is the basis used;
- provide a documented route for applicable access, correction, update and erasure requests;
- provide a visible privacy/grievance contact owned by the institution/platform as applicable;
- never invent contact details in code: production contact values must come from controlled configuration.

## Gate 4 — Authentication, tenancy and role boundaries

- All sensitive authorisation must be enforced server-side.
- Verify institution/tenant membership on every protected operation.
- Verify Admin, Teacher and Parent boundaries with negative tests.
- Parent sessions cannot access unrelated children, private HR data or teacher-private notes.
- Teacher sessions cannot access unrelated institutions/classes/students.
- Account/tenant switching must clear user-specific cached state before loading the next context.
- Logout must invalidate/clear durable mobile session material and cached sensitive data.

## Gate 5 — Device and network security

- HTTPS only; cleartext traffic remains disabled.
- Never disable TLS verification.
- Never embed Supabase service-role keys, signing keys, provider secrets, administrator credentials or private API keys in the APK/AAB/IPA.
- Use OS-backed secure storage for durable production credentials/tokens where required.
- Do not persist child data locally unless a feature requires it and a retention/cleanup rule exists.
- Securely clear temporary photos/documents/downloads and user-specific caches on logout/account switch where feasible.
- Sensitive notifications should reveal the minimum necessary on a lock screen.

## Gate 6 — Android/iOS permissions

Default: request no sensitive permission until a user invokes a feature that genuinely needs it.

- Camera: only for an approved capture/upload action.
- Notifications: ask contextually when notification functionality is enabled.
- Files/media: use modern scoped/system picker APIs instead of broad storage access.
- Location: absent unless a separately approved Ilmgaah feature requires it.
- Contacts, microphone, SMS, call logs and device identifiers: not required by default.
- Every new native plugin requires a manifest/privacy review before merge.

## Gate 7 — Logging, analytics, crash data and screenshots

- Capacitor production and internal live-data builds use `loggingBehavior: 'none'`.
- Never log names, phone numbers, email addresses, student IDs, guardian IDs, photos, document URLs, attendance records, academic records, auth tokens or reset/deep-link tokens.
- No analytics SDK is added by default.
- Any future analytics/crash processor needs a data inventory, purpose, redaction, retention and disclosure review before enablement.
- QA screenshots/videos containing real child data must be avoided or redacted and must not be committed to GitHub/issues.

## Gate 8 — Retention, deletion, export and backups

- Document retention by data category and purpose.
- Delete/anonymise data when its approved purpose/retention ends, subject to applicable legal/institutional retention requirements.
- Ensure deletion workflows account for cached files, generated exports and processors, not only primary database rows.
- Backups must have access controls and a defined expiry/restore policy.
- Exports containing student data must be role/tenant scoped and treated as sensitive files.

## Gate 9 — Notifications and third parties

- Never send a guardian notification to a phone/account without verifying the current student-guardian relationship.
- Avoid unnecessary academic/attendance detail in push notification bodies.
- Document every third-party processor and the personal data sent to it.
- WhatsApp, push, analytics, crash reporting, payments and biometric integrations each require a separate privacy/security review before production enablement.

## Gate 10 — Incident readiness

Before public/client release, define:
- incident owner and contact path;
- detection/log preservation that does not itself leak personal data;
- containment and credential/token revocation steps;
- affected tenant/user identification method;
- applicable breach-notification decision process and evidence trail.

## Mandatory pre-release evidence

A production Android/iOS release cannot be marked ready until evidence exists for:
1. data map completed for enabled mobile features;
2. privacy notice/contact route configured;
3. child/guardian processing mapped to current legal requirements;
4. role + tenant isolation tests passed;
5. logout/account-switch cache/session clearing verified;
6. manifest permission audit passed;
7. APK/AAB contains no embedded secrets;
8. logs/analytics/crash payloads reviewed;
9. deletion/retention path tested;
10. notification privacy tested;
11. Google Play Data safety / Apple privacy disclosures match actual runtime behaviour;
12. current DPDP Act/Rules commencement and applicable exemptions re-verified before release.

## Current internal development APK

The internal Android development APK is not a production release. It may display the hosted Ilmgaah ERP, so real-data privacy controls still apply. Native bridge logging remains disabled, cleartext traffic remains blocked, WebView debugging remains disabled, backups remain disabled by generated manifest hardening, and no additional sensitive Android permissions should be introduced without an explicit feature review.
