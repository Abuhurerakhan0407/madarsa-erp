import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMobileBearerToken } from "@/lib/mobile/server-auth";

const NATIVE_ORIGINS = new Set(["https://localhost", "capacitor://localhost"]);
type Raw = Record<string, unknown>;

const object = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const rows = (value: unknown): Raw[] => Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Raw[] : [];
const text = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

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
export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (!NATIVE_ORIGINS.has(origin)) return new NextResponse(null, { status: 403, headers: { Vary: "Origin" } });
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) ?? undefined });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !NATIVE_ORIGINS.has(origin) && origin !== request.nextUrl.origin) {
    return json(request, { error: "origin_not_allowed" }, { status: 403 });
  }
  const tenantId = Number.parseInt(request.nextUrl.searchParams.get("tenantId") ?? "", 10);
  if (!Number.isInteger(tenantId) || tenantId <= 0) return json(request, { error: "invalid_request" }, { status: 400 });

  const token = getMobileBearerToken(request);
  if (!token) return json(request, { error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) return json(request, { error: "unauthorized" }, { status: 401 });

  const { data: links, error: linkError } = await admin
    .from("identity_person_links")
    .select("person_id")
    .eq("tenant_id", tenantId)
    .eq("identity_id", user.id)
    .eq("link_type", "guardian")
    .eq("status", "verified")
    .limit(1);
  if (linkError || !links?.length) return json(request, { error: "guardian_scope_denied" }, { status: 403 });

  const { data, error } = await admin.rpc("get_portal_attendance_v2_v1", {
    p_identity_id: user.id,
    p_tenant_id: tenantId,
  });
  if (error) {
    console.error("mobile guardian attendance failed", { code: error.code });
    return json(request, { error: "attendance_unavailable" }, { status: 503 });
  }

  const raw = object(data);
  return json(request, {
    readOnly: true,
    children: rows(raw.children).map((child) => ({
      personId: number(child.person_id),
      studentNumber: text(child.student_number),
      name: text(child.display_name) ?? "Student",
      dailyPercent: number(child.daily_percent),
      weeklyPercent: number(child.weekly_percent),
      monthlyPercent: number(child.monthly_percent),
      trend: rows(child.trend).slice(-30).map((point) => ({
        date: text(point.date),
        percent: number(point.attendance_percent),
        recorded: number(point.recorded),
      })),
      recent: rows(child.recent).slice(0, 10).map((record) => ({
        date: text(record.attendance_date),
        status: text(record.status_category),
        source: text(record.source),
        markedAt: text(record.marked_at),
      })),
    })).filter((child) => child.personId > 0),
  });
}
