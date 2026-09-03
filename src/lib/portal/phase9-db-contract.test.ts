import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";
const read=(path:string)=>readFileSync(resolve(process.cwd(),path),"utf8");
const access=read("supabase/migrations/20260903170000_phase9_teachers_portal_access.sql");
const teacher=read("supabase/migrations/20260903173000_phase9_teacher_profile_update.sql");
const parent=read("supabase/migrations/20260903180000_phase9_parent_portal_overview.sql");
const schedule=read("supabase/migrations/20260903180500_phase9_parent_schedule_resolution.sql");
const audit=read("supabase/migrations/20260903181000_phase9_portal_home_and_credential_audit.sql");
const contact=read("supabase/migrations/20260903181500_phase9_teacher_contact_hardening.sql");
const metadata=read("supabase/migrations/20260903184500_phase9_portal_app_metadata_hardening.sql");

describe("Phase 9 Teachers + Parent/Teacher Access database contracts",()=>{
 it("keeps all Phase 9 entrypoints server-only",()=>{
  for(const sql of [access,teacher,parent,schedule,audit,contact,metadata]){expect(sql).toContain("revoke all on function");expect(sql).toMatch(/from public,anon,authenticated/i);expect(sql).toMatch(/grant execute on function[\s\S]*to service_role/i);}
 });
 it("preserves tenant-scoped access disable instead of globally banning Auth users",()=>{
  expect(access).toContain("set_portal_identity_access_v1");expect(access).toContain("identity_person_links");expect(access).toContain("status=case when p_enabled then 'verified' else 'revoked' end");expect(access).not.toContain("banned_until");
 });
 it("trusts only admin-controlled Auth app metadata for ERP-managed account state",()=>{
  expect(access).toContain("raw_app_meta_data");expect(access).not.toContain("raw_user_meta_data");expect(metadata).toContain("raw_app_meta_data");expect(metadata).not.toContain("raw_user_meta_data");
 });
 it("resolves parent schedule using Phase 5 closures and exception semantics",()=>{
  expect(schedule).toContain("academic_schedule_exceptions");expect(schedule).toContain("x.action='reschedule'");expect(schedule).toContain("x.action='substitute'");expect(schedule).toContain("event_type in('holiday','closure')");expect(schedule).toContain("affects_attendance");expect(schedule).toContain("x.id is null or x.action='substitute'");
 });
 it("audits credential create/reset without accepting credential secrets",()=>{
  expect(audit).toContain("record_portal_credential_audit_v1");expect(audit).toContain("portal.credentials.create");expect(audit).toContain("portal.credentials.reset");expect(audit).not.toMatch(/p_password|p_temporary_password|temporaryPassword/);
 });
 it("keeps the Teachers editor intentionally outside payroll/private HR",()=>{
  expect(contact).toContain("hr.employee.manage");expect(contact).toContain("teacher.profile.update");expect(contact).toContain("delete from public.person_contacts");expect(contact).not.toContain("payroll_eligible");expect(contact).not.toContain("qualification_summary");
 });
});
