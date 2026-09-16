import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMobileStaffWorkspace } from "@/lib/mobile/server-auth";

const NATIVE_ORIGINS = new Set(["https://localhost", "capacitor://localhost"]);
type Raw = Record<string, unknown>;

const object = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

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

function positiveInt(value: string | null, fallback = 0) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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
  if (!NATIVE_ORIGINS.has(origin)) return new NextResponse(null, { status: 403, headers: { Vary: "Origin" } });
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) ?? undefined });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !NATIVE_ORIGINS.has(origin) && origin !== request.nextUrl.origin) {
    return json(request, { error: "origin_not_allowed" }, { status: 403 });
  }

  const tenantId = positiveInt(request.nextUrl.searchParams.get("tenantId"));
  const branchId = nullablePositiveInt(request.nextUrl.searchParams.get("branchId"));
  const date = isoDate(request.nextUrl.searchParams.get("date"));
  if (!tenantId || !date) return json(request, { error: "invalid_request" }, { status: 400 });

  const workspace = await resolveMobileStaffWorkspace(request, { tenantId, branchId });
  if (!workspace || !workspace.branchId) return json(request, { error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const common = {
    p_identity_id: workspace.identityId,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
  };

  const [studentsResult, attendanceResult, staffResult, aggregateResult] = await Promise.allSettled([
    admin.rpc("get_student_register_page", {
      ...common,
      p_query: null,
      p_status: null,
      p_page: 1,
      p_page_size: 1,
    }),
    admin.rpc("get_student_attendance_workspace", {
      ...common,
      p_view: "student",
      p_date: date,
      p_page: 1,
      p_page_size: 1,
      p_search: null,
      p_group_id: null,
    }),
    workspace.surface === "admin"
      ? admin.rpc("get_hr_employees_workspace_v1", {
          ...common,
          p_search: null,
          p_state: null,
          p_page: 1,
          p_page_size: 1,
        })
      : Promise.resolve({ data: null, error: null }),
    workspace.surface === "admin"
      ? admin.rpc("get_operational_dashboard_aggregate_v1", {
          ...common,
          p_local_date: date,
        })
      : Promise.resolve({ data: null, error: null }),
  ]);

  const studentsResponse = studentsResult.status === "fulfilled" && !studentsResult.value.error ? object(studentsResult.value.data) : {};
  const attendanceResponse = attendanceResult.status === "fulfilled" && !attendanceResult.value.error ? object(attendanceResult.value.data) : {};
  const attendanceSummary = object(attendanceResponse.summary);
  const staffResponse = staffResult.status === "fulfilled" && !staffResult.value.error ? object(staffResult.value.data) : {};
  const staffSummary = object(staffResponse.summary);
  const aggregateResponse = aggregateResult.status === "fulfilled" && !aggregateResult.value.error ? object(aggregateResult.value.data) : {};
  const admissions = object(aggregateResponse.admissions);

  const attendanceMarked = number(attendanceSummary.present) + number(attendanceSummary.absent) + number(attendanceSummary.late) + number(attendanceSummary.leave);
  const attendanceTotal = number(attendanceSummary.total);

  return json(request, {
    readOnly: true,
    date,
    surface: workspace.surface,
    metrics: {
      students: {
        total: number(studentsResponse.total),
        active: number(studentsResponse.active),
      },
      attendance: {
        total: attendanceTotal,
        present: number(attendanceSummary.present),
        absent: number(attendanceSummary.absent),
        late: number(attendanceSummary.late),
        unmarked: number(attendanceSummary.unmarked),
        marked: attendanceMarked,
      },
      staff: workspace.surface === "admin" ? {
        total: number(staffSummary.total),
        active: number(staffSummary.active),
        onLeave: number(staffSummary.on_leave),
      } : null,
      admissions: workspace.surface === "admin" ? {
        total: number(admissions.total),
        open: number(admissions.open),
        accepted: number(admissions.accepted),
        converted: number(admissions.converted),
      } : null,
    },
  });
}
