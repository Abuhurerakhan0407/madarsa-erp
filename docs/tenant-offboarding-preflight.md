# Tenant offboarding preflight

This runbook prepares a tenant closure/data-deletion review without deleting or changing any production data.

## Safety boundary

`public.tenant_offboarding_preflight_v1(bigint)` is a read-only, `service_role`-only inventory function.

It does **not**:

- delete, anonymize, restrict, expire, update or insert records;
- schedule a deletion job;
- release a legal hold;
- approve a retention policy;
- inventory or delete Supabase Storage object bytes;
- satisfy `retention_schedule_approved` by itself.

Destructive tenant offboarding remains blocked until the retention/offboarding policy is formally approved and a separately reviewed executor/process exists.

## What the preflight reports

For one tenant ID it returns:

- tenant name, slug, state and the tenant-level legal-hold flag;
- active legal holds, grouped by scope type;
- unresolved deletion jobs, grouped by state;
- active retention policies applicable globally or to the tenant;
- every public base/partitioned table that contains a `tenant_id` column;
- row count for that tenant in each discovered table;
- total tenant-scoped rows and populated-table count;
- an explicit notice that Storage is outside the database inventory.

The table inventory is discovered from PostgreSQL catalogs rather than a hard-coded table list, so new tenant-scoped base/partitioned tables are visible automatically.

## Operator invocation

Run only through a protected service-role/server-side operator path. Never expose the RPC directly to browser roles.

Example SQL for an authorized operator:

```sql
select public.tenant_offboarding_preflight_v1(<tenant_id>);
```

Treat the output as evidence for review, not as authorization to delete.

## Required review before any future destructive execution

1. Confirm the tenant identity and authorized closure request.
2. Confirm the approved retention schedule and policy version.
3. Resolve or honor every active legal hold.
4. Reconcile any existing deletion job that is not `completed` or `cancelled`.
5. Export/return data if the approved contract or policy requires it.
6. Inventory tenant-linked Storage objects separately.
7. Confirm backup/recovery retention and eventual expiry treatment.
8. Approve an explicit deletion/anonymization plan per system/table class.
9. Run destructive work only through a separately reviewed, auditable mechanism.
10. Verify absence/anonymization after execution and preserve non-sensitive evidence.

## Current production snapshot — 2026-09-01

An initial broad `information_schema.columns` audit found 228 public relations exposing a `tenant_id` column. The production preflight intentionally narrows this to real base/partitioned tables and currently discovers **226** such tables.

The first live preflight execution completed successfully and reported 94 populated tenant-scoped tables and 1,298 tenant-scoped rows for the current tenant record. It also reported zero active legal holds, zero unresolved deletion jobs and zero currently applicable active retention policies. Those figures are dated operational evidence, not permanent schema assumptions.

Direct tenant foreign keys intentionally use restrictive deletion behavior rather than broad cascade deletion. The governance schema includes retention policies, deletion jobs/items and legal holds; the preflight does not add a deletion/purge executor.

At the same audit point, the private `tenant-documents` Storage bucket contained 0 objects / 0 bytes. That is only a dated snapshot. Storage must be inventoried again when a real pilot/offboarding occurs.

Live permission verification confirmed the preflight function is `SECURITY DEFINER`, uses an empty `search_path`, denies `anon` and `authenticated` execution, and grants execution to `service_role` only.

## Launch-gate discipline

This preflight reduces operational uncertainty but does **not** change `config/launch-readiness.json`. `retention_schedule_approved` remains false until the owner/privacy/legal decision is actually approved and preserved as evidence.
