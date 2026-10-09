import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMobileStaffWorkspace } from "@/lib/mobile/server-auth";

const NATIVE_ORIGINS = new Set(["https://localhost", "capacitor://localhost"]);

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
  if (cors) {
    for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
  }
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

function isoDate(value: string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (!NATIVE_ORIGINS.has(origin)) {
    return new NextResponse(null, { status: 403, headers: { Vary: "Origin" } });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) ?? undefined });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !NATIVE_ORIGINS.has(origin) && origin !== request.nextUrl.origin) {
    return json(request, { error: "origin_not_allowed" }, { status: 403 });
  }

  const tenantId = positiveInt(request.nextUrl.searchParams.get("tenantId"), 0);
  const branchId = nullablePositiveInt(request.nextUrl.searchParams.get("branchId"));
  const date = isoDate(request.nextUrl.searchParams.get("date"));
  if (!tenantId || !date) {
    return json(request, { error: "invalid_request" }, { status: 400 });
  }

  const workspace = await resolveMobileStaffWorkspace(request, { tenantId, branchId });
  if (!workspace) return json(request, { error: "unauthorized" }, { status: 401 });

  const page = positiveInt(request.nextUrl.searchParams.get("page"), 1, 100000);
  const pageSize = positiveInt(request.nextUrl.searchParams.get("pageSize"), 50, 100);
  const search = request.nextUrl.searchParams.get("search")?.trim().slice(0, 120) || null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_student_attendance_workspace", {
    p_identity_id: workspace.identityId,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_attendance_date: date,
    p_search: search,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    console.error("mobile attendance workspace failed", { code: error.code });
    return json(request, { error: "attendance_unavailable" }, { status: 503 });
  }

  const payload = data && typeof data === "object" ? data : {};
  return json(request, {
    readOnly: true,
    workspace: {
      tenantId: workspace.tenantId,
      branchId: workspace.branchId,
      surface: workspace.surface,
    },
    attendance: payload,
  });
}
