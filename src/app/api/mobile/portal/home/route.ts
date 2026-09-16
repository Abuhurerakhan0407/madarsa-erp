import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMobileBearerToken } from "@/lib/mobile/server-auth";

const NATIVE_ORIGINS = new Set(["https://localhost", "capacitor://localhost"]);
type Raw = Record<string, unknown>;

const object = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const rows = (value: unknown): Raw[] => Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Raw[] : [];
const text = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null;
const label = (value: unknown) => {
  const map = object(value);
  return text(map.en) ?? text(map.ur) ?? text(map.ar) ?? "";
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
  const requestedSurface = request.nextUrl.searchParams.get("surface");
  const branchIdRaw = Number.parseInt(request.nextUrl.searchParams.get("branchId") ?? "", 10);
  const branchId = Number.isInteger(branchIdRaw) && branchIdRaw > 0 ? branchIdRaw : null;
  if (!Number.isInteger(tenantId) || tenantId <= 0 || (requestedSurface !== "teacher" && requestedSurface !== "parent")) {
    return json(request, { error: "invalid_request" }, { status: 400 });
  }

  const token = getMobileBearerToken(request);
  if (!token) return json(request, { error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) return json(request, { error: "unauthorized" }, { status: 401 });

  const requiredLink = requestedSurface === "teacher" ? "employee" : "guardian";
  const { data: links, error: linkError } = await admin
    .from("identity_person_links")
    .select("person_id")
    .eq("tenant_id", tenantId)
    .eq("identity_id", user.id)
    .eq("link_type", requiredLink)
    .eq("status", "verified");
  if (linkError || !links?.length) return json(request, { error: "portal_scope_denied" }, { status: 403 });

  if (requestedSurface === "teacher") {
    if (!branchId) return json(request, { error: "branch_required" }, { status: 400 });
    const personIds = links.map((link) => link.person_id);
    const { data: employments, error: employmentError } = await admin
      .from("hr_employments")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .in("employee_person_id", personIds)
      .in("state", ["active", "on_leave"])
      .limit(1);
    if (employmentError || !employments?.length) return json(request, { error: "portal_scope_denied" }, { status: 403 });
  }

  // Teacher home only needs the base employee/notices payload. Parent home uses v3 because
  // that RPC composes guardian schedule, homework and result data. Keeping teachers on v1
  // avoids unnecessary guardian-side resolution and preserves least-privilege data access.
  const portalHomeRpc = requestedSurface === "teacher" ? "get_portal_home_v1" : "get_portal_home_v3";
  const { data, error } = await admin.rpc(portalHomeRpc, {
    p_identity_id: user.id,
    p_tenant_id: tenantId,
  });
  if (error) {
    console.error("mobile portal home failed", { code: error.code });
    return json(request, { error: "portal_unavailable" }, { status: 503 });
  }

  const raw = object(data);
  const notices = rows(raw.notices).map((notice) => ({
    id: number(notice.id),
    audience: text(notice.audience_type) ?? "tenant",
    title: label(notice.labels),
    body: label(notice.body),
    publishedAt: text(notice.published_at),
    expiresAt: text(notice.expires_at),
    isRead: notice.is_read === true,
  })).filter((notice) => notice.id != null);

  if (requestedSurface === "teacher") {
    const employee = object(raw.employee);
    return json(request, {
      readOnly: true,
      surface: "teacher",
      employee: {
        personId: number(employee.person_id),
        employeeNumber: text(employee.employee_number),
        name: text(employee.display_name) ?? "Teacher",
        designation: text(employee.designation),
        department: text(employee.department_key),
        employmentType: text(employee.employment_type),
        joinedOn: text(employee.joined_on),
        status: text(employee.status),
        recentAttendance: rows(employee.recent_attendance).slice(0, 14).map((row) => ({
          date: text(row.attendance_date),
          status: text(row.status),
          checkInAt: text(row.check_in_at),
          checkOutAt: text(row.check_out_at),
        })),
        recentLeave: rows(employee.recent_leave).slice(0, 10).map((row) => ({
          startsOn: text(row.starts_on),
          endsOn: text(row.ends_on),
          units: number(row.requested_units),
          state: text(row.state),
        })),
      },
      notices,
    });
  }

  const overview = object(raw.overview);
  return json(request, {
    readOnly: true,
    surface: "parent",
    children: rows(raw.children).map((child) => ({
      personId: number(child.person_id),
      studentNumber: text(child.student_number),
      name: text(child.display_name) ?? "Student",
      nativeName: text(child.name_native),
      branchId: number(child.branch_id),
      groupId: number(child.group_id),
      enrollmentStatus: text(child.enrollment_status),
      attendanceTotal30d: number(child.attendance_total_30d) ?? 0,
      attendancePresent30d: number(child.attendance_present_30d) ?? 0,
      latestQuran: object(child.latest_quran),
    })).filter((child) => child.personId != null),
    notices,
    overview: {
      urgentNotices: rows(overview.urgent_notices).slice(0, 5).map((notice) => ({
        id: number(notice.id),
        title: label(notice.labels),
        body: label(notice.body),
        priority: text(notice.priority),
        publishedAt: text(notice.published_at),
      })),
      todaySchedule: rows(overview.today_schedule).slice(0, 30).map((entry) => ({
        studentPersonId: number(entry.student_person_id),
        studentName: text(entry.student_name),
        subjectName: text(entry.subject_name) ?? label(entry.subject_labels),
        startsAt: text(entry.starts_at),
        endsAt: text(entry.ends_at),
        room: text(entry.room_key),
        teacherName: text(entry.teacher_name),
      })),
      homework: rows(overview.homework).slice(0, 20).map((item) => ({
        id: number(item.id),
        title: text(item.title),
        priority: text(item.priority),
        dueAt: text(item.due_at),
        studentPersonId: number(item.student_person_id),
        studentName: text(item.student_name),
        teacherName: text(item.teacher_name),
      })),
      results: rows(overview.results).slice(0, 20).map((item) => ({
        snapshotId: number(item.snapshot_id),
        studentPersonId: number(item.student_person_id),
        studentName: text(item.student_name),
        percentage: number(item.percentage),
        status: text(item.aggregate_status),
        grade: text(item.grade_key),
        publishedAt: text(item.published_at),
        exam: label(item.exam_labels),
      })),
    },
  });
}
