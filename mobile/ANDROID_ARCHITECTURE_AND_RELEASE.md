# Ilmgaah Android — Architecture, Security & Release Standard

## Status

This mobile work is intentionally isolated on `mobile/android-dev-apk-v1`. It must not merge into or mutate ERP work while the web product is still under active audit and development.

## Two-mode architecture

### 1. Internal Development APK — current phase

Purpose: install once on Android while Ilmgaah is still changing rapidly.

- Native Android shell: Capacitor 8.
- App ID: `in.ilmgaah.app`.
- Loads the canonical HTTPS Ilmgaah `/login` web application at runtime.
- Web/ERP deployments therefore appear without rebuilding the APK.
- Cleartext HTTP is forbidden.
- WebView debugging is disabled in the generated Android app.
- This mode is for internal QA/development only.

Important: Capacitor documents `server.url` as a live-reload/development facility and not a production deployment mechanism. We use it only to satisfy the current rapid-build requirement safely and explicitly.

### 2. Production APK/AAB — release phase

Purpose: store-quality public/client distribution.

- Dedicated bundled React mobile UI.
- Existing Ilmgaah backend, Supabase, auth, APIs, tenancy, roles, and business rules remain shared.
- Web/backend API changes can take effect without reinstalling the app.
- Web-layer mobile bundle updates may later use a controlled signed OTA update channel with rollback.
- Native changes (Capacitor plugins, Android permissions, manifest, SDK/API, native code) always require a new binary.
- No production `server.url`.

This preserves both requirements: rapid automatic updates during development and a defensible native release architecture later.

## Android baseline

- Capacitor 8.5.2.
- Node 22+.
- Java/JDK 21.
- Minimum Android API: 24.
- Compile/target Android API: 36.
- Android App ID: `in.ilmgaah.app`.
- Branded adaptive launcher assets generated from the final Ilmgaah mark.

## Security baseline

### Network

- HTTPS only.
- `usesCleartextTraffic=false`.
- Android Network Security Configuration denies cleartext traffic.
- Do not add permissive `allowNavigation` wildcards.
- Do not disable TLS validation.
- External untrusted URLs must not be treated as first-party app content.

### Authentication and sessions

Development APK currently exercises existing web/Supabase session behavior.

Before production mobile release:

- define native token/session lifecycle;
- use secure OS-backed storage for durable credentials/tokens where required;
- validate logout and account/tenant switching;
- clear user-specific cached data on logout/switch;
- validate password reset and deep-link return URLs;
- allowlist deep-link destinations;
- prevent cross-tenant/session leakage.

Never embed Supabase service-role keys, signing keys, private OTA keys, provider secrets, or administrator credentials in the APK.

### Student and child data

Ilmgaah processes child/student information. Treat all academic, attendance, guardian, identity, photo, biometric-related, document, and notification data as high sensitivity.

Required before public release:

- data minimization;
- role/tenant authorization tests;
- guardian access boundary tests;
- child/guardian consent flow where legally required;
- privacy notice with collection, purpose, retention, sharing, deletion and contact details;
- account/data deletion path where applicable;
- notification content that avoids unnecessary sensitive data;
- secure file/photo cache cleanup;
- no sensitive values in logs, analytics or crash metadata;
- documented retention/deletion policy.

### Android permissions

Default rule: request nothing until a user-facing feature requires it.

Future permission features must be contextual:

- Camera only for actual capture/upload action.
- Notifications only when notification functionality is enabled.
- Files/media via modern scoped APIs rather than broad storage permission.
- Location is not added unless an approved Ilmgaah feature genuinely requires it.
- Contacts, microphone, SMS, call logs and device identifiers are not required by default.

## Build integrity

### Internal development build

- GitHub-hosted isolated CI build.
- Debug-signed, installable APK.
- SHA-256 checksum produced for each artifact.
- APK signature verified after build.
- Artifact retained temporarily for QA.

### Production release build

Do not repurpose the debug APK as production.

Production requires:

- permanent release signing identity/keystore;
- private key stored outside the repository;
- Play App Signing when distributed through Google Play;
- versionCode/versionName policy;
- signed release AAB plus optional signed APK for controlled distribution;
- minification/shrinking decision and mapping retention;
- dependency/security scan;
- manifest/permission audit;
- release notes and rollback plan;
- reproducible CI build pinned by lockfile;
- backup of signing/recovery material.

## QA gate before production

Test at minimum:

1. Fresh install.
2. Upgrade from previous build.
3. Login/logout/relogin.
4. Password recovery.
5. Admin/teacher/parent role boundaries.
6. Multiple tenants/memberships and account switching.
7. Student/guardian access isolation.
8. Attendance create/edit/failure recovery.
9. Courses/progress/exams/fees applicable to role.
10. File/photo upload and download.
11. PDF/document open/save/share.
12. Deep links.
13. Push notification routing and logout isolation.
14. Offline/network loss and reconnect.
15. App background/resume and token expiry.
16. Android back behavior.
17. Small phone, normal phone and tablet layouts.
18. English plus Urdu/Arabic/RTL flows.
19. Accessibility: font scaling, screen reader, touch targets, focus.
20. Performance on a low/mid-range Android device.
21. No cleartext network traffic.
22. No secrets or sensitive logs in the APK/runtime.
23. Crash/ANR smoke testing.
24. Data deletion/consent/privacy flows before public distribution.

## Store-readiness gates

Before Google Play submission:

- target API satisfies current Play requirement;
- privacy policy available publicly and linked in app/store listing;
- Data safety form matches actual runtime behavior;
- target audience declaration is accurate;
- child/family rules assessed if children are part of intended audience;
- reviewer credentials/instructions prepared if login is required;
- app is stable and provides meaningful mobile functionality;
- production app does not rely on the development `server.url` architecture.

## Non-interference rule

Mobile development must not modify ERP database migrations, production schema, ERP feature branches, or active audit PRs. Any future shared-core extraction happens through a reviewed integration branch after active ERP work is reconciled.
