import { NextResponse } from "next/server";
import { validateQuranDailyQuickInput } from "@/lib/quran/daily-register-model";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

function mapRuntimeError(message: string): { status: number; error: string } {
  const normalized = message.toLowerCase();
  if (normalized.includes("permission denied")) {
    return { status: 403, error: "Qur'an recording permission required." };
  }
  if (normalized.includes("not actively enrolled")) {
    return { status: 404, error: "Student is not actively enrolled in this Halaqah or group." };
  }
  if (normalized.includes("later active quran target exists")) {
    return { status: 409, error: "A later active Qur'an target already exists. Review that later target before entering this older lesson." };
  }
  if (
    normalized.includes("invalid") ||
    normalized.includes("required") ||
    normalized.includes("within the last 90 days") ||
    normalized.includes("set a quran target") ||
    normalized.includes("target before") ||
    normalized.includes("too long") ||
    normalized.includes("between")
  ) {
    return { status: 422, error: message };
  }
  return { status: 500, error: "Unable to update the Qur'an daily register." };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  }
  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  }

  const parsed = await readBoundedJson(request, 24_576);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const validation = validateQuranDailyQuickInput(parsed.value);
  if (!validation.value) {
    return NextResponse.json(
      { error: validation.errors[0] ?? "Daily register values are invalid.", details: validation.errors },
      { status: 400 }
    );
  }

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  }

  const value = validation.value;
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("record_quran_hifz_daily_quick_v2", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_request_key: value.requestKey,
    p_group_id: value.groupId,
    p_session_date: value.sessionDate,
    p_student_person_id: value.personId,
    p_work_category: value.workCategory,
    p_action: value.action,
    p_target: value.target ?? null,
    p_quality_score: value.qualityScore ?? null,
    p_tajweed_score: value.tajweedScore ?? null,
    p_fluency_score: value.fluencyScore ?? null,
    p_mistake_count: value.mistakeCount,
    p_teacher_note: value.teacherNote ?? null,
    p_next_target: value.nextTarget ?? null,
    p_revision_due_on: value.revisionDueOn ?? null
  });

  if (error) {
    const mapped = mapRuntimeError(error.message);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  return NextResponse.json(
    { result: data },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
