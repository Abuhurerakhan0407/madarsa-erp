import { NextResponse } from "next/server";
import { validateEmployeeInput } from "@/lib/hr/model";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const parsed = await readBoundedJson(request, 8192); if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value) ? parsed.value as Record<string, unknown> : {};
  const identity = await getVerifiedIdentity(); if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  if (["contractType", "qualificationSummary", "payrollEligible"].some((key) => key in body)) return NextResponse.json({ error: "Private HR fields are not accepted here." }, { status: 400 });
  const valid = validateEmployeeInput({ ...body, contractType: "permanent", qualificationSummary: null, payrollEligible: true });
  if (!valid.value) return NextResponse.json({ error: valid.errors[0] || "Invalid teacher / staff member.", details: valid.errors }, { status: 400 });
  const value = valid.value; const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_hr_employee_v1", { p_identity_id: identity.id, p_tenant_id: workspace.tenantId, p_branch_id: workspace.branchId, p_display_name: value.displayName, p_name_native: value.nameNative, p_gender: value.gender, p_preferred_locale: value.preferredLocale, p_department_key: value.departmentKey, p_designation: value.designation, p_contract_type: "permanent", p_joined_on: value.joinedOn, p_qualification_summary: null, p_payroll_eligible: true });
  if (error) { const message = error.message.toLowerCase(); if (message.includes("permission denied")) return NextResponse.json({ error: "Teacher management permission required." }, { status: 403 }); if (message.includes("numbering") || message.includes("already exists")) return NextResponse.json({ error: error.message }, { status: 409 }); if (message.includes("invalid") || message.includes("required") || message.includes("too long")) return NextResponse.json({ error: error.message }, { status: 422 }); return NextResponse.json({ error: "Unable to create teacher / staff member." }, { status: 500 }); }
  return NextResponse.json({ result: data }, { status: 201, headers: { "cache-control": "no-store" } });
}
