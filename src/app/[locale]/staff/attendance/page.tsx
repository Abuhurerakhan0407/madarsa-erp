import Link from "next/link";
import type { SupportedLocale } from "@/lib/i18n/config";
import { requireOfficeAudience } from "@/lib/navigation/office-gate";
import { getHrAttendance } from "@/lib/hr/workspace";
import { HrAttendanceV2Workspace } from "@/components/hr-attendance-v2-workspace";

const copy = {
  en: {
    kicker: "Attendance",
    title: "Ustadh / Staff attendance",
    body: "Biometric-first Ustadh and staff attendance with governed emergency manual controls.",
    students: "Talaba",
    teachers: "Ustadh / Staff",
    date: "Attendance date",
    load: "Load"
  },
  ur: {
    kicker: "حاضری",
    title: "اساتذہ / عملہ حاضری",
    body: "بایومیٹرک فرسٹ اساتذہ اور عملہ حاضری، محفوظ ہنگامی دستی کنٹرول کے ساتھ۔",
    students: "طلبہ",
    teachers: "اساتذہ / عملہ",
    date: "حاضری کی تاریخ",
    load: "لوڈ کریں"
  }
} as const;

function positiveInteger(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export default async function StaffAttendancePage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; studentGroup?: string }>;
}) {
  const { locale: raw } = await params;
  const query = await searchParams;
  const locale: SupportedLocale = raw === "ur" ? "ur" : "en";
  await requireOfficeAudience(locale);

  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "") ? query.date : undefined;
  const data = await getHrAttendance({ date });
  const t = copy[locale];
  const studentGroup = positiveInteger(query.studentGroup);
  const studentHref = `/${locale}/attendance?date=${encodeURIComponent(data.date)}${
    studentGroup ? `&group=${studentGroup}` : ""
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
        <Link className="attendance-audience-tab" href={studentHref}>
          {t.students}
        </Link>
        <span className="attendance-audience-tab is-active" aria-current="page">
          {t.teachers}
        </span>
      </nav>

      <section className="panel attendance-filter-panel teacher-attendance-filter" data-page-section>
        <form className="attendance-date-row">
          <label className="field-label">
            {t.date}
            <input className="text-field" type="date" name="date" defaultValue={data.date} />
          </label>
          {studentGroup ? (
            <input type="hidden" name="studentGroup" value={studentGroup} />
          ) : null}
          <button className="action-button action-button-primary" type="submit">
            {t.load}
          </button>
        </form>
      </section>

      <HrAttendanceV2Workspace locale={locale} data={data} />
    </>
  );
}
