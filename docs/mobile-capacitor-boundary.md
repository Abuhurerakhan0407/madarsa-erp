# Ilmgaah native mobile boundary

This is the architecture boundary for the future Android/iOS Ilmgaah app. It is not permission to wrap the current server-rendered web UI in a generic WebView.

## Decision

The native app will use a dedicated mobile React frontend with Capacitor and the existing Ilmgaah backend/data model.

Target repository shape:

```text
/apps/web       existing Next.js Ilmgaah web/admin application
/apps/mobile    dedicated React + Capacitor mobile application
/packages/core  shared domain types, validation and platform-neutral business rules
```

The Next.js server runtime, server components and cookie-based SSR session model remain web concerns. The mobile app must not depend on packaging those server features as local static assets.

## Backend/API boundary

Mobile features call explicit HTTPS API endpoints. New mobile-capable endpoints must:

- authenticate the caller independently of browser SSR cookies;
- resolve tenant and branch authorization server-side on every protected operation;
- keep Furkania and other tenants isolated;
- validate request origin/client context without globally disabling CSRF or CORS controls;
- never trust a tenant, role or branch claim supplied only by the client;
- use stable idempotency keys for retryable writes;
- return bounded/paginated data for list surfaces;
- keep privileged service-role credentials exclusively on the server.

Existing same-origin-only endpoints must not be silently opened to arbitrary origins. Each endpoint intended for native use requires an explicit native-safe authentication and authorization contract.

## Authentication lifecycle

The mobile implementation must define and test:

1. sign-in and account recovery;
2. secure session/token persistence using native secure storage rather than ordinary localStorage for sensitive credentials;
3. token refresh and expiry;
4. logout and credential revocation;
5. background/resume behavior;
6. deep-link recovery flows;
7. tenant/branch switching without leaking the previous workspace context;
8. lost/revoked membership behavior.

The web cookie session is not the mobile security boundary.

## Native capabilities

Capacitor/native plugins may be introduced only behind platform services with graceful permission/error handling. Initial capability candidates are:

- push notifications and notification deep links;
- network/offline state;
- camera/photo capture where an Ilmgaah workflow requires it;
- filesystem/PDF save and open;
- native share sheet;
- haptics;
- splash/status/navigation-bar integration;
- app lifecycle and deep links.

Phone biometrics, if later used for app unlock, are separate from institutional biometric attendance hardware.

## Offline and retry rules

Offline support must be workflow-specific. A generic blind request replay queue is prohibited for attendance, fees, marks or other consequential writes.

For each offline-capable write, define:

- immutable client operation ID;
- server idempotency behavior;
- conflict policy;
- user-visible pending/failed/synced state;
- expiry/cancellation semantics;
- authorization recheck at replay time.

## Downloads and documents

The native app must use authenticated API/download contracts and native filesystem/share flows. Signed external redirects must not become the default authorization mechanism. PDF and image access remains tenant-scoped and authorization is rechecked server-side.

## Push notifications

Push registration must be user/device scoped and revocable. Notification payloads should carry minimal data and route through an authenticated deep-link destination. A push token never grants application authorization.

## Network security

Production builds use HTTPS only. Do not ship development cleartext allowances, permissive navigation wildcards or a global CORS/CSRF bypass. Allowlisted native origins/schemes must be explicit and environment-specific.

## Required validation before calling native readiness complete

Real Android/iOS validation must cover:

- login, refresh, expiry, recovery and logout;
- tenant/branch switching and cross-tenant denial;
- deep links from cold start and resumed app;
- background/resume session behavior;
- offline/reconnect behavior for every enabled offline workflow;
- retry/idempotency for consequential writes;
- push registration, revocation and navigation;
- camera/file permissions where enabled;
- PDF save/open/share;
- network failure and API error states;
- Android back behavior and iOS navigation conventions;
- safe-area, keyboard and accessibility behavior.

An Android build does not prove iOS correctness. iOS release validation requires macOS/Xcode and real iOS testing.

## Furkania boundary

This architecture may be prepared before live Furkania activation, but unknown client rules remain placeholders. Exact shift times, owner/admin identity, fee rules, attendance policy, WhatsApp scope and other unconfirmed client data must not be invented to make the mobile app appear complete.
