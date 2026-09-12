import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260906141000_phase4_academic_group_create.sql"),
  "utf8"
).toLowerCase();
const route = readFileSync(
  resolve(process.cwd(), "src/app/api/academics/groups/route.ts"),
  "utf8"
).toLowerCase();

describe("Phase 4 academic group creation contract", () => {
  it("uses a security definer function with an empty search path", () => {
    expect(migration).toContain("create or replace function public.create_academic_group_v1");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
  });

  it("requires academic structure permission through the governed resolver", () => {
    expect(migration).toContain("private.resolve_staff_membership");
    expect(migration).toContain("academics.structure.manage");
    expect(migration).toContain("academic structure permission denied");
  });

  it("keeps execution service-role only", () => {
    expect(migration).toContain("revoke all on function public.create_academic_group_v1");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });

  it("requires an active tenant branch", () => {
    expect(migration).toContain("where b.tenant_id = p_tenant_id");
    expect(migration).toContain("and b.id = p_branch_id");
    expect(migration).toContain("active tenant branch required");
  });

  it("scopes session and program to the same tenant", () => {
    expect(migration).toContain("from public.academic_sessions s");
    expect(migration).toContain("s.tenant_id = p_tenant_id");
    expect(migration).toContain("from public.programs p");
    expect(migration).toContain("p.tenant_id = p_tenant_id");
  });

  it("prevents cross-program academic level assignment", () => {
    expect(migration).toContain("from public.academic_levels l");
    expect(migration).toContain("l.program_id = p_program_id");
    expect(migration).toContain("academic level is outside this program");
  });

  it("validates keys, labels, and capacity before insert", () => {
    expect(migration).toContain("academic group key is invalid");
    expect(migration).toContain("academic group labels are invalid");
    expect(migration).toContain("academic group capacity is invalid");
  });

  it("rejects duplicate group keys within the session", () => {
    expect(migration).toContain("g.session_id = p_session_id");
    expect(migration).toContain("academic group key already exists");
  });

  it("writes only to the canonical academic groups model and audits creation", () => {
    expect(migration).toContain("insert into public.academic_groups");
    expect(migration).toContain("academics.group.create");
    expect(migration).not.toContain("create table");
  });

  it("never authorizes from editable user metadata", () => {
    expect(migration).not.toContain("raw_user_meta_data");
    expect(route).not.toContain("raw_user_meta_data");
  });

  it("protects and validates the server route", () => {
    expect(route).toContain("issameoriginrequest(request)");
    expect(route).toContain("isjsonrequest(request)");
    expect(route).toContain("readboundedjson(request");
    expect(route).toContain("getverifiedidentity()");
    expect(route).toContain("gettenantcontext()");
    expect(route).toContain("createadminclient()");
    expect(route).toContain("create_academic_group_v1");
    expect(route).toContain("academic structure permission required");
    expect(route).not.toContain("supabase_secret_key");
  });
});
