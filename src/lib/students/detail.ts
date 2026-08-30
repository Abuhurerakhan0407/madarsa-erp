import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenancy/context";

export type StudentDetail = {
  personId: number;
  studentNumber: string;
  admissionNumber: string | null;
  name: string;
  nativeName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  status: string;
  joinedOn: string | null;
  medicalSummary: string | null;
  accessibilityNeeds: string | null;
  pickupRestrictions: string | null;
  program: string;
  group: string;
  guardian: { name: string; relationship: string; phone: string | null } | null;
  attendance: { present: number; absent: number; late: number; excused: number; total: number };
  finance: { invoiced: number; paid: number; outstanding: number; currency: string };
  quranAttempts: number;
  resultCount: number;
};

function label(labels: unknown, locale: string, fallback: string): string {
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) return fallback;
  const map = labels as Record<string, unknown>;
  const value = map[locale] ?? map.en;
  return typeof value === "string" && value.trim() ? value : fallback;
}

export async function getStudentDetail(personId: number, locale: string): Promise<StudentDetail | null> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) throw new Error("Active branch is required.");
  const supabase = await createClient();

  const association = await supabase
    .from("enrollments")
    .select("id")
    .eq("tenant_id", workspace.tenantId)
    .eq("branch_id", workspace.branchId)
    .eq("student_person_id", personId)
    .neq("status", "cancelled")
    .limit(1)
    .maybeSingle();
  if (association.error) throw new Error(`Unable to verify student branch: ${association.error.message}`);
  if (!association.data) return null;

  const [person, profile, enrollment] = await Promise.all([
    supabase.from("persons").select("id,display_name,name_native,date_of_birth,gender").eq("tenant_id", workspace.tenantId).eq("id", personId).maybeSingle(),
    supabase.from("student_profiles").select("person_id,student_number,admission_number,status,joined_on,medical_summary,accessibility_needs,pickup_restrictions").eq("tenant_id", workspace.tenantId).eq("person_id", personId).maybeSingle(),
    supabase.from("enrollments").select("id,program_id,group_id,status").eq("tenant_id", workspace.tenantId).eq("branch_id", workspace.branchId).eq("student_person_id", personId).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle()
  ]);

  if (person.error) throw new Error(`Unable to load student identity: ${person.error.message}`);
  if (profile.error) throw new Error(`Unable to load student profile: ${profile.error.message}`);
  if (enrollment.error) throw new Error(`Unable to load student enrollment: ${enrollment.error.message}`);
  if (!person.data || !profile.data) return null;

  const relationship = await supabase
    .from("person_relationships")
    .select("source_person_id,relationship_type")
    .eq("tenant_id", workspace.tenantId)
    .eq("target_person_id", personId)
    .eq("status", "verified")
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();
  if (relationship.error) throw new Error(`Unable to load guardian relationship: ${relationship.error.message}`);

  const [program, group, attendance, invoices, payments, quran, results] = await Promise.all([
    enrollment.data?.program_id
      ? supabase.from("programs").select("key,labels").eq("tenant_id", workspace.tenantId).eq("id", enrollment.data.program_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    enrollment.data?.group_id
      ? supabase.from("academic_groups").select("key,labels").eq("tenant_id", workspace.tenantId).eq("id", enrollment.data.group_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("attendance_records").select("status_category").eq("tenant_id", workspace.tenantId).eq("person_id", personId),
    supabase.from("fee_invoices").select("total_amount,currency_code,state").eq("tenant_id", workspace.tenantId).eq("student_person_id", personId).neq("state", "cancelled").neq("state", "reversed"),
    supabase.from("payments").select("amount,currency_code,state").eq("tenant_id", workspace.tenantId).eq("student_person_id", personId).in("state", ["verified", "posted"]),
    supabase.from("recitation_attempts").select("id", { count: "exact", head: true }).eq("tenant_id", workspace.tenantId).eq("student_person_id", personId),
    supabase.from("result_snapshots").select("id", { count: "exact", head: true }).eq("tenant_id", workspace.tenantId).eq("student_person_id", personId).in("state", ["approved", "published"])
  ]);

  for (const result of [program, group, attendance, invoices, payments, quran, results]) {
    if (result.error) throw new Error(`Unable to load student workspace detail: ${result.error.message}`);
  }

  let guardian: StudentDetail["guardian"] = null;
  if (relationship.data?.source_person_id) {
    const [guardianPerson, guardianContact] = await Promise.all([
      supabase.from("persons").select("display_name").eq("tenant_id", workspace.tenantId).eq("id", relationship.data.source_person_id).maybeSingle(),
      supabase.from("person_contacts").select("value").eq("tenant_id", workspace.tenantId).eq("person_id", relationship.data.source_person_id).eq("type", "phone").order("is_primary", { ascending: false }).limit(1).maybeSingle()
    ]);
    if (guardianPerson.error) throw new Error(`Unable to load guardian: ${guardianPerson.error.message}`);
    if (guardianContact.error) throw new Error(`Unable to load guardian contact: ${guardianContact.error.message}`);
    if (guardianPerson.data) {
      guardian = { name: guardianPerson.data.display_name, relationship: relationship.data.relationship_type, phone: guardianContact.data?.value ?? null };
    }
  }

  const attendanceRows = attendance.data ?? [];
  const attendanceSummary = {
    present: attendanceRows.filter((row) => row.status_category === "present").length,
    absent: attendanceRows.filter((row) => row.status_category === "absent").length,
    late: attendanceRows.filter((row) => row.status_category === "late").length,
    excused: attendanceRows.filter((row) => row.status_category === "excused" || row.status_category === "leave").length,
    total: attendanceRows.length
  };
  const invoiceRows = invoices.data ?? [];
  const paymentRows = payments.data ?? [];
  const invoiced = invoiceRows.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
  const paid = paymentRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const currency = invoiceRows[0]?.currency_code ?? paymentRows[0]?.currency_code ?? "INR";

  return {
    personId,
    studentNumber: profile.data.student_number,
    admissionNumber: profile.data.admission_number,
    name: person.data.display_name,
    nativeName: person.data.name_native,
    dateOfBirth: person.data.date_of_birth,
    gender: person.data.gender,
    status: profile.data.status,
    joinedOn: profile.data.joined_on,
    medicalSummary: profile.data.medical_summary,
    accessibilityNeeds: profile.data.accessibility_needs,
    pickupRestrictions: profile.data.pickup_restrictions,
    program: program.data ? label(program.data.labels, locale, program.data.key) : "—",
    group: group.data ? label(group.data.labels, locale, group.data.key) : "—",
    guardian,
    attendance: attendanceSummary,
    finance: { invoiced, paid, outstanding: Math.max(invoiced - paid, 0), currency },
    quranAttempts: quran.count ?? 0,
    resultCount: results.count ?? 0
  };
}
