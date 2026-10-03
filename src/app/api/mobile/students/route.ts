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
function positiveInt(value: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}
function nullablePositiveInt(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
function localizedLabel(labels: unknown, fallback: string) {
  const map = object(labels);
  const urdu = map.ur;
  if (typeof urdu === "string" && urdu.trim()) return urdu;
  const english = map.en;
  return typeof english === "string" && english.trim() ? english : fallback;
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

  const tenantId = positiveInt(request.nextUrl.searchParams.get("tenantId"), 0);
  const branchId = nullablePositiveInt(request.nextUrl.searchParams.get("branchId"));
  if (!tenantId) return json(request, { error: "invalid_request" }, { status: 400 });

  const workspace = await resolveMobileStaffWorkspace(request, { tenantId, branchId });
  if (!workspace || !workspace.branchId) return json(request, { error: "unauthorized" }, { status: 401 });

  const page = positiveInt(request.nextUrl.searchParams.get("page"), 1, 100000);
  const pageSize = positiveInt(request.nextUrl.searchParams.get("pageSize"), 30, 100);
  const search = request.nextUrl.searchParams.get("search")?.trim().slice(0, 120) || null;
  const status = request.nextUrl.searchParams.get("status")?.trim().slice(0, 40) || null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_student_register_page", {
    p_identity_id: workspace.identityId,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_query: search,
    p_status: status,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    console.error("mobile student register failed", { code: error.code });
    return json(request, { error: "students_unavailable" }, { status: 503 });
  }

  const result = object(data);
  const rows = Array.isArray(result.rows) ? result.rows : [];
  return json(request, {
    readOnly: true,
    total: number(result.total),
    active: number(result.active),
    page: Math.max(number(result.page), 1),
    pageSize: Math.max(number(result.page_size), 1),
    pages: Math.max(number(result.pages), 1),
    rows: rows.flatMap((entry) => {
      const row = object(entry);
      const personId = number(row.person_id);
      if (!personId) return [];
      const programKey = text(row.program_key);
      const groupKey = text(row.group_key);
      return [{
        personId,
        studentNumber: text(row.student_number) ?? "—",
        name: text(row.name) ?? "Student",
        nativeName: text(row.native_name),
        status: text(row.status) ?? "active",
        joinedOn: text(row.joined_on),
        program: programKey ? localizedLabel(row.program_labels, programKey) : "—",
        group: groupKey ? localizedLabel(row.group_labels, groupKey) : "—",
      }];
    }),
  });
}
