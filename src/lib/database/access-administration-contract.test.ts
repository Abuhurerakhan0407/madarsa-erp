import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,expect,it } from "vitest";

const sql=readFileSync(resolve(process.cwd(),"supabase/migrations/20260831090000_access_administration_runtime.sql"),"utf8").toLowerCase();

describe("access administration runtime contract",()=>{
 it("requires the dedicated roles-management permission through active roles",()=>{
  expect(sql).toContain("settings.roles.manage");
  expect(sql).toContain("r.status='active'");
  expect(sql).toContain("access administration permission denied");
 });
 it("never mutates system roles through the custom-role functions",()=>{
  expect(sql).toContain("and not r.is_system");
  expect(sql).toContain("custom role required");
  expect(sql).toContain("active custom role required");
 });
 it("prevents the current administrator from shrinking their own branch scope",()=>{
  expect(sql).toContain("if v_target_identity=p_identity_id");
  expect(sql).toContain("current administrator branch scope cannot be changed here");
 });
 it("validates permission codes and branch scopes before replacement",()=>{
  expect(sql).toContain("unknown permission code supplied");
  expect(sql).toContain("invalid or inactive branch scope");
  expect(sql).toContain("at least one branch scope is required");
 });
 it("does not create identities, memberships, or branches",()=>{
  expect(sql).not.toContain("insert into public.memberships");
  expect(sql).not.toContain("insert into public.branches");
  expect(sql).not.toContain("auth.users");
 });
 it("records access mutations in the audit trail",()=>{
  expect(sql).toContain("settings.role.create");
  expect(sql).toContain("settings.role.permissions.set");
  expect(sql).toContain("settings.membership.custom_role.set");
  expect(sql).toContain("settings.membership.branch_scope.set");
 });
 it("keeps every access runtime service-role only",()=>{
  expect(sql).toContain("revoke all on function public.get_access_administration_center_v1");
  expect(sql).toContain("grant execute on function public.get_access_administration_center_v1");
  expect(sql).not.toContain("to authenticated;");
  expect(sql).toContain("set search_path to pg_catalog,extensions");
 });
});
