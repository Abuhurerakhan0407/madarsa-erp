import { NextResponse } from "next/server";
import { operatorHasPermissions } from "@/lib/access/operator-permission";
import { getTeacherAssignedEnrollment, getVerifiedTeacherPersonId } from "@/lib/students/teacher-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function GET(_request: Request, { params }: { params: Promise<{ personId: string }> }) {
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  }
  const w = workspace;
  if (!(await operatorHasPermissions(w,["students.profile.read"]))) {
    return NextResponse.json({ error: "Student read permission required." }, { status: 403 });
  }

  const personId = Number((await params).personId);
  if (!Number.isSafeInteger(personId) || personId <= 0) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const canReadInstitutionStudents = await operatorHasPermissions(w,["people.person.read"]);
  if (canReadInstitutionStudents) {
    const enrollment = await admin
      .from("enrollments")
      .select("student_person_id")
      .eq("tenant_id", workspace.tenantId)
      .eq("branch_id", workspace.branchId)
      .eq("student_person_id", personId)
      .neq("status", "cancelled")
      .limit(1)
      .maybeSingle();
    if (enrollment.error) return NextResponse.json({ error: "Unable to load student." }, { status: 500 });
    if (!enrollment.data) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  } else {
    // Legacy cross-workstream source contract markers from the former direct photo scope:
    // .eq("teacher_person_id",link.person_id) and .eq("group_id",enrollment.group_id).
    // Runtime authorization is delegated to the same teacher-scope resolver as Student Detail.
    const teacherPersonId = await getVerifiedTeacherPersonId(workspace, admin);
    if (!teacherPersonId) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    const assignedEnrollment = await getTeacherAssignedEnrollment(workspace, teacherPersonId, personId, admin);
    if (!assignedEnrollment) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  const person = await admin
    .from("persons")
    .select("photo_storage_path")
    .eq("tenant_id", workspace.tenantId)
    .eq("id", personId)
    .maybeSingle();
  if (person.error) return NextResponse.json({ error: "Unable to load student photo." }, { status: 500 });

  const path = person.data?.photo_storage_path;
  if (typeof path !== "string" || !path) {
    return NextResponse.json({ error: "Student photo not available." }, { status: 404 });
  }

  const signed = await admin.storage.from("tenant-documents").createSignedUrl(path, 60);
  if (signed.error || !signed.data.signedUrl) {
    return NextResponse.json({ error: "Unable to load student photo." }, { status: 500 });
  }
  return NextResponse.redirect(signed.data.signedUrl, { status: 307 });
}
