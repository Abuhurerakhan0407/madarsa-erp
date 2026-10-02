import { createHash, randomUUID } from "node:crypto";
import { operatorHasPermissions } from "@/lib/access/operator-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TenantContext } from "@/lib/tenancy/context";

type Raw = Record<string, unknown>;
export type AppOperationalReportKey = "student_master" | "admission_register" | "employee_register";

const columns: Record<AppOperationalReportKey, string[]> = {
  student_master: ["student_number", "name", "gender", "date_of_birth", "program", "class_group", "status", "joined_on"],
  admission_register: ["application_id", "applicant_name", "guardian_name", "program", "state", "submitted_at", "converted_at"],
  employee_register: ["employee_number", "name", "department", "designation", "contract_type", "joined_on", "state", "attendance_today"]
};

export function supportsAppOperationalReport(key: string): key is AppOperationalReportKey {
  return key === "student_master" || key === "admission_register" || key === "employee_register";
}

function label(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function labelMaps(admin: ReturnType<typeof createAdminClient>, tenantId: number, programIds: number[], groupIds: number[]) {
  const [programResult, groupResult] = await Promise.all([
    programIds.length
      ? admin.from("programs").select("id,key,labels").eq("tenant_id", tenantId).in("id", [...new Set(programIds)])
      : Promise.resolve({ data: [], error: null }),
    groupIds.length
      ? admin.from("academic_groups").select("id,key,labels").eq("tenant_id", tenantId).in("id", [...new Set(groupIds)])
      : Promise.resolve({ data: [], error: null })
  ]);
  if (programResult.error) throw new Error(programResult.error.message);
  if (groupResult.error) throw new Error(groupResult.error.message);
  const program = new Map<number, string>();
  const group = new Map<number, string>();
  for (const row of programResult.data ?? []) {
    const labels = row.labels as Raw | null;
    program.set(Number(row.id), label(labels?.en, String(row.key ?? "Program")));
  }
  for (const row of groupResult.data ?? []) {
    const labels = row.labels as Raw | null;
    group.set(Number(row.id), label(labels?.en, String(row.key ?? "Class / group")));
  }
  return { program, group };
}

async function personMap(admin: ReturnType<typeof createAdminClient>, tenantId: number, ids: number[]) {
  if (!ids.length) return new Map<number, Raw>();
  const { data, error } = await admin
    .from("persons")
    .select("id,display_name,gender,date_of_birth")
    .eq("tenant_id", tenantId)
    .in("id", [...new Set(ids)]);
  if (error) throw new Error(error.message);
  return new Map<number, Raw>((data ?? []).map((row) => [Number(row.id), row as Raw]));
}

async function studentMaster(workspace: TenantContext) {
  const admin = createAdminClient();
  const { data: profiles, error: profileError } = await admin
    .from("student_profiles")
    .select("person_id,student_number,joined_on,status")
    .eq("tenant_id", workspace.tenantId);
  if (profileError) throw new Error(profileError.message);
  const personIds = (profiles ?? []).map((row) => Number(row.person_id)).filter(Boolean);
  if (!personIds.length) return [];

  const { data: enrollments, error: enrollmentError } = await admin
    .from("enrollments")
    .select("id,student_person_id,program_id,group_id,starts_on,status")
    .eq("tenant_id", workspace.tenantId)
    .eq("branch_id", workspace.branchId!)
    .in("student_person_id", personIds)
    .neq("status", "cancelled")
    .order("starts_on", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });
  if (enrollmentError) throw new Error(enrollmentError.message);

  const latest = new Map<number, Raw>();
  for (const row of enrollments ?? []) {
    const id = Number(row.student_person_id);
    const existing = latest.get(id);
    if (!existing || (row.status === "active" && existing.status !== "active")) latest.set(id, row as Raw);
  }
  const scoped = (profiles ?? []).filter((row) => latest.has(Number(row.person_id)));
  const people = await personMap(admin, workspace.tenantId, scoped.map((row) => Number(row.person_id)));
  const { program, group } = await labelMaps(
    admin,
    workspace.tenantId,
    [...latest.values()].map((row) => Number(row.program_id)).filter(Boolean),
    [...latest.values()].map((row) => Number(row.group_id)).filter(Boolean)
  );

  return scoped
    .map((profile) => {
      const personId = Number(profile.person_id);
      const person = people.get(personId) ?? {};
      const enrollment = latest.get(personId) ?? {};
      return {
        student_number: label(profile.student_number, ""),
        name: label(person.display_name, "Student"),
        gender: label(person.gender, ""),
        date_of_birth: label(person.date_of_birth, ""),
        program: program.get(Number(enrollment.program_id)) ?? "",
        class_group: group.get(Number(enrollment.group_id)) ?? "",
        status: label(profile.status, ""),
        joined_on: label(profile.joined_on, "")
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.student_number.localeCompare(b.student_number));
}

async function admissionRegister(workspace: TenantContext) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("applications")
    .select("id,program_id,applicant_person_id,guardian_person_id,applicant_data,state,submitted_at,converted_at")
    .eq("tenant_id", workspace.tenantId)
    .eq("branch_id", workspace.branchId!)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });
  if (error) throw new Error(error.message);

  const personIds = (data ?? []).flatMap((row) => [Number(row.applicant_person_id), Number(row.guardian_person_id)]).filter(Boolean);
  const people = await personMap(admin, workspace.tenantId, personIds);
  const { program } = await labelMaps(
    admin,
    workspace.tenantId,
    (data ?? []).map((row) => Number(row.program_id)).filter(Boolean),
    []
  );

  return (data ?? []).map((row) => {
    const applicantData = row.applicant_data && typeof row.applicant_data === "object" && !Array.isArray(row.applicant_data)
      ? row.applicant_data as Raw
      : {};
    return {
      application_id: Number(row.id),
      applicant_name: label(people.get(Number(row.applicant_person_id))?.display_name, label(applicantData.applicant_name, "Applicant")),
      guardian_name: label(people.get(Number(row.guardian_person_id))?.display_name, label(applicantData.guardian_name, "")),
      program: program.get(Number(row.program_id)) ?? "",
      state: label(row.state, ""),
      submitted_at: label(row.submitted_at, ""),
      converted_at: label(row.converted_at, "")
    };
  });
}

