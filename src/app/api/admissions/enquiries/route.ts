import { NextResponse } from "next/server";
import { validateCreateEnquiry } from "@/lib/admissions/enquiry-model";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  const body = await readBoundedJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const validation = validateCreateEnquiry(body.value);
  if (!validation.value) return NextResponse.json({ error: validation.errors[0] ?? "Invalid enquiry." }, { status: 400 });
  const value = validation.value;
  const { data, error } = await createAdminClient().rpc("create_admission_enquiry", {
    p_identity_id: identity.id, p_tenant_id: workspace.tenantId, p_branch_id: workspace.branchId,
    p_session_id: value.sessionId, p_program_id: value.programId, p_applicant_name: value.applicantName,
    p_guardian_name: value.guardianName, p_phone: value.phone, p_email: value.email,
    p_preferred_locale: value.preferredLocale, p_source: value.source, p_consent: value.consent,
    p_notes: value.notes, p_next_follow_up_at: value.nextFollowUpAt
  });
  if (error) {
    if (error.message.includes("permission denied")) return NextResponse.json({ error: "Enquiry management permission required." }, { status: 403 });
    if (error.message.includes("unavailable")) return NextResponse.json({ error: "Academic selection is unavailable." }, { status: 409 });
    return NextResponse.json({ error: "Unable to create enquiry." }, { status: 500 });
  }
  return NextResponse.json({ result: data }, { status: 201, headers: { "cache-control": "no-store" } });
}
