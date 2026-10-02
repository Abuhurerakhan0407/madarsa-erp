# Ilmgaah commercial release scope

This file is the release scope lock for the current commercial handoff.

## Required launch modules

- Admissions & Enquiries
- Student Information System
- Programs & Syllabus
- Academics, Timetable, Homework & Calendar
- Student Attendance
- Teacher/Staff Attendance
- Biometric attendance bridge and reconciliation
- Qur'an / Hifz / Nazra / Qaida workflows supported by the product
- Teachers / Staff / Leave
- Parent Portal
- Teacher Portal
- Exams / Marks / Results / Report Cards
- Reports & Analytics
- IDs / Documents / Certificates
- Roles & Access
- Institution Configuration
- Student Import / Promotion / Renewal
- Fees & Payments — intentionally small, complete workflow
- Contributions — Donation / Zakat / Sponsorship, intentionally small, complete workflow
- Payroll — intentionally small, complete workflow
- AI Assistant — operational aggregate assistant, no fabricated records

## Explicitly removed from commercial release

- Student Portal
- WhatsApp Automation
- Hostel & Mess
- Transport / Routes
- Library

Removed modules must not appear in client navigation, release claims, setup surfaces, or client-facing module lists. Historical migrations or dormant code may remain when deletion would damage migration history, but removed modules are not release features.

## Completion rule

A required module is complete only when its real workflow works end-to-end with tenant/branch/role authorization, mobile usability, and English/Urdu release behavior. A hidden route, demo screen, placeholder, preview label, or passing unit test alone does not count as completion.

Production merge/deployment remains blocked until the integrated release candidate passes combined migration, authorization, workflow, mobile, English/Urdu RTL, PDF/document, and smoke-test gates and receives explicit approval.