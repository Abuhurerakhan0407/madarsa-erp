import { NextResponse } from "next/server";
import { operatorHasPermissions } from "@/lib/access/operator-permission";
import { getAttendanceWorkspace, getDefaultAttendanceDate } from "@/lib/attendance/workspace";
import { validateAttendanceDate } from "@/lib/attendance/model";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";
import type { SupportedLocale } from "@/lib/i18n/config";

function cell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}

function time(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export async function GET(request: Request) {
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active institution membership required." }, { status: 403 });
  }

  if (!(await operatorHasPermissions(workspace, ["people.person.read", "data.export.manage"]))) {
    return NextResponse.json({ error: "Attendance export permission required." }, { status: 403 });
  }

  const url = new URL(request.url);
  const locale: SupportedLocale = url.searchParams.get("locale") === "ur" ? "ur" : "en";
  const requestedDate = validateAttendanceDate(url.searchParams.get("date") ?? undefined);
  const date = requestedDate ?? await getDefaultAttendanceDate();
  const rawGroup = Number(url.searchParams.get("group") ?? "");
  const groupId = Number.isInteger(rawGroup) && rawGroup > 0 ? rawGroup : undefined;

  try {
    const pageSize = 200;
    const first = await getAttendanceWorkspace({ date, groupId, page: 1, pageSize, locale });
    if (first.total > 10000) {
      return NextResponse.json({ error: "Attendance export is limited to 10,000 rows per file." }, { status: 413 });
    }

    const rows = [...first.rows];
    const pages = Math.max(1, Math.ceil(first.total / pageSize));
    for (let page = 2; page <= pages; page += 1) {
      const next = await getAttendanceWorkspace({ date, groupId, page, pageSize, locale });
      rows.push(...next.rows);
    }

    const header = [
      "Attendance date",
      "Student ID",
      "Student",
      "Class / group",
      "Status",
      "Source",
      "Device",
      "First scan",
      "Last scan",
      "Marked at",
      "Note"
    ];

    const body = rows.map((row) => [
      date,
      row.studentNumber,
      row.name,
      row.groupName ?? "",
      row.statusKey ?? "unmarked",
      row.source ?? "",
      row.deviceLabel ?? "",
      time(row.firstScan),
      time(row.lastScan),
      time(row.markedAt),
      row.note ?? ""
    ]);

    const csv = [header, ...body].map((row) => row.map(cell).join(",")).join("\r\n");
    return new NextResponse(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="attendance-${date}${groupId ? `-group-${groupId}` : ""}.csv"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Unable to export attendance." }, { status: 500 });
  }
}
