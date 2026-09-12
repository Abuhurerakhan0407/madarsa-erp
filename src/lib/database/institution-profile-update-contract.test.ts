import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260906140000_phase4_institution_profile_update.sql"),
  "utf8"
).toLowerCase();
const route = readFileSync(
  resolve(process.cwd(), "src/app/api/institution/profile/route.ts"),
  "utf8"
).toLowerCase();

describe("Phase 4 institution profile update contract", () => {
  it("uses a security definer function with an empty search path", () => {
    expect(migration).toContain("create or replace function public.update_institution_profile_v1");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
  });

  it("requires the governed tenant-management permission", () => {
    expect(migration).toContain("private.resolve_staff_membership");
    expect(migration).toContain("settings.tenant.manage");
    expect(migration).toContain("institution profile permission denied");
  });

  it("keeps execution service-role only", () => {
    expect(migration).toContain("revoke all on function public.update_institution_profile_v1");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });

  it("validates the active branch and tenant-scoped profile", () => {
    expect(migration).toContain("where b.tenant_id = p_tenant_id");
    expect(migration).toContain("and b.id = p_branch_id");
    expect(migration).toContain("where ip.tenant_id = p_tenant_id");
  });

  it("validates timezone and locale constraints", () => {
    expect(migration).toContain("pg_catalog.pg_timezone_names");
    expect(migration).toContain("primary locale is invalid");
    expect(migration).toContain("supported locales are invalid");
    expect(migration).toContain("primary locale must be included in supported locales");
  });

  it("updates only the canonical institution and tenant records", () => {
    expect(migration).toContain("update public.institution_profiles");
    expect(migration).toContain("update public.tenants");
    expect(migration).not.toContain("insert into public.institution_profiles");
  });

  it("records an auditable before and after state", () => {
    expect(migration).toContain("settings.institution_profile.update");
    expect(migration).toContain("before_state");
    expect(migration).toContain("after_state");
  });

  it("never authorizes from editable user metadata", () => {
    expect(migration).not.toContain("raw_user_meta_data");
    expect(route).not.toContain("raw_user_meta_data");
  });

  it("protects the server route with identity, tenant, and same-origin checks", () => {
    expect(route).toContain("issameoriginrequest(request)");
    expect(route).toContain("getverifiedidentity()");
    expect(route).toContain("gettenantcontext()");
    expect(route).toContain("createadminclient()");
  });

  it("bounds JSON and maps permission failures without leaking the secret", () => {
    expect(route).toContain("readboundedjson(request");
    expect(route).toContain("institution settings permission required");
    expect(route).toContain("cache-control");
    expect(route).not.toContain("supabase_secret_key");
  });
});
