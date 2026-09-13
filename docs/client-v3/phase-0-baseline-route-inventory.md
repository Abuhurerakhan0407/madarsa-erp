# Client V3 Phase 0 — baseline, safety, and route inventory

Date: 2026-09-05

## Verified baseline

- Repository: `Abuhurerakhan0407/madarsa-erp`.
- Verified `main`: `88e50cc8e88d74c1177231ea2a404265ce03b6b6`.
- Phase 10 PR: `#118`, open and mergeable, not merged.
- Frozen Phase 10 branch: `feature/client-v2-phase-10-documents-reports`.
- Exact Phase 10 head used as Client V3 base: `929f2940b3a32ef7d90ac78b4ae8f546b645431f`.
- `feature/client-v3-ux-rescue` was created directly from that exact head.
- GitHub Actions `Core checks` run `33772326288` is failed on the exact Phase 10 head before project steps execute; its E2E job is skipped. This is not represented as a passing CI result.
- Live tenant `abu-school` is active and currently has `client_profile = client-v2`.
- Latest live migration observed: `20260903235000 client_v2_phase10_documents_and_reports`.

## Safety freeze

- No Supabase row, schema, RLS policy, role, membership, auth rule, migration, or tenant data was changed during Phase 0.
- No production data was reset.
- No authorization code was weakened or replaced.
- Phase 10 IDs/Documents/Reports implementation remains untouched.
- The frozen Phase 10 branch remains the auditable Phase 10 branch; Client V3 work occurs only on `feature/client-v3-ux-rescue`.
- Authorization continues to use the existing tenant/RBAC/RLS path. Client/product capability gating can only remove access; it does not grant authorization.

## Critical route / surface inventory

| Surface | Current route / implementation | Client V3 classification | Phase 0 finding |
|---|---|---|---|
| Login | `/login` | SIMPLIFY | Exists; English-first and not locale-scoped. Phase 1 must add obvious EN/UR/AR entry without weakening auth. |
| Home / dashboard | `/{locale}` | SIMPLIFY | Exists; currently operations/metrics-first rather than task-first. |
| Authenticated shell | `AppShell` | SIMPLIFY | Exists; current desktop navigation is module-heavy. |
| Language switcher | `LocaleSwitcher` | BROKEN | Exists, but every language link uses `href="/"`, so task context is lost. Fix in Phase 1. |
| Admissions | `/{locale}/admissions` | SIMPLIFY | Exists; current copy/UI exposes workflow language such as “Admissions operations” and “Admissions workflow”. |
| Students | `/{locale}/students` | SIMPLIFY | Exists and remains a core surface. |
| Attendance | `/{locale}/attendance` | SIMPLIFY | Exists; current surface exposes biometric/configuration concepts that must be progressively disclosed. |
| Qur'an / Hifz | `/{locale}/quran` | SIMPLIFY | Exists; preserve domain functionality and simplify daily teacher flow later. |
| IDs & Documents | `/{locale}/documents` | KEEP | Phase 10 document center exists; preserve engine and improve discoverability only. |
| Reports | `/{locale}/reports` | KEEP | Phase 10 reports hub exists; keep under `More` later. |
| Programs & Syllabus | `/{locale}/programs` | ADMIN-ONLY | Preserve configuration capability; remove from normal daily navigation in Phase 1. |
| Academics & Timetable | `/{locale}/people-academics` | ADMIN-ONLY | Preserve; move away from novice daily navigation. |
| Exams & Results | `/{locale}/exams` | KEEP | Preserve and place under `More` for office/admin roles where permitted. |
| Parent & Teacher Access administration | `/{locale}/portals` | ADMIN-ONLY | Preserve access management; role-specific parent/teacher surfaces remain separate. |
| Teachers | `/{locale}/staff` | KEEP | Preserve; place under `More` for office/admin roles and expose teacher work role-appropriately. |
| Institution Configuration | `/{locale}/settings/configuration` | SIMPLIFY | Preserve backend/settings; present as simple `Settings`, with advanced controls progressively disclosed. |
| Fees & Accounting · Demo | `/{locale}/demo/fees` | HIDE FROM CLIENT | Hidden by `client-v2`; direct demo route is covered by the server-side demo capability boundary. Do not promote until real workflow is verified. |
| Import / Promotion / Renewal | `/{locale}/students/lifecycle` | HIDE FROM CLIENT | Hidden by `client-v2`; route family has a server-side capability boundary. Preserve implementation. |
| Donations & Sponsorships · Demo | `/{locale}/demo/donations` | HIDE FROM CLIENT | Hidden by `client-v2`; direct demo route is covered by the server-side demo capability boundary. |
| Hostel & Mess | `/{locale}/hostel` | HIDE FROM CLIENT | Disabled for `client-v2`; deferred from rescue. |
| Transport & Routes | `/{locale}/transport` | HIDE FROM CLIENT | Disabled for `client-v2`; deferred from rescue. |
| Library | `/{locale}/library` | HIDE FROM CLIENT | Disabled for `client-v2`; deferred from rescue. |
| WhatsApp Automation | `/{locale}/communications/whatsapp` | HIDE FROM CLIENT | Disabled for `client-v2`; do not advertise until production-ready. |
| AI Assistant · Preview | `/{locale}/demo/ai` | HIDE FROM CLIENT | Hidden by `client-v2`; direct demo route is covered by the server-side demo capability boundary. |
| Branches & Roles | `/{locale}/access` | ADMIN-ONLY | Preserve RBAC administration, but keep out of normal operator navigation. Current `client-v2` product gate hides this client-facing route family. |
| Internal demo suite | `/{locale}/demo/*` | HIDE FROM CLIENT | Entire suite is wrapped by `CapabilityBoundary("internal_demo_suite")`; `client-v2` disables that capability, causing fail-closed 404 behavior. |

## Explicit Demo / Preview exposure list

Client V3 must not expose these to the next client:

1. Fees & Accounting · Demo.
2. Donations & Sponsorships · Demo.
3. AI Assistant · Preview.
4. Internal demo suite routes.
5. Any CTA, onboarding copy, navigation item, or dashboard action that implies unfinished Fees, WhatsApp, AI, or other deferred functionality is production-ready.

At Phase 0, the `abu-school` tenant's active `client-v2` capability profile already removes the known Demo/Preview items from generated navigation, while the demo route family is protected server-side. No destructive deletion is required.

## Phase 0 gate evidence

- Correct Client V3 branch base: verified.
- Unrelated deletions: none introduced in Phase 0.
- Critical routes: inventoried above.
- Demo/Preview exposure list: explicit above and current tenant gating verified.
- Production data reset: none.
- Authorization weakened: no; no auth/RBAC/RLS code was changed.

Phase 1 must not reinterpret this document as permission to expose hidden/deferred modules.