import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,expect,it } from "vitest";

const sql=readFileSync(resolve(process.cwd(),"supabase/migrations/20260831073000_library_circulation_runtime.sql"),"utf8").toLowerCase();

describe("library circulation runtime contract",()=>{
 it("reuses the phase-11 library schema rather than creating duplicate tables",()=>{
  expect(sql).not.toContain("create table public.library_titles");
  expect(sql).not.toContain("create table public.library_copies");
  expect(sql).not.toContain("create table public.library_loans");
  expect(sql).toContain("public.library_titles");expect(sql).toContain("public.library_copies");expect(sql).toContain("public.library_loans");
 });
 it("enforces branch-scoped library permission",()=>{
  expect(sql).toContain("library.loan.manage");
  expect(sql).toContain("membership_branch_scopes");
  expect(sql).toContain("library circulation permission denied");
 });
 it("keeps borrower eligibility scoped to active students or staff in the branch",()=>{
  expect(sql).toContain("student_person_id=p_borrower_person_id");
  expect(sql).toContain("employee_person_id=p_borrower_person_id");
  expect(sql).toContain("borrower is not active in this branch");
 });
 it("serializes copy issuance and changes copy state",()=>{
  expect(sql).toContain("for update");
  expect(sql).toContain("if v_copy.state<>'available'");
  expect(sql).toContain("update public.library_copies set state='issued'");
 });
 it("records issue and return actions in the audit trail",()=>{
  expect(sql).toContain("'library.loan.issue'");expect(sql).toContain("'library.loan.return'");expect(sql).toContain("public.audit_events");
 });
 it("keeps all library runtime functions service-role only",()=>{
  expect(sql).toContain("revoke all on function public.get_library_center_v1");
  expect(sql).toContain("grant execute on function public.get_library_center_v1");
  expect(sql).not.toContain("to authenticated;");
  expect(sql).toContain("set search_path to pg_catalog,extensions");
 });
});
