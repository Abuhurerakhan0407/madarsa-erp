import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260821032000_live_tenant_bootstrap.sql"
  ),
  "utf8"
).toLowerCase();

describe("live tenant bootstrap migration", () => {
  it("creates tenant ownership atomically", () => {
    expect(sql).toContain("function public.bootstrap_tenant");
    expect(sql).toContain("insert into public.profiles");
    expect(sql).toContain("insert into public.tenants");
    expect(sql).toContain("insert into public.branches");
    expect(sql).toContain("insert into public.memberships");
    expect(sql).toContain("insert into public.roles");
    expect(sql).toContain("insert into public.role_permissions");
    expect(sql).toContain("insert into public.membership_roles");
    expect(sql).toContain("insert into public.audit_events");
  });

  it("keeps bootstrap unavailable to browser roles", () => {
    expect(sql).not.toContain("security definer");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });

  it("gives the initial institution owner current tenant permissions", () => {
    expect(sql).toContain("'institution_owner'");
    expect(sql).toContain("from public.permissions p");
    expect(sql).toContain("'active'");
    expect(sql).toContain("true");
  });
});
