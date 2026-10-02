import Link from "next/link";
import { InlineState } from "@/components/workspace-ui";
import { AttendanceV2Workspace } from "@/components/attendance-v2-workspace";
import type { SupportedLocale } from "@/lib/i18n/config";
import {
  getAttendancePageOptions,
  getAttendanceWorkspace,
  getDefaultAttendanceDate
} from "@/lib/attendance/workspace";
import { validateAttendanceDate } from "@/lib/attendance/model";

const copy = {
  en: {
    kicker: "Attendance",
    title: "Daily attendance",
    body: "Choose a date and class/group to review biometric-first student attendance.",
    students: "Talaba",
    teachers: "Ustadh / Staff",
    date: "Attendance date",
    load: "Load",
    group: "Class / group",
    chooseGroup: "Choose a class / group",
    requiredTitle: "Choose a class or group",
    requiredBody: "Student attendance is loaded only after a class/group is selected.",
    config: "Device configuration",
    export: "Export CSV",
    reports: "Reports"
  },
  ur: {
    kicker: "حاضری",
    title: "روزانہ حاضری",
    body: "بایومیٹرک فرسٹ طلبہ حاضری دیکھنے کے لیے تاریخ اور کلاس/گروپ منتخب کریں۔",
    students: "طلبہ",
    teachers: "اساتذہ / عملہ",
    date: "حاضری کی تاریخ",
    load: "لوڈ کریں",
    group: "کلاس / گروپ",
    chooseGroup: "کلاس / گروپ منتخب کریں",
    requiredTitle: "کلاس یا گروپ منتخب کریں",
    requiredBody: "طلبہ کی حاضری کلاس/گروپ منتخب کرنے کے بعد لوڈ ہوتی ہے۔",
    config: "ڈیوائس کنفیگریشن",
    export: "CSV ایکسپورٹ",
    reports: "رپورٹس"
  }
} as const;

function positiveInteger(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export default async function AttendancePage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; group?: string; page?: string }>;
}) {
  const { locale: raw } = await params;
  const query = await searchParams;
  const locale: SupportedLocale = raw === "ur" ? "ur" : "en";
  const t = copy[locale];

  const [defaultDate, options] = await Promise.all([
    getDefaultAttendanceDate(),
    getAttendancePageOptions(locale)
  ]);
  const date = validateAttendanceDate(query.date) ?? defaultDate;
  const requestedGroupId = positiveInteger(query.group);
  const groupId = options.groups.some((group) => group.id === requestedGroupId)
    ? requestedGroupId
    : undefined;
  const page = Math.max(1, Math.min(Number(query.page) || 1, 100000));
  const data = groupId
    ? await getAttendanceWorkspace({
        date,
        groupId,
        page,
        pageSize: 50,
        locale
      })
    : null;

  const teacherHref = `/${locale}/staff/attendance?date=${encodeURIComponent(date)}${
    groupId ? `&studentGroup=${groupId}` : ""
  }`;
  const exportHref = `/api/attendance/export?date=${encodeURIComponent(date)}&locale=${locale}${
    groupId ? `&group=${groupId}` : ""
  }`;

  return (
    <>
      <section className="page-heading attendance-page-heading" data-page-section>
        <div>
          <p className="state-kicker">{t.kicker}</p>
          <h1>{t.title}</h1>
          <p>{t.body}</p>
        </div>
      </section>

      <nav
        className="attendance-audience-tabs"
        aria-label={locale === "ur" ? "حاضری قسم" : "Attendance audience"}
        data-page-section
      >
        <span className="attendance-audience-tab is-active" aria-current="page">
          {t.students}
        </span>
        {options.canViewStaff ? (
          <Link className="attendance-audience-tab" href={teacherHref}>
            {t.teachers}
          </Link>
        ) : null}
      </nav>

      <section className="panel attendance-filter-panel" data-page-section>
        <form className="attendance-filter-form">
          <div className="attendance-date-row">
            <label className="field-label">
              {t.date}
              <input className="text-field" type="date" name="date" defaultValue={date} />
            </label>
            <button className="action-button action-button-primary" type="submit">
              {t.load}
            </button>
          </div>
          <label className="field-label attendance-group-field">
            {t.group}
            <select
              className="text-field"
              name="group"
              defaultValue={groupId ? String(groupId) : ""}
              required
            >
              <option value="" disabled>
                {t.chooseGroup}
              </option>
              {options.groups.map((group) => (
                <option value={group.id} key={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>
        </form>
      </section>

      <nav className="quick-actions attendance-page-actions" data-page-section>
        {groupId ? (
          <a className="secondary-button" href={exportHref} download>
            {t.export}
          </a>
        ) : null}
        <Link className="secondary-button" href={`/${locale}/reports`}>
          {t.reports}
        </Link>
        {data?.emergency.canManage ? (
          <Link
            className="secondary-button"
            href={`/${locale}/settings/configuration/attendance-devices`}
          >
            {t.config}
          </Link>
        ) : null}
      </nav>

      {data && groupId ? (
        <AttendanceV2Workspace locale={locale} data={data} groupId={groupId} />
      ) : (
        <InlineState title={t.requiredTitle} body={t.requiredBody} />
      )}
    </>
  );
}
