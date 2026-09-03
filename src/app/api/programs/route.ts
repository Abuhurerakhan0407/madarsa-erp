import { NextResponse } from "next/server";
import { validateProgramsSyllabusMutation } from "@/lib/programs-syllabus/model";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

function mapRuntimeError(message: string): { status: number; error: string } {
  const normalized = message.toLowerCase();
  if (normalized.includes("permission denied")) return { status: 403, error: "You do not have permission for this Programs & Syllabus action." };
  if (normalized.includes("already exists")) return { status: 409, error: message };
  if (
    normalized.includes("invalid") ||
    normalized.includes("required") ||
    normalized.includes("select exactly") ||
    normalized.includes("requires") ||
    normalized.includes("must match") ||
    normalized.includes("outside") ||
    normalized.includes("not actively enrolled") ||
    normalized.includes("add at least") ||
    normalized.includes("every curriculum component")
  ) return { status: 400, error: message };
  return { status: 500, error: "Unable to update Programs & Syllabus." };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });

  const parsed = await readBoundedJson(request, 24_576);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const validation = validateProgramsSyllabusMutation(parsed.value);
  if (!validation.value) {
    return NextResponse.json(
      { error: validation.errors[0] ?? "Programs & Syllabus values are invalid.", details: validation.errors },
      { status: 400 }
    );
  }

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id) {
    return NextResponse.json({ error: "Active tenant membership required." }, { status: 403 });
  }
  if (!workspace.branchId) return NextResponse.json({ error: "Active primary branch required." }, { status: 409 });

  const value = validation.value;
  const admin = createAdminClient();
  let rpcName = "";
  let args: Record<string, unknown> = {};

  if (value.action === "create_program") {
    rpcName = "create_teaching_program_v1";
    args = {
      p_identity_id: identity.id,
      p_tenant_id: workspace.tenantId,
      p_branch_id: workspace.branchId,
      p_key: value.key,
      p_labels: value.labels,
      p_descriptions: value.descriptions,
      p_program_type: value.programType,
      p_template_key: value.templateKey
    };
  } else if (value.action === "add_level") {
    rpcName = "add_program_level_v1";
    args = {
      p_identity_id: identity.id,
      p_tenant_id: workspace.tenantId,
      p_branch_id: workspace.branchId,
      p_program_id: value.programId,
      p_key: value.key,
      p_labels: value.labels,
      p_sequence: value.sequence
    };
  } else if (value.action === "add_component") {
    rpcName = "add_curriculum_component_v1";
    args = {
      p_identity_id: identity.id,
      p_tenant_id: workspace.tenantId,
      p_branch_id: workspace.branchId,
      p_program_id: value.programId,
      p_level_id: value.levelId,
      p_subject_key: value.subjectKey,
      p_subject_labels: value.subjectLabels,
      p_subject_type: value.subjectType,
      p_progress_method: value.progressMethod,
      p_unit_structure: value.unitStructure
    };
  } else if (value.action === "add_unit") {
    rpcName = "add_curriculum_unit_v1";
    args = {
      p_identity_id: identity.id,
      p_tenant_id: workspace.tenantId,
      p_branch_id: workspace.branchId,
      p_curriculum_item_id: value.curriculumItemId,
      p_parent_unit_id: value.parentUnitId,
      p_key: value.key,
      p_labels: value.labels,
      p_sequence: value.sequence,
      p_expected_periods: value.expectedPeriods
    };
  } else if (value.action === "publish") {
    rpcName = "publish_program_curriculum_v1";
    args = {
      p_identity_id: identity.id,
      p_tenant_id: workspace.tenantId,
      p_branch_id: workspace.branchId,
      p_program_id: value.programId
    };
  } else if (value.action === "assign") {
    rpcName = "assign_curriculum_teaching_v1";
    args = {
      p_identity_id: identity.id,
      p_tenant_id: workspace.tenantId,
      p_branch_id: workspace.branchId,
      p_session_id: value.sessionId,
      p_curriculum_item_id: value.curriculumItemId,
      p_group_id: value.groupId,
      p_student_person_id: value.studentPersonId,
      p_teacher_person_id: value.teacherPersonId,
      p_evaluation_method: value.evaluationMethod,
      p_starts_on: value.startsOn,
      p_ends_on: value.endsOn
    };
  } else {
    rpcName = "record_student_curriculum_progress_v1";
    args = {
      p_identity_id: identity.id,
      p_tenant_id: workspace.tenantId,
      p_branch_id: workspace.branchId,
      p_assignment_id: value.assignmentId,
      p_student_person_id: value.studentPersonId,
      p_curriculum_unit_id: value.curriculumUnitId,
      p_teacher_person_id: value.teacherPersonId,
      p_state: value.state,
      p_progress_value: value.progressValue,
      p_notes: value.notes
    };
  }

  const { data, error } = await admin.rpc(rpcName, args);
  if (error) {
    const mapped = mapRuntimeError(error.message);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status, headers: { "cache-control": "no-store" } });
  }

  return NextResponse.json(
    { result: data },
    { status: 201, headers: { "cache-control": "no-store" } }
  );
}
