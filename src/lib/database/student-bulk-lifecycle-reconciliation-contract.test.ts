import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,expect,it } from "vitest";

const sql=readFileSync(resolve(process.cwd(),"supabase/migrations/20260831064000_student_bulk_lifecycle_reconciliation.sql"),"utf8").toLowerCase();

describe("student lifecycle wrapper reconciliation",()=>{
 it("requires all tested core runtimes before replacing public wrappers",()=>{
  expect(sql).toContain("to_regprocedure('public.get_student_lifecycle_center_core_v1");
  expect(sql).toContain("to_regprocedure('public.prepare_next_academic_session_core_v1");
  expect(sql).toContain("to_regprocedure('public.import_students_batch_core_v1");
  expect(sql).toContain("to_regprocedure('public.plan_student_rollover_batch_core_v1");
  expect(sql).toContain("student lifecycle core runtime is incomplete");
 });
 it("reinstalls public wrappers through the active-role membership resolver",()=>{
  expect(sql).toContain("create or replace function public.get_student_lifecycle_center_v1");
  expect(sql).toContain("create or replace function public.prepare_next_academic_session_v1");
  expect(sql).toContain("create or replace function public.import_students_batch_v1");
  expect(sql).toContain("create or replace function public.plan_student_rollover_batch_v1");
  expect(sql.match(/resolve_student_lifecycle_membership_v1/g)?.length).toBeGreaterThanOrEqual(4);
  expect(sql).toContain("target session must start after each selected student current session ends");
  expect(sql).toContain("student-rollover-group:");
 });
 it("keeps both core and public functions server-only",()=>{
  expect(sql).toContain("revoke all on function public.get_student_lifecycle_center_core_v1");
  expect(sql).toContain("revoke all on function public.get_student_lifecycle_center_v1");
  expect(sql).not.toContain("to authenticated;");
  expect(sql).toContain("to service_role;");
 });
 it("does not rename or delete the already-migrated cores",()=>{
  expect(sql).not.toContain("rename to");
  expect(sql).not.toContain("drop function");
 });
});
