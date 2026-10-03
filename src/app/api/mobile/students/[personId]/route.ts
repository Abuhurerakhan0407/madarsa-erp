import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMobileStaffWorkspace } from "@/lib/mobile/server-auth";

const NATIVE_ORIGINS = new Set(["https://localhost", "capacitor://localhost"]);
type Raw = Record<string, unknown>;

function object(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
}
function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function text(value: unknown) {
  return typeof value === "string" ? value : null;
}
function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (!origin || !NATIVE_ORIGINS.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
function json(request: NextRequest, body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  const cors = corsHeaders(request);
  if (cors) for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}
function localizedLabel(labels: unknown, fallback: string, locale: "ur" | "en") {
  const map = object(labels);
  const preferred = locale === "en" ? map.en : map.ur;
  if (typeof preferred === "string" && preferred.trim()) return preferred;
  const alternate = locale === "en" ? map.ur : map.en;
  return typeof alternate === "string" && alternate.trim() ? alternate : fallback;
}

export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (!NATIVE_ORIGINS.has(origin)) return new NextResponse(null, { status: 403, headers: { Vary: "Origin" } });
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) ?? undefined });
}

export async function GET(request: NextRequest, context: { params: Promise<{ personId: string }> }) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !NATIVE_ORIGINS.has(origin) && origin !== request.nextUrl.origin) {
    return json(request, { error: "origin_not_allowed" }, { status: 403 });
  }

  const tenantId = Number.parseInt(request.nextUrl.searchParams.get("tenantId") ?? "", 10);
  const branchIdValue = Number.parseInt(request.nextUrl.searchParams.get("branchId") ?? "", 10);
  const branchId = Number.isInteger(branchIdValue) && branchIdValue > 0 ? branchIdValue : null;
  const { personId: personIdRaw } = await context.params;
  const personId = Number.parseInt(personIdRaw, 10);
  if (!Number.isInteger(tenantId) || tenantId <= 0 || !Number.isInteger(personId) || personId <= 0) {
    return json(request, { error: "invalid_request" }, { status: 400 });
  }

  const workspace = await resolveMobileStaffWorkspace(request, { tenantId, branchId });
  if (!workspace || !workspace.branchId) return json(request, { error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const enrollment = await admin
    .from("enrollments")
    .select("id,program_id,group_id,status")
    .eq("tenant_id", workspace.tenantId)
    .eq("branch_id", workspace.branchId)
    .eq("student_person_id", personId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (enrollment.error) {
    console.error("mobile student profile enrollment failed", { code: enrollment.error.code });
    return json(request, { error: "profile_unavailable" }, { status: 503 });
  }
  if (!enrollment.data) return json(request, { error: "not_found" }, { status: 404 });

  const [person, profile, program, group, moduleResult] = await Promise.all([
    admin.from("persons").select("id,display_name,name_native").eq("tenant_id", workspace.tenantId).eq("id", personId).maybeSingle(),
    admin.from("student_profiles").select("person_id,student_number,admission_number,status,joined_on").eq("tenant_id", workspace.tenantId).eq("person_id", personId).maybeSingle(),
    enrollment.data.program_id
      ? admin.from("programs").select("key,labels").eq("tenant_id", workspace.tenantId).eq("id", enrollment.data.program_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    enrollment.data.group_id
      ? admin.from("academic_groups").select("key,labels").eq("tenant_id", workspace.tenantId).eq("branch_id", workspace.branchId).eq("id", enrollment.data.group_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin.rpc("get_student_module_summary", {
      p_identity_id: workspace.identityId,
      p_tenant_id: workspace.tenantId,
      p_branch_id: workspace.branchId,
      p_person_id: personId,
    }),
  ]);

  if (person.error || profile.error || program.error || group.error || moduleResult.error) {
    console.error("mobile student profile failed", {
      person: person.error?.code,
      profile: profile.error?.code,
      program: program.error?.code,
      group: group.error?.code,
      module: moduleResult.error?.code,
    });
    return json(request, { error: "profile_unavailable" }, { status: 503 });
  }
  if (!person.data || !profile.data) return json(request, { error: "not_found" }, { status: 404 });

  const locale = request.nextUrl.searchParams.get("locale") === "en" ? "en" : "ur";
  const modules = object(moduleResult.data);
  const attendance = object(modules.attendance);
  const programKey = text(program.data?.key);
  const groupKey = text(group.data?.key);

  return json(request, {
    readOnly: true,
    student: {
      personId,
      studentNumber: profile.data.student_number,
      admissionNumber: profile.data.admission_number,
      name: person.data.display_name,
      nativeName: person.data.name_native,
      status: profile.data.status,
      joinedOn: profile.data.joined_on,
      program: programKey ? localizedLabel(program.data?.labels, programKey, locale) : "—",
      group: groupKey ? localizedLabel(group.data?.labels, groupKey, locale) : "—",
    },
    attendance: {
      present: number(attendance.present),
      absent: number(attendance.absent),
      late: number(attendance.late),
      excused: number(attendance.excused),
      total: number(attendance.total),
    },
    quranAttempts: modules.quran_attempts === null || modules.quran_attempts === undefined ? null : number(modules.quran_attempts),
    resultCount: modules.result_count === null || modules.result_count === undefined ? null : number(modules.result_count),
  });
}