async function employeeRegister(workspace: TenantContext) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("hr_employments")
    .select("id,employee_person_id,employee_number,department_key,designation_key,contract_type,starts_on,state")
    .eq("tenant_id", workspace.tenantId)
    .eq("branch_id", workspace.branchId!)
    .order("employee_number", { ascending: true });
  if (error) throw new Error(error.message);

  const employmentIds = (data ?? []).map((row) => Number(row.id)).filter(Boolean);
  const people = await personMap(admin, workspace.tenantId, (data ?? []).map((row) => Number(row.employee_person_id)).filter(Boolean));

  const { data: profile } = await admin.from("institution_profiles").select("timezone").eq("tenant_id", workspace.tenantId).maybeSingle();
  const timezone = typeof profile?.timezone === "string" && profile.timezone.trim() ? profile.timezone : "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;

  const attendance = new Map<number, string>();
  if (employmentIds.length) {
    const { data: marks, error: markError } = await admin
      .from("hr_effective_attendance_v1")
      .select("employment_id,status")
      .eq("tenant_id", workspace.tenantId)
      .eq("attendance_date", today)
      .in("employment_id", employmentIds);
    if (markError) throw new Error(markError.message);
    for (const row of marks ?? []) attendance.set(Number(row.employment_id), label(row.status, ""));
  }

  return (data ?? [])
    .map((row) => ({
      employee_number: label(row.employee_number, ""),
      name: label(people.get(Number(row.employee_person_id))?.display_name, "Employee"),
      department: label(row.department_key, ""),
      designation: label(row.designation_key, ""),
      contract_type: label(row.contract_type, ""),
      joined_on: label(row.starts_on, ""),
      state: label(row.state, ""),
      attendance_today: attendance.get(Number(row.id)) ?? ""
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.employee_number.localeCompare(b.employee_number));
}

export async function runAppOperationalReport(input: {
  workspace: TenantContext;
  reportKey: AppOperationalReportKey;
  parameters: Raw;
  outputFormat: "screen" | "csv" | "json";
  requestKey: string;
}) {
  const { workspace, reportKey, parameters, outputFormat, requestKey } = input;
  if (!(await operatorHasPermissions(workspace, ["report.run.execute"]))) {
    throw new Error("report execution permission denied");
  }

  const admin = createAdminClient();
  const { data: definition, error: definitionError } = await admin
    .from("report_definitions")
    .select("id,key,labels")
    .eq("tenant_id", workspace.tenantId)
    .eq("key", reportKey)
    .eq("state", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (definitionError) throw new Error(definitionError.message);
  if (!definition) throw new Error("published report definition not found");

  let rows: Raw[];
  if (reportKey === "student_master") rows = await studentMaster(workspace);
  else if (reportKey === "admission_register") rows = await admissionRegister(workspace);
  else rows = await employeeRegister(workspace);

  const digest = createHash("md5").update(JSON.stringify(rows)).digest("hex");
  let runId = 0;
  const { data: existing } = await admin
    .from("report_runs")
    .select("id")
    .eq("tenant_id", workspace.tenantId)
    .eq("idempotency_key", requestKey)
    .maybeSingle();

  if (existing?.id) {
    runId = Number(existing.id);
  } else {
    const { data: inserted, error: insertError } = await admin
      .from("report_runs")
      .insert({
        tenant_id: workspace.tenantId,
        report_definition_id: Number(definition.id),
        parameters,
        scope_snapshot: { branch_id: workspace.branchId },
        output_format: outputFormat,
        state: "completed",
        row_count: rows.length,
        output_digest: digest,
        requested_by_membership_id: workspace.membershipId,
        idempotency_key: requestKey,
        completed_at: new Date().toISOString()
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);
    runId = Number(inserted.id);

    await admin.from("audit_events").insert({
      tenant_id: workspace.tenantId,
      branch_id: workspace.branchId,
      actor_identity_id: workspace.identityId,
      actor_membership_id: workspace.membershipId,
      action: "report.run.execute",
      outcome: "succeeded",
      entity_type: "report_run",
      entity_id: String(runId),
      correlation_id: randomUUID(),
      after_state: { report_key: reportKey, output_format: outputFormat, row_count: rows.length }
    });
  }

  return {
    run_id: runId,
    report_key: reportKey,
    labels: definition.labels ?? {},
    columns: columns[reportKey],
    rows,
    row_count: rows.length,
    parameters,
    output_format: outputFormat
  };
}
