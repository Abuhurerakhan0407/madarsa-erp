# Pilot institution sign-off pack

> Status: **UNAPPROVED template**. This file prepares evidence for `pilot_institution_signed_off`; it must never be completed with synthetic names, fake institutions or fabricated acceptance.

## 1. Pilot identity

- Institution legal/display name:
- Campus/branch:
- Authorized approver name/title:
- Primary operational contact:
- Pilot environment URL:
- Pilot start date:
- Sign-off date:

## 2. Agreed day-one module scope

Mark only modules actually enabled and demonstrated.

- [ ] Dashboard
- [ ] Admissions
- [ ] Students, guardians and placement
- [ ] Academics/timetable
- [ ] Attendance
- [ ] ERP-side biometric/NFC bridge
- [ ] Quran/Hifz
- [ ] Exams/results
- [ ] Reports/documents/ID cards/status certificates
- [ ] Parent portal
- [ ] Staff portal
- [ ] Student lifecycle/import/promotion/rollover
- [ ] Hostel & Mess
- [ ] Transport/routes ERP-side
- [ ] Library
- [ ] HR & Staff core
- [ ] WhatsApp ERP runtime
- [ ] Access administration
- [ ] Configuration

## 3. Explicitly excluded/deferred items

The approver should acknowledge these boundaries where relevant:

- AI Assistant is Preview only; no production AI provider/model is connected.
- Fees/Accounting are deferred.
- Payroll is deferred while HR core is live.
- Donation/fund accounting is deferred with Accounting.
- WhatsApp real outbound delivery requires approved provider credentials, sender and templates.
- Physical biometric/NFC deployment requires selected vendor/hardware.
- Live GPS tracking is not proven.
- Full Urdu/Arabic generated-PDF parity is incomplete.
- Razorpay subscription webhook runtime exists but provider verification is a separate launch gate.

## 4. Access and role verification

For each role used in the pilot, verify the institution-approved access boundary.

| Role/person | Expected access | Verified by | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Institution owner/admin | | | | |
| Admissions operator | | | | |
| Teacher/staff | | | | |
| Parent/guardian | | | | |
| Other | | | | |

## 5. Data onboarding/import verification

- Source data format received:
- Import method used:
- Student count expected:
- Student count imported:
- Duplicates/rejections resolved:
- Guardian linkage checked:
- Placement/group/session checked:
- Sample records manually verified:
- Unresolved data issues:

## 6. Critical workflow acceptance

Run the workflows the institution actually depends on. Do not mark a workflow passed from a screenshot alone.

| Workflow | Institution user performed it? | Result | Notes/blockers |
| --- | --- | --- | --- |
| Login/session/access | | | |
| Admission/enquiry/application | | | |
| Student search/detail/update | | | |
| Guardian relationship/contact | | | |
| Attendance marking/review | | | |
| Quran/Hifz learning flow | | | |
| Exam/result review | | | |
| Document/ID/certificate flow | | | |
| Parent/staff portal | | | |
| Promotion/rollover/import | | | |
| Hostel/Mess (if used) | | | |
| Library (if used) | | | |
| Transport/routes (if used) | | | |
| WhatsApp runtime/provider (if enabled) | | | |
| Biometric/NFC vendor/device (if enabled) | | | |

## 7. Mobile and desktop acceptance

- [ ] Institution tested a supported desktop browser.
- [ ] Institution tested a supported Android/mobile flow relevant to daily use.
- [ ] Navigation and critical forms are usable on both.
- [ ] Any device/browser limitations are written below.

Limitations:

## 8. Support and escalation

- Support contact/channel confirmed:
- Response/escalation expectation confirmed:
- Operational incident path explained:
- Data correction/import support path explained:

## 9. Open blockers at sign-off

| Blocker/limitation | Severity | Workaround | Owner | Target date |
| --- | --- | --- | --- | --- |
| | | | | |

## 10. Acceptance statement

The authorized institution approver confirms that the enabled pilot scope above was exercised in the stated environment, that known limitations/deferred items were disclosed, and that any unresolved blockers are recorded in this document.

- Institution approver:
- Title:
- Date:
- Signature/recorded written approval reference:

## Gate discipline

`pilot_institution_signed_off` may be set true only after a real institution and authorized approver complete this evidence. A template, internal test, demo account, assistant-generated name or synthetic approval is not valid evidence.
