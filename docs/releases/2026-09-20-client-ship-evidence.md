# Ilmgaah Client-Ship Release Evidence — 2026-09-20

This document records verified release evidence. It is not production approval.

## Production safety

- Production database was not migrated.
- Production deployment was not changed.
- Production aliases/domains were not changed.
- All destructive clean-room work was limited to the isolated staging project.
- Synthetic staging tenant/user data used for biometric validation was removed after testing.

## Clean-room database proof

Staging project was rebuilt from an empty application schema using:

1. committed Phase 2 tenancy baseline contract
2. committed Phase 2 storage baseline contract
3. committed Phase 3 configuration baseline contract
4. recovered production foundation migration
5. complete production migration history
6. all release-candidate migrations

Historical migration sources missing from the repository were recovered from the production Supabase migration ledger without reconstructing their SQL by hand.

Post-rebuild staging evidence:

- public tables: 258
- foreign keys: 812
- PK/unique/check constraints: 1,445
- indexes before biometric arrival optimization: 952
- RLS-enabled public tables: 258/258
- policyless RLS tables: 0
- public RLS policies: 261
- WhatsApp RPCs: 0
- SECURITY DEFINER routines missing pinned search_path: 0
- tenant rows: 0 after smoke cleanup
- auth users: 0 after smoke cleanup
- storage objects: 0
- Supabase Security Advisor: 0 lints

The later biometric arrival lookup index was applied and PostgreSQL demonstrated an Index Scan on
attendance_device_events_student_arrival_idx for the arrival-deduplication query.

## Biometric server flow proof

Release migration:

supabase/migrations/20260920230000_attendance_biometric_auto_apply_arrival.sql

Behavior proven on managed staging:

- token-authenticated biometric event is received
- active device-user mapping is honored
- existing governed attendance application runtime is reused
- the device creator's active membership/branch/permission context is reused as the automation actor
- a failed apply remains matched and retryable rather than being lost
- raw biometric template/image keys remain rejected
- modified/new RPCs are service_role-only
- no anon/authenticated execute grant was added
- Security Advisor remained zero-lint

## Real synthetic institution biometric smoke

A staging-only synthetic institution was created through the real application contracts.

Validated setup included:

- tenant bootstrap
- branch
- active academic session
- program
- published student number sequence
- student created through create_student_direct
- guardian relationship
- verified guardian identity link
- biometric device registration
- device-user mapping

### Onboarding dependency discovered

The first device event correctly remained matched/retryable with:

student attendance status configuration is missing

The real Maktab configuration preset was then applied with student attendance statuses:

- present
- absent
- late
- leave

The exact same queued event ID was retried.

Result:

- state: applied
- matched: true
- auto_applied: true
- retryable: false
- attendance source: biometric
- attendance status: present
- attendance source reference linked to the device event
- one guardian in-app arrival notification delivered

### Same-day dedupe

A second biometric check-in for the same student/local day produced:

- 2 applied device events
- 1 daily attendance record
- 1 biometric-arrival notification
- 1 guardian notification dispatch

This proves same-day punches do not duplicate the daily attendance result or guardian arrival alert.

### Smoke cleanup

After validation, synthetic data was removed.

Verified zero:

- tenants
- branches
- persons
- student profiles
- memberships
- biometric device events
- attendance records
- notification events
- auth users
- profiles

## Biometric Windows Bridge

A portable Windows bridge was built locally before the Remote Desktop connector went offline.

Verified locally before interruption:

- CSV parser
- XLSX parser
- configurable export header row
- configurable source timezone
- DMY timestamp parsing for India-style exports
- configurable IN/OUT mapping
- deterministic event IDs
- biometric-only modality
- forbidden biometric/template/image column rejection
- persistent offline queue
- exponential retry
- health/log files
- packaged Node runtime
- installer/status/uninstaller scripts
- SHA-256 package manifest

Manual package smoke proved:

1. CSV punch → normalized request → HTTP 202 applied → queue 0
2. endpoint unavailable → punch remains queued
3. endpoint restored → same queued event delivered → queue 0

The bridge source/package has not yet received its final exact-head gate/commit because the authorized laptop connector went offline during packaging.

## Current code validation

Before the bridge packaging interruption:

- release invariants: pass
- TypeScript: pass
- full unit suite after biometric server migration: 158/158 files, 801/801 tests

A prior exact application RC passed:

- lint: 0 errors
- production Next.js build
- 422/422 Playwright tests across Chromium + Pixel 7

Because the release branch advanced after that browser/build run, the final frozen RC must rerun the entire exact-head gate stack once the laptop connector is online.

## Vercel blocker

Every current Git-triggered preview is BLOCKED before a build starts.

Vercel's deployment record links the failure to:

Troubleshoot Project Collaboration → Team configuration

This is not an application build error. Vercel does not start the builder.

No connected Vercel action currently exposes the required team/project-access mutation, so this remains an external account-policy action.

## GitHub Actions blocker

Current workflow behavior remains external infrastructure failure:

- checks job: failed
- checks steps: null
- E2E job: skipped
- repository code never executes on the runner

Local exact-head validation is therefore the required release proof until GitHub runner execution is restored.

## Supabase Free-plan limits

Current Supabase documentation confirms:

- leaked-password protection is Pro-only
- downloadable database backups are unavailable on Free
- Free projects may be paused for inactivity

Leaked-password protection therefore requires a deliberate plan decision/compensating controls if staying Free.

A real backup/restore drill is not complete. If Ilmgaah remains on Supabase Free, an external database backup flow using pg_dump and an isolated restore test must be proven before production cutover.

## Performance

Supabase Performance Advisor reports INFO-level unindexed foreign-key findings across the historical schema.

These are not being mass-fixed before launch.

Hot release paths were inspected and already contain useful composite/unique indexes for:

- biometric device lookup and event deduplication
- attendance inbox
- student attendance records
- enrollments/rosters
- student/person lookup
- memberships
- guardian identity resolution
- fees
- notification dispatch/resolution

A targeted partial index was added specifically for the new biometric first-arrival lookup.

## Required gates still open

- final Windows biometric bridge source/package check and commit
- final exact-head lint/typecheck/unit/build/E2E after all bridge work
- Vercel Project Collaboration / Team Configuration unblock
- deployed preview/staging URL smoke
- real external backup → isolated restore proof
- Supabase Free/Pro security and availability decision
- physical mBio + vendor software automatic export verification
- client-site bridge installation and Tests A-E from biometric installation runbook
- pilot institution UAT/sign-off
- final signed APK and Android installation/update test
- App Install link on ilmgaah.in after APK is final
- explicit final production approval
- production migration/deployment/post-deploy smoke

## Production decision

Do not deploy production yet.

The web application/database release candidate is strong and the managed-staging biometric server flow is proven, but client shipping still requires the remaining operational recovery, deployment, Windows bridge, physical-device, APK, and pilot gates above.
