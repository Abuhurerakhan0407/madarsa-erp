# Founding Pilot onboarding runbook

> Status: operational preparation. This runbook does **not** constitute a pilot sign-off, pricing approval, legal approval, or provider verification.

## Goal

Move one real Madrasa from commercial acceptance to a controlled pilot with minimal back-and-forth, while preserving the current product boundaries and collecting the evidence required by `docs/pilot-institution-signoff-pack.md`.

## Stage 0 — qualification before accepting the pilot

Confirm:

- institution name and campus/branch count;
- approximate active student count;
- authorized decision maker and day-to-day operator;
- modules they actually need in the first 30 days;
- current data source (Excel/CSV/software/paper);
- language expectations for daily UI and generated documents;
- whether WhatsApp delivery is needed in the pilot;
- whether biometric/NFC hardware is needed in the pilot;
- whether transport requires only ERP-side routes or live GPS;
- target pilot start date.

Do not promise deferred or unproven capabilities to win the pilot.

## Stage 1 — written scope acknowledgement

Before importing real data, share and record the agreed scope:

### Available operational scope
- Dashboard
- Admissions
- Students, guardians and placement
- Academics/timetable
- Attendance
- ERP-side biometric/NFC bridge
- Quran/Hifz
- Exams/results
- Reports/documents/ID cards/status certificates
- Parent/staff portals
- Student lifecycle/import/promotion/rollover
- Hostel & Mess
- Transport/routes ERP-side
- Library
- HR & Staff core
- WhatsApp ERP runtime
- Access administration
- Configuration

### Current limitations to disclose
- AI Assistant = Preview only
- Fees/Accounting deferred
- Payroll deferred
- donation/fund accounting deferred
- live GPS not proven
- physical biometric/NFC deployment needs selected vendor/hardware
- WhatsApp real outbound needs provider credentials/sender/templates
- full Urdu/Arabic generated-PDF parity incomplete
- production Razorpay subscription verification is separate from product pilot acceptance

Record the institution's acknowledgement rather than relying on an oral assumption.

## Stage 2 — tenant and access setup

1. Create/confirm the pilot tenant and branch structure.
2. Configure institution name, academic/session settings and terminology required for the pilot.
3. Create only the minimum required operator access.
4. Verify each role with a least-privilege check.
5. Keep administrator recovery/escalation details outside ordinary user accounts.
6. Do not reuse demo credentials for a real institution.

Evidence to retain:
- tenant/branch identifiers;
- authorized operator list;
- role/access verification notes;
- date and person performing setup.

## Stage 3 — data intake

Ask the institution for one controlled source package rather than repeated ad-hoc files.

Minimum student import fields should be mapped before execution. Typical categories:
- student identity/name fields;
- admission/student identifier if available;
- active status;
- session/program/level/group placement;
- guardian identity/contact information where supplied;
- relevant transport/hostel flags only if those modules are in pilot scope.

Before production import:
- preserve the original source file;
- agree how duplicates and missing identifiers are handled;
- run supported validation/import flow;
- record rejected rows rather than silently dropping them.

## Stage 4 — import acceptance sample

After import, jointly verify a sample that is large enough to catch mapping errors. At minimum inspect:

- multiple student records from different classes/groups;
- guardian relationships/contact details;
- enrollment/session/group placement;
- one search/filter workflow;
- one document/ID view if in scope;
- totals expected vs imported vs rejected.

Do not call onboarding complete only because the row count matches.

## Stage 5 — critical workflow walkthrough

Use real institution operators wherever possible. Exercise only workflows relevant to the agreed pilot:

1. login/session/access;
2. admissions or student intake;
3. student lookup/detail/update;
4. guardian/contact handling;
5. attendance marking/review;
6. Quran/Hifz flow;
7. exams/results where applicable;
8. document/ID/certificate flow;
9. parent/staff portal flow;
10. import/promotion/rollover where applicable;
11. hostel/library/transport where included;
12. WhatsApp provider flow only if real provider setup has separately been completed;
13. biometric/NFC flow only if a selected device/vendor has separately been verified.

Record failures, workarounds and severity immediately in the pilot sign-off pack.

## Stage 6 — mobile and desktop check

The institution should exercise at least:
- one supported desktop Chromium flow;
- one relevant Android/mobile flow.

Focus on the workflows staff will actually use daily, not a cosmetic screenshot tour.

## Stage 7 — support handover

Provide and confirm:
- support contact/channel;
- expected response/escalation path;
- how to report wrong imported data;
- how to report access/security concerns;
- which requests are product support vs separately quoted customization/provider work.

## Stage 8 — pilot observation window

Recommended initial observation window: **7–14 operating days** before final pilot acceptance, unless the institution and product owner approve another period.

Track:
- login/access failures;
- data correction volume;
- attendance/daily-workflow failures;
- mobile usability blockers;
- support volume and response burden;
- module usage actually observed;
- requested features that fall outside approved scope.

The observation window is a proposal, not an approved commercial promise until the owner agrees.

## Stage 9 — sign-off

Complete `docs/pilot-institution-signoff-pack.md` with a real authorized approver.

A valid sign-off must include:
- institution and approver identity;
- environment used;
- enabled module scope;
- onboarding/import result;
- role/access verification;
- critical workflow outcomes;
- accepted limitations;
- open blockers;
- support process;
- dated written approval reference.

Only then may `pilot_institution_signed_off` be considered for a gate update.

## Abort / pause criteria

Pause the pilot rather than hiding a problem if any of these occurs:
- cross-tenant or unauthorized data access;
- material student/guardian data corruption;
- repeated critical workflow failure without a safe workaround;
- institution believes a deferred feature was sold as live;
- provider/hardware integration is represented as verified when it is not;
- unresolved security incident affecting pilot data.

## Pilot completion output

At completion retain:
- approved scope acknowledgement;
- source/import evidence;
- role/access verification;
- issue/blocker log;
- final sign-off pack;
- any provider/hardware evidence separately required;
- commercial/legal approvals separately required by launch readiness.
