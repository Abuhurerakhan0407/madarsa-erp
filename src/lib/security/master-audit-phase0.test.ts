import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";

const read=(path:string)=>readFileSync(resolve(process.cwd(),path),"utf8");
const migration=read("supabase/migrations/20260912011500_master_audit_phase0_security_hardening.sql");
const classScope=read("supabase/migrations/20260912012500_master_audit_class_scope_hardening.sql");
const credentials=read("src/app/api/portals/credentials/route.ts");

describe("master audit Phase 0 security invariants",()=>{
  it("does not let institution operators overwrite global Auth credentials or auto-link an existing identity",()=>{
    expect(credentials).not.toContain("updateUserById");
    expect(credentials).toContain("owner_claim_required");
    expect(credentials).toContain("account owner must use verified account recovery");
    expect(credentials).toContain("account owner must claim this institution");
  });

  it("replaces tenant-wide NULL-branch read checks with row-derived branch scope",()=>{
    expect(migration).toContain("person_branch_read_allowed_v1");
    expect(migration).toContain("student_profile_branch_read_allowed_v1");
    expect(migration).toContain("attendance_record_branch_read_allowed_v1");
    expect(migration).toContain("mark_entry_branch_read_allowed_v1");
    expect(migration).not.toMatch(/has_permission\([^\n]+NULL::bigint/i);
    expect(migration).toContain("private.has_permission(p_tenant_id, 'students.profile.read', e.branch_id)");
    expect(migration).toContain("private.has_permission(p_tenant_id, 'assessment.marks.read', e.branch_id)");
  });

  it("restricts teacher-level sensitive reads to assigned students/classes",()=>{
    expect(classScope).toContain("identity_assigned_teacher_for_student_v1");
    expect(classScope).toContain("g.primary_teacher_person_id = ipl.person_id");
    expect(classScope).toContain("te.teacher_person_id = ipl.person_id");
    expect(classScope).toContain("te.group_id = e.group_id");
    expect(classScope).toContain("students.profile.update");
    expect(classScope).toContain("attendance.student.approve");
    expect(classScope).toContain("assessment.marks.moderate");
    expect(classScope).toContain("ms.evaluator_person_id");
  });

  it("requires portal access-state targets to be eligible in the actor branch",()=>{
    expect(migration).toContain("guardian is not portal-eligible in this branch");
    expect(migration).toContain("employee is not portal-eligible in this branch");
    expect(migration).toContain("e.branch_id = p_branch_id");
    expect(migration).toContain("he.branch_id = p_branch_id");
  });

  it("authorizes device apply before mutation and preserves events on permission denial",()=>{
    expect(migration).toContain("v_required_permission := 'attendance.student.mark'");
    expect(migration).toContain("v_required_permission := 'hr.employee.manage'");
    expect(migration).toContain("if not public.operator_has_permission_v1");
    expect(migration).toMatch(/permission denied'% or sqlerrm ilike '%active membership required%' then\s+raise;/i);
  });

  it("uses the centralized active-role permission resolver for legacy mutations",()=>{
    expect(migration).toContain("operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hr.employee.manage')");
    expect(migration).toContain("operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'notification.message.send')");
    expect(migration).toContain("m.starts_at is null or m.starts_at<=now()");
    expect(migration).toContain("m.ends_at is null or m.ends_at>now()");
  });
});
