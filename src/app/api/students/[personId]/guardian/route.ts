import { NextResponse } from "next/server";
import { operatorHasPermissions } from "@/lib/access/operator-permission";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";
import { validateStudentGuardianInput } from "@/lib/students/guardian-model";

export async function GET(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "cache-control": "no-store" } });
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId || workspace.identityId !== identity.id) {
    return NextResponse.json({ error: "Active branch membership required." }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  if (!(await operatorHasPermissions(workspace, ["people.person.manage", "students.profile.update"]))) {
    return NextResponse.json({ error: "Guardian management permission required." }, { status: 403, headers: { "cache-control": "no-store" } });
  }

  const studentPersonId = Number((await params).personId);
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 160) ?? "";
  if (!Number.isInteger(studentPersonId) || studentPersonId <= 0) {
    return NextResponse.json({ error: "Invalid student." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  if (query.length < 2) {
    return NextResponse.json({ guardians: [] }, { headers: { "cache-control": "no-store" } });
  }

  const admin = createAdminClient();
  const student = await admin
    .from("student_profiles")
    .select("person_id")
    .eq("tenant_id", workspace.tenantId)
    .eq("person_id", studentPersonId)
    .maybeSingle();
  if (student.error || !student.data) {
    return NextResponse.json({ error: "Student is not available in this branch." }, { status: 404, headers: { "cache-control": "no-store" } });
  }
  const enrollment = await admin
    .from("enrollments")
    .select("student_person_id")
    .eq("tenant_id", workspace.tenantId)
    .eq("branch_id", workspace.branchId)
    .eq("student_person_id", studentPersonId)
    .in("status", ["active", "paused"])
    .limit(1);
  if (enrollment.error || !enrollment.data?.length) {
    return NextResponse.json({ error: "Student is not available in this branch." }, { status: 404, headers: { "cache-control": "no-store" } });
  }

  const people = await admin
    .from("persons")
    .select("id,display_name")
    .eq("tenant_id", workspace.tenantId)
    .ilike("display_name", "%" + query + "%")
    .eq("status", "active")
    .order("display_name", { ascending: true })
    .limit(30);
  if (people.error) return NextResponse.json({ error: "Unable to search guardians." }, { status: 503, headers: { "cache-control": "no-store" } });

  const personIds = (people.data ?? []).map((row) => Number(row.id)).filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!personIds.length) return NextResponse.json({ guardians: [] }, { headers: { "cache-control": "no-store" } });

  const profiles = await admin
    .from("guardian_profiles")
    .select("person_id")
    .eq("tenant_id", workspace.tenantId)
    .in("person_id", personIds);
  if (profiles.error) return NextResponse.json({ error: "Unable to search guardians." }, { status: 503, headers: { "cache-control": "no-store" } });

  const guardianIds = (profiles.data ?? []).map((row) => Number(row.person_id)).filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!guardianIds.length) return NextResponse.json({ guardians: [] }, { headers: { "cache-control": "no-store" } });

  const [guardianDetails, guardianPhones] = await Promise.all([
    admin.from("guardian_profiles").select("person_id,occupation,education").eq("tenant_id", workspace.tenantId).in("person_id", guardianIds),
    admin.from("person_contacts").select("person_id,value,is_primary").eq("tenant_id", workspace.tenantId).eq("type", "phone").in("person_id", guardianIds).order("is_primary", { ascending: false })
  ]);
  if (guardianDetails.error || guardianPhones.error) {
    return NextResponse.json({ error: "Unable to load guardian details." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const profileMap = new Map((guardianDetails.data ?? []).map((row) => [Number(row.person_id), row]));
  const phoneMap = new Map<number, string>();
  for (const row of guardianPhones.data ?? []) {
    const id = Number(row.person_id);
    if (!phoneMap.has(id)) phoneMap.set(id, row.value);
  }

  const relationships = await admin
    .from("person_relationships")
    .select("source_person_id,target_person_id,relationship_type,is_primary,can_collect_student")
    .eq("tenant_id", workspace.tenantId)
    .eq("status", "verified")
    .in("source_person_id", guardianIds);
  if (relationships.error) return NextResponse.json({ error: "Unable to load guardian links." }, { status: 503, headers: { "cache-control": "no-store" } });

  const targetIds = [...new Set((relationships.data ?? []).map((row) => Number(row.target_person_id)).filter((id) => Number.isSafeInteger(id) && id > 0))];
  const branchEnrollments = targetIds.length
    ? await admin
        .from("enrollments")
        .select("student_person_id,group_id")
        .eq("tenant_id", workspace.tenantId)
        .eq("branch_id", workspace.branchId)
        .in("student_person_id", targetIds)
        .in("status", ["active", "paused"])
    : { data: [], error: null };
  if (branchEnrollments.error) return NextResponse.json({ error: "Unable to load guardian children." }, { status: 503, headers: { "cache-control": "no-store" } });

  const childIds = [...new Set((branchEnrollments.data ?? []).map((row) => Number(row.student_person_id)).filter((id) => Number.isSafeInteger(id) && id > 0))];
  const childPersons = childIds.length
    ? await admin.from("persons").select("id,display_name").eq("tenant_id", workspace.tenantId).in("id", childIds)
    : { data: [], error: null };
  if (childPersons.error) return NextResponse.json({ error: "Unable to load guardian children." }, { status: 503, headers: { "cache-control": "no-store" } });

  const childNameMap = new Map((childPersons.data ?? []).map((row) => [Number(row.id), row.display_name]));
  const enrolledSet = new Set(childIds);

  const guardians = guardianIds.flatMap((guardianId) => {
    const person = (people.data ?? []).find((row) => Number(row.id) === guardianId);
    if (!person) return [];
    const rels = (relationships.data ?? []).filter((row) =>
      Number(row.source_person_id) === guardianId && enrolledSet.has(Number(row.target_person_id))
    );
    const children = [...new Set(rels.map((row) => childNameMap.get(Number(row.target_person_id))).filter((name): name is string => Boolean(name)))];
    const currentRel = (relationships.data ?? []).find((row) =>
      Number(row.source_person_id) === guardianId && Number(row.target_person_id) === studentPersonId
    );
    const otherRel = rels.find(Boolean);
    const profile = profileMap.get(guardianId);
    return [{
      personId: guardianId,
      name: person.display_name,
      relationship: currentRel?.relationship_type ?? otherRel?.relationship_type ?? "guardian",
      phone: phoneMap.get(guardianId) ?? null,
      occupation: profile?.occupation ?? null,
      education: profile?.education ?? null,
      canCollect: currentRel?.can_collect_student !== false,
      children
    }];
  });

  return NextResponse.json({ guardians }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 8192) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });

  const personId = Number((await params).personId);
  if (!Number.isInteger(personId) || personId <= 0) return NextResponse.json({ error: "Invalid student." }, { status: 400 });
  const parsedBody = await readBoundedJson(request, 8_192);
  if (!parsedBody.ok) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  const body = parsedBody.value;
  const validation = validateStudentGuardianInput(body);
  if (!validation.value) return NextResponse.json({ error: validation.errors[0] || "Invalid guardian details.", details: validation.errors }, { status: 400 });

  const value = validation.value;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("upsert_student_primary_guardian_v2", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_student_person_id: personId,
    p_name: value.name,
    p_relationship: value.relationship,
    p_phone: value.phone ?? null,
    p_occupation: value.occupation ?? null,
    p_education: value.education ?? null,
    p_can_collect: value.canCollect,
    p_guardian_person_id: value.guardianPersonId ?? null
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) return NextResponse.json({ error: "Guardian management permission required." }, { status: 403 });
    if (message.includes("not available")) return NextResponse.json({ error: "Student is not available in this branch." }, { status: 404 });
    if (message.includes("selected guardian")) return NextResponse.json({ error: "Selected guardian is not available." }, { status: 422 });
    if (message.includes("guardian name") || message.includes("relationship") || message.includes("phone") || message.includes("occupation") || message.includes("education")) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ error: "Unable to update guardian details." }, { status: 500 });
  }

  return NextResponse.json({ result: data }, { status: 200, headers: { "cache-control": "no-store" } });
}
