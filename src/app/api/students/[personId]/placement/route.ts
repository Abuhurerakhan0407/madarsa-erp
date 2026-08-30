import { NextResponse } from "next/server";
import { isJsonRequest, isSameOriginRequest } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function PUT(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 4096) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  const personId = Number((await params).personId);
  if (!Number.isInteger(personId) || personId <= 0) return NextResponse.json({ error: "Invalid student." }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  const input = body as Record<string, unknown>;
  let groupId: number | null = null;
  if (input.groupId !== null && input.groupId !== undefined && input.groupId !== "") {
    const parsed = Number(input.groupId);
    if (!Number.isInteger(parsed) || parsed <= 0) return NextResponse.json({ error: "Class/group is invalid." }, { status: 400 });
    groupId = parsed;
  }
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length > 500) return NextResponse.json({ error: "Placement reason is too long." }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("update_student_group_placement", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_student_person_id: personId,
    p_group_id: groupId,
    p_reason: reason || null
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) return NextResponse.json({ error: "Enrollment management permission required." }, { status: 403 });
    if (message.includes("not available")) return NextResponse.json({ error: "Active enrollment is not available in this branch." }, { status: 404 });
    if (message.includes("not valid") || message.includes("reason")) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ error: "Unable to update student placement." }, { status: 500 });
  }
  return NextResponse.json({ result: data }, { status: 200, headers: { "cache-control": "no-store" } });
}
