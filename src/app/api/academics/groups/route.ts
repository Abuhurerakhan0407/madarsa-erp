import { NextResponse } from "next/server";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function mapRuntimeError(message: string): { status: number; error: string } {
  const normalized = message.toLowerCase();
  if (normalized.includes("permission denied")) {
    return { status: 403, error: "Academic structure permission required." };
  }
  if (normalized.includes("already exists")) {
    return { status: 409, error: message };
  }
  if (
    normalized.includes("invalid") ||
    normalized.includes("required") ||
    normalized.includes("outside") ||
    normalized.includes("active") ||
    normalized.includes("capacity")
  ) {
    return { status: 400, error: message };
  }
  return { status: 500, error: "Unable to create academic group." };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  }
  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  }

  const parsed = await readBoundedJson(request, 12_288);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  if (!isRecord(parsed.value)) {
    return NextResponse.json({ error: "Academic group values are invalid." }, { status: 400 });
  }

  const sessionId = positiveInteger(parsed.value.sessionId);
  const programId = positiveInteger(parsed.value.programId);
  const levelId = parsed.value.levelId == null ? null : positiveInteger(parsed.value.levelId);
  const capacity = parsed.value.capacity == null ? null : positiveInteger(parsed.value.capacity);
  const key = typeof parsed.value.key === "string" ? parsed.value.key.trim().toLowerCase() : "";
  const labels = isRecord(parsed.value.labels) ? parsed.value.labels : null;
  const title = typeof labels?.en === "string" ? labels.en.trim() : "";

  if (!sessionId || !programId) {
    return NextResponse.json({ error: "Academic session and program are required." }, { status: 400 });
  }
  if (parsed.value.levelId != null && !levelId) {
    return NextResponse.json({ error: "Academic level is invalid." }, { status: 400 });
  }
  if (parsed.value.capacity != null && (!capacity || capacity > 5000)) {
    return NextResponse.json({ error: "Capacity must be between 1 and 5000." }, { status: 400 });
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(key)) {
    return NextResponse.json({ error: "Academic group key is invalid." }, { status: 400 });
  }
  if (!labels || title.length < 1 || title.length > 120) {
    return NextResponse.json({ error: "Academic group labels are invalid." }, { status: 400 });
  }
  for (const locale of ["ur", "ar"] as const) {
    const value = labels[locale];
    if (value != null && (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 120)) {
      return NextResponse.json({ error: "Academic group labels are invalid." }, { status: 400 });
    }
  }

  const identity = await getVerifiedIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id) {
    return NextResponse.json({ error: "Active tenant membership required." }, { status: 403 });
  }
  if (!workspace.branchId) {
    return NextResponse.json({ error: "Active primary branch required." }, { status: 409 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_academic_group_v1", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_session_id: sessionId,
    p_program_id: programId,
    p_key: key,
    p_labels: labels,
    p_capacity: capacity,
    p_level_id: levelId
  });

  if (error) {
    const mapped = mapRuntimeError(error.message);
    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    { result: data },
    { status: 201, headers: { "cache-control": "no-store" } }
  );
}
