# Client demo QA — 2026-09-01

## Scope

This audit covers the client-facing workspace navigation, retained legacy `/demo/...` routes, multilingual labels, mobile navigation mechanics, and truthful status labeling for demo/Preview/deferred areas.

Baseline before this lane: `ccd1687d42c901fb5f7cc55152473d0979e6de90`.

## Navigation audit

Every sidebar destination resolves to an existing App Router target or an intentional generic demo route:

| Area | Route | Status |
| --- | --- | --- |
| Overview | `/{locale}` | Live |
| Admissions | `/{locale}/admissions` | Live |
| Students | `/{locale}/students` | Live |
| Academics & Timetable | `/{locale}/people-academics` | Live |
| Attendance & Biometrics | `/{locale}/attendance` | Live |
| Qur'an & Hifz | `/{locale}/quran` | Live |
| Fees & Accounting | `/{locale}/demo/fees` | **Deferred demo** |
| Exams & Results | `/{locale}/exams` | Live |
| Parent & Staff Portals | `/{locale}/portals` | Live |
| Import, Promotion & Renewal | `/{locale}/students/lifecycle` | Live |
| Donations & Sponsorships | `/{locale}/demo/donations` | **Deferred demo** |
| Hostel & Mess | `/{locale}/hostel` | Live |
| Transport & Routes | `/{locale}/transport` | Live |
| HR & Staff | `/{locale}/staff` | Live staff workflows; payroll remains demo-only |
| Library | `/{locale}/library` | Live |
| IDs & Documents | `/{locale}/documents` | Live |
| Reports & Analytics | `/{locale}/reports` | Live |
| WhatsApp Automation | `/{locale}/communications/whatsapp` | Live workflow; provider readiness depends on configuration |
| AI Assistant | `/{locale}/demo/ai` | **Preview only** |
| Branches & Roles | `/{locale}/access` | Live |
| Configuration | `/{locale}/settings/configuration` | Live |

The same route structure is used for `en`, `ur`, and `ar`; navigation labels are explicitly supplied for all three locales.

## Fixed defects

1. Login marketing no longer presents finance/Fees as currently available core functionality.
2. Fees & Accounting navigation and demo content now say **Demo / Deferred demo**.
3. Donations & Sponsorships navigation and demo content now say **Demo / Deferred demo**.
4. Live staff navigation now says **HR & Staff** instead of implying production payroll. The scripted module explicitly says **Payroll demo**.
5. AI remains visibly **Preview**. Fictional production usage counters were removed and replaced with provider/model/status facts: not connected, disabled, zero production actions, Preview.
6. Every generic demo module page now displays the **Scripted demo data** chip.
7. Demo hub copy now distinguishes live workspaces from scripted demo and Preview areas.
8. Legacy `/{locale}/demo/academics` now redirects to the live `/{locale}/people-academics` workspace instead of rendering a second stale demo implementation.

## Existing legacy redirects verified

- `/{locale}/demo/branches` → `/{locale}/access`
- `/{locale}/demo/hostel` → `/{locale}/hostel`
- `/{locale}/demo/library` → `/{locale}/library`
- `/{locale}/demo/operations` → `/{locale}/students/lifecycle`
- `/{locale}/demo/transport` → `/{locale}/transport`
- `/{locale}/demo/academics` → `/{locale}/people-academics` after this lane

## Mobile and accessibility review

`MobileNavigation` provides:

- fixed four-target bottom navigation;
- drawer navigation for all groups;
- focus transfer on open/close;
- Escape-to-close;
- `aria-expanded`, `aria-controls`, `aria-current`, and labelled navigation;
- body scroll lock while drawer is open;
- RTL drawer direction handling;
- reduced-motion handling;
- touch targets above 44px (bottom targets use a 3.3rem minimum height; drawer links use 3.25rem).

The repository Playwright configuration executes both Desktop Chrome and Pixel 7 Android profiles. Full `pnpm test:e2e` remains the merge requirement for this lane.

## Intentional non-live areas

- Fees & Accounting: deferred scripted demo.
- Donation fund/payment accounting: deferred scripted demo.
- Payroll: not claimed by live HR navigation; payroll examples remain scripted demo data.
- AI Assistant: Preview; no production model/provider connected.

No launch-readiness boolean is changed by this QA lane.
