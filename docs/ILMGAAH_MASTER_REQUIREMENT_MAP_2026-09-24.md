# Ilmgaah Master Requirement-to-Implementation Map — 2026-09-24

Authoritative basis: ILMGAAH_MOBILE_FIX_MASTER_PROMPT(2).md

## Phase A — P0 stability and mobile foundation

| Requirement | Primary implementation surfaces | Verification |
|---|---|---|
| Performance diagnosis | src/lib/tenancy/context.ts; src/lib/supabase/identity.ts; src/components/app-shell.tsx; route/page data loaders; Vercel runtime logs; Android timing | measured cold/warm login + route timings; duplicate request audit |
| Session/app-state restoration | src/proxy.ts; src/app/app-entry/page.tsx; src/app/login/page.tsx; src/lib/auth/*; Android TWA launcher/config | background 30s/3m; forced recreation; prior authorized route restore |
| Global loading / repeat-click protection | src/components/route-pending-feedback.tsx; shared async buttons/forms; route pending CSS | repeat-click mutation checks; stale response checks |
| Mobile login | src/app/login/page.tsx; src/app/login/layout.tsx; src/app/auth-flow.css; src/app/auth-professional.css | 360/390/430px + keyboard + validation + busy state |
| Splash/icon | src/app/manifest.ts; public/icons/*; Android res/mipmap*; Android res/drawable*/splash.png; twa-manifest.json | clean install/update; launcher + splash visual check |
| Header/account control | src/components/app-shell.tsx; src/components/sign-out-button.tsx; shell CSS | accessible account menu/logout; no overlap |
| English/Urdu + RTL | src/components/locale-switcher.tsx; src/app/[locale]/layout.tsx; next-intl messages; page copy | preserve current route; EN/UR/RTL persistence |
| Client feature flags/navigation | src/lib/capabilities/*; src/lib/navigation/client-v3-navigation.ts; route layouts/boundaries; APIs | hidden nav + direct URL/API blocked |

## Phase B — core operational flows

| Area | Primary implementation surfaces |
|---|---|
| Admissions | src/app/[locale]/admissions/**; admissions components/lib/API/RPCs |
| Students | src/app/[locale]/students/**; student lifecycle/list/detail components; student queries |
| Attendance | src/app/[locale]/attendance/**; attendance components/lib/APIs; biometric integration |
| Quran/Hifz | src/app/[locale]/quran/**; Quran components/lib/RPCs; parent portal projection |
| Programs/Syllabus | src/app/[locale]/programs/**; academic configuration/query layer |
| Teachers/Staff | src/app/[locale]/staff/**; HR workspace/RPCs |
| Reports/Analytics | src/app/[locale]/reports/**; src/components/reports-hub.tsx; src/lib/reports/**; /api/reports/** |
| IDs/Documents | src/app/[locale]/documents/**; document components/renderers/APIs |

## Phase C — access and data operations

| Area | Primary implementation surfaces |
|---|---|
| Parent/Teacher access | src/app/[locale]/portals/**; portal-admin-center; auth admin server APIs; audit |
| Import Students | src/app/[locale]/students/lifecycle/**; student-lifecycle-center; csv-import; import API/RPCs |
| Hostel | schema discovery first; new tenant-flagged route/components/migrations only if existing relationships support it |

## Phase D — regression/handover

Role matrix: Admin / Teacher / Parent.
Language matrix: English/LTR / Urdu/RTL.
Device matrix: desktop Playwright + 360/390/430 mobile viewport + connected Android TWA.
Critical outputs: CSV/PDF downloads, Android open/download, push, session restoration, deep-link guards, final build, release evidence.
