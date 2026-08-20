import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "database/contracts/phase2_tenancy.sql"),
  "utf8"
).toLowerCase();

const storageSql = readFileSync(
  resolve(process.cwd(), "database/contracts/phase2_storage.sql"),
  "utf8"
).toLowerCase();

const tenantTables = [
  "profiles",
  "tenants",
  "branches",
  "tenant_lifecycle_events",
  "memberships",
  "roles",
  "role_permissions",
  "membership_roles",
  "membership_branch_scopes",
  "scope_bindings",
  "delegations",
  "access_relationships",
  "audit_events",
  "security_events"
] as const;

describe("Phase 2 tenancy database contract", () => {
  it("defines the tenant and authorization model", () => {
    for (const table of [...tenantTables, "permissions"] as const) {
      expect(sql).toContain(`create table public.${table}`);
    }

    expect(sql).toContain("foreign key (tenant_id, branch_id)");
    expect(sql).toContain("foreign key (tenant_id, membership_id)");
    expect(sql).toContain("foreign key (tenant_id, role_id)");
  });

  it("enables and forces RLS on every exposed table", () => {
    for (const table of [...tenantTables, "permissions"] as const) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
    }
  });

  it("keeps privileged helpers outside the exposed schema", () => {
    expect(sql).toContain("create schema if not exists private");
    expect(sql).toContain("function private.has_tenant_membership");
    expect(sql).toContain("function private.has_permission");
    expect(sql).toContain("function private.has_relationship");
    expect(sql).toContain("security definer\nset search_path = ''");
    expect(sql).not.toMatch(/function\s+public\.[\s\S]{0,160}security definer/);
  });

  it("uses authenticated identity and avoids anonymous grants", () => {
    expect(sql).toContain("(select auth.uid())");
    expect(sql).not.toMatch(/grant\s+(?:select|insert|update|delete|all)[\s\S]{0,180}\s+to\s+anon/);
    expect(sql).toContain("revoke all on all tables in schema public from anon");
    expect(sql).toContain("to authenticated");
  });

  it("denies direct browser writes and exposes only scoped reads", () => {
    expect(sql).toContain("revoke insert, update, delete, truncate, references, trigger");
    expect(sql).not.toMatch(/create policy[\s\S]{0,120}for (?:insert|update|delete)/);
    expect(sql).toContain("audit_events_select_auditor");
    expect(sql).toContain("security.audit.read");
    expect(sql).toContain("audit_events_append_only");
    expect(sql).toContain("security_events_append_only");
    expect(sql).toContain("tenant_lifecycle_events_append_only");
    expect(sql).toContain("enforce_immutable_tenant_id");
    expect(sql).toContain("tenants_enforce_transition");
  });

  it("indexes tenant, membership, branch, and audit predicates", () => {
    expect(sql).toContain("branches_tenant_status_idx");
    expect(sql).toContain("tenant_lifecycle_events_tenant_occurred_idx");
    expect(sql).toContain("memberships_identity_status_idx");
    expect(sql).toContain("membership_branch_scopes_branch_idx");
    expect(sql).toContain("delegations_recipient_active_idx");
    expect(sql).toContain("access_relationships_identity_idx");
    expect(sql).toContain("audit_events_tenant_occurred_idx");
    expect(sql).toContain("audit_events_correlation_idx");
  });

  it("scopes private storage objects by tenant and permission", () => {
    expect(storageSql).toContain("insert into storage.buckets");
    expect(storageSql).toContain("'tenant-documents'");
    expect(storageSql).toContain("false");
    expect(storageSql).toContain("26214400");
    expect(storageSql).toContain("on storage.objects for select to authenticated");
    expect(storageSql).toContain("on storage.objects for insert to authenticated");
    expect(storageSql).toContain("on storage.objects for update to authenticated");
    expect(storageSql).toContain("on storage.objects for delete to authenticated");
    expect(storageSql).toContain("private.storage_tenant_id(name)");
    expect(storageSql).toContain("documents.file.read");
    expect(storageSql).toContain("documents.file.manage");
    expect(storageSql).not.toMatch(/create\s+(?:table|view|schema)\s+storage\./);
  });
});
