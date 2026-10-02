import { NextResponse } from "next/server";
import { validateQuranAttemptInput } from "@/lib/quran/model";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 32768) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  const parsedBody = await readBoundedJson(request, 32_768);
  if (!parsedBody.ok) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  const body = parsedBody.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  const raw = body as Record<string, unknown>;
  const requestKey = typeof raw.requestKey === "string" ? raw.requestKey.trim() : "";
  if (requestKey.length < 16 || requestKey.length > 96) return NextResponse.json({ error: "Valid request key required." }, { status: 400 });
  const validation = validateQuranAttemptInput(body);
  if (!validation.value) return NextResponse.json({ error: validation.errors[0] || "Invalid Qur'an record.", details: validation.errors }, { status: 400 });
  const value = validation.value;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_quran_hifz_attempt_scoped_v1", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_request_key: requestKey,
    p_student_person_id: value.personId,
    p_work_category: value.workCategory,
    p_juz_number: value.juzNumber ?? null,
    p_start_surah_number: value.startSurahNumber ?? null,
    p_start_ayah_number: value.startAyahNumber ?? null,
    p_end_surah_number: value.endSurahNumber ?? null,
    p_end_ayah_number: value.endAyahNumber ?? null,
    p_page_start: value.pageStart ?? null,
    p_page_end: value.pageEnd ?? null,
    p_accuracy_score: value.accuracyScore ?? null,
    p_fluency_score: value.fluencyScore ?? null,
    p_tajweed_score: value.tajweedScore ?? null,
    p_overall_score: value.overallScore ?? null,
    p_prompts: value.prompts ?? null,
    p_outcome: value.outcome,
    p_teacher_remark: value.teacherRemark ?? null,
    p_parent_visible_remark: value.parentVisibleRemark ?? null,
    p_private_note: value.privateNote ?? null,
    p_mistakes: value.mistakes
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) return NextResponse.json({ error: "Qur'an recording permission required." }, { status: 403 });
    if (message.includes("not actively enrolled")) return NextResponse.json({ error: "Student is not actively enrolled in this branch." }, { status: 404 });
    if (message.includes("invalid") || message.includes("required") || message.includes("too long") || message.includes("mistake") || message.includes("request key")) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ error: "Unable to record Qur'an progress." }, { status: 500 });
  }
  return NextResponse.json({ result: data }, { status: 201, headers: { "cache-control": "no-store" } });
}
