import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";

const sql=readFileSync(resolve(process.cwd(),"supabase/migrations/20260912014000_master_audit_legacy_mutation_authorization.sql"),"utf8");

const allPermissionTargets=[
  "approve_exam_results_v1",
  "calculate_exam_results_v1",
  "configure_whatsapp_channel_v1",
  "create_exam_series_v1",
  "create_exam_series_v2",
  "create_hr_employee_v1",
  "create_student_direct",
  "decide_hr_leave_v1",
  "import_students_batch_core_v1",
  "moderate_exam_mark_v1",
  "plan_student_rollover_batch_core_v1",
  "prepare_next_academic_session_core_v1",
  "publish_exam_results_v1",
  "queue_guardian_whatsapp_v1",
  "record_exam_mark_v1",
  "record_hr_attendance_v1",
  "submit_hr_leave_v1",
  "update_hr_employee_v1",
  "update_student_core",
  "upsert_guardian_whatsapp_template_v1"
];

const anyPermissionTargets=[
  "map_attendance_device_subject_v1",
  "rotate_attendance_device_token_v1",
  "set_guardian_whatsapp_consent_v1"
];

describe("master audit legacy mutation authorization gates",()=>{
  it("uses the canonical active-role permission resolver",()=>{
    expect(sql).toContain("public.operator_has_permission_v1");
    expect(sql).toContain("private.operator_has_all_permissions_v1");
    expect(sql).toContain("private.operator_has_any_permission_v1");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path to ''");
  });

  it("wraps every identified launch-relevant mutation surface",()=>{
    for(const target of allPermissionTargets){
      expect(sql, target).toContain(`('${target}',`);
    }
    for(const target of anyPermissionTargets){
      expect(sql, target).toContain(`('${target}',`);
    }
    expect(new Set([...allPermissionTargets,...anyPermissionTargets]).size).toBe(23);
  });

  it("requires all permissions for multi-capability student mutations",()=>{
    expect(sql).toContain("array['people.person.manage','students.profile.update','academics.enrollment.manage']::text[], 'all'");
    expect(sql).toContain("array['academics.enrollment.manage','students.profile.read']::text[], 'all'");
    expect(sql).toContain("array['people.person.manage','students.profile.update']::text[], 'all'");
  });

  it("makes preserved legacy implementations non-callable by API roles",()=>{
    expect(sql).toContain("__phase0_legacy_");
    expect(sql).toContain("from public, anon, authenticated, service_role");
    expect(sql).toContain("grant execute on function public.%I(%s) to service_role");
  });

  it("uses subject-specific active permission for emergency attendance revocation",()=>{
    expect(sql).toContain("when 'student' then 'attendance.student.approve'");
    expect(sql).toContain("when 'staff' then 'hr.employee.manage'");
    expect(sql).toContain("__phase0_legacy_revoke_emergency_manual_attendance_v1");
    expect(sql).toContain("where a.tenant_id = p_tenant_id");
    expect(sql).toContain("and a.branch_id = p_branch_id");
  });

  it("does not wrap bootstrap_tenant because initial tenant creation has no pre-existing tenant role",()=>{
    expect(sql).not.toContain("('bootstrap_tenant',");
  });
});
