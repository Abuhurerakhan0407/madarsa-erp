# Chat 01 Foundation Integration Hold

Canonical authorization/navigation contract for integration:
- known office/admin -> `office`
- known verified teacher -> `teacher`
- known parent -> guardian/portal path
- unknown, missing role, missing permissions, or unclassified -> `neutral`

`neutral` is fail-closed: no operational navigation, minimal access-unavailable UI, language control where appropriate, and sign-out. It must never fall back to teacher or office navigation.

## Canonical shared files owned by Foundation
- `src/lib/navigation/audience-classifier.ts`
- `src/lib/navigation/audience.ts`
- `src/lib/navigation/client-v3-navigation.ts`
- `src/components/app-shell.tsx`
- `src/components/mobile-navigation.tsx`
- `src/components/workspace-ui.tsx`
- `src/app/[locale]/not-found.tsx`
- Foundation-owned global route-state/navigation contract tests and route-audit documentation

Other workstreams must NOT overwrite these shared files blindly. If another branch changed any of them, integration must manually reconcile that change against the Foundation contract above; Chat 01's `neutral` shared-navigation/AppShell/audience model wins over semantically similar alternatives such as Chat 05's `restricted` model.

Do not cherry-pick Chat 05 test-only/release-infrastructure fixes into this branch merely to make the Foundation branch globally green. Incorporate those later on the integration branch.

No further domain work is authorized here for Admissions, Student authorization, Attendance, Qur’an, Exams, Reports, Portals, or WhatsApp unless the manager sends an explicit integration-conflict directive.
