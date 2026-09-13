# Madrasa-e-Furkania operational readiness

This document is an evidence gate for the isolated `client/madrasa-e-furkania` branch. A launch/readiness checkbox must not be treated as proof by itself.

## Current status

- Database migrations: **not verified on the intended Furkania runtime**.
- Current build: **must be tied to the exact branch head and deployment** before being marked complete.
- Critical E2E: **must be tied to the exact branch head** before being marked complete.
- Deployment current: **must match the exact branch head** before being marked complete.
- Backup/restore drill: **not verified for Furkania**.
- Existing tenants, including Al-Noor, must not be used as a destructive recovery target.

## Health contract

- `/api/health` is liveness only. It proves that the application process can answer a request.
- `/api/readiness` is dependency readiness. It fails with HTTP 503 when required Supabase Auth or REST dependencies cannot be reached or required public configuration is absent.
- Neither endpoint is proof of tenant data correctness, backup recovery, authorization correctness, or successful business workflows.

## Required recovery evidence before live use

Run the drill only against an approved isolated target. Never restore over production or the existing Al-Noor tenant.

The evidence package must record:

1. Source branch and exact commit SHA.
2. Isolated restore target identifier.
3. Backup creation timestamp and backup identifier.
4. Database restore start/end timestamps.
5. Storage restore start/end timestamps when files exist.
6. Expected and restored counts for tenants, branches, people, memberships, students and role assignments.
7. Authentication/role verification for at least one isolated test identity created for the drill.
8. Application read verification after restore.
9. File/object verification when representative storage data exists.
10. Any failed jobs and the action taken.
11. Observed RPO and RTO.
12. Operator/reviewer and completion timestamp.

A zero-file historical environment is not sufficient evidence for future storage recovery. A representative file must be included once Furkania begins storing uploaded documents/photos.

## Evidence rule

Only set a technical launch gate to `complete: true` when a dated, commit-specific evidence reference exists. If evidence is missing, stale, belongs to another branch/tenant, or cannot be reproduced, the gate stays false.

## Monitoring ownership

Before live use, operations must have an owner for:

- failed backup jobs;
- failed restore drills;
- readiness endpoint failures;
- database/storage capacity warnings;
- failed scheduled jobs and delivery queues;
- dependency incidents affecting Supabase or the deployment platform.

## Furkania activation boundary

Live Furkania tenant activation remains separate from code readiness. Owner/admin identity, exact shift times and other unresolved client rules must remain placeholders until supplied. No production data should be invented to satisfy an operational gate.
