import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,expect,it } from "vitest";

const runtime=readFileSync(resolve(process.cwd(),"supabase/migrations/20260831063000_student_bulk_lifecycle_runtime.sql"),"utf8").toLowerCase();
const hardening=readFileSync(resolve(process.cwd(),"supabase/migrations/20260831063500_student_bulk_lifecycle_hardening.sql"),"utf8").toLowerCase();
const sql=`${runtime}\n${hardening}`;

describe("student bulk lifecycle database contract",()=>{
 it("keeps jobs and job items tenant scoped and service-role only",()=>{
  expect(runtime).toContain("create table if not exists public.student_bulk_operation_jobs");
  expect(runtime).toContain("create table if not exists public.student_bulk_operation_items");
  expect(runtime).toContain("alter table public.student_bulk_operation_jobs enable row level security");
  expect(runtime).toContain("alter table public.student_bulk_operation_items enable row level security");
  expect(runtime).toContain("revoke all on public.student_bulk_operation_jobs,public.student_bulk_operation_items from public,anon,authenticated");
  expect(hardening).toContain("grant usage,select on sequence public.student_bulk_operation_jobs_id_seq to service_role");
 });
 it("reuses the governed direct-student creation runtime and blocks duplicate review cases",()=>{
  expect(runtime).toContain("public.create_student_direct");
  expect(runtime).toContain("duplicate_review_required");
  expect(runtime).toContain("student import supports 1 to 100 rows per batch");
 });
 it("prepares a draft next session and clones branch groups without copying teachers",()=>{
  expect(runtime).toContain("'draft',false");
  expect(runtime).toContain("primary_teacher_person_id,cohort_metadata,status");
  expect(runtime).toContain("g.capacity,null,g.cohort_metadata,'active'");
  expect(runtime).toContain("next academic session must start after the source session ends");
 });
 it("plans rollover instead of closing the current enrollment",()=>{
  expect(runtime).toContain("'planned'");
  expect(runtime).toContain("source_enrollment_id");
  expect(runtime).not.toContain("update public.enrollments set status='completed'");
  expect(hardening).toContain("target session must start after each selected student current session ends");
  expect(hardening).toContain("student-rollover-group:");
 });
 it("prevents duplicate open enrollments in one branch and session",()=>{
  expect(hardening).toContain("enrollments_one_open_record_per_session_idx");
  expect(hardening).toContain("where status <> 'cancelled'");
 });
 it("requires active role definitions for lifecycle permissions",()=>{
  expect(hardening).toContain("join public.roles r");
  expect(hardening).toContain("r.status='active'");
  expect(sql).toContain("students.profile.read");
  expect(sql).toContain("academics.enrollment.manage");
  expect(sql).toContain("academics.structure.manage");
 });
 it("keeps lifecycle functions service-role only",()=>{
  expect(sql).toContain("revoke all on function public.get_student_lifecycle_center_v1");
  expect(sql).toContain("revoke all on function public.import_students_batch_v1");
  expect(sql).toContain("revoke all on function public.plan_student_rollover_batch_v1");
  expect(sql).not.toContain("to authenticated;");
 });
});
