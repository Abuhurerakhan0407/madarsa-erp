import type { Locale } from "@/lib/i18n/config";
import { AttendanceWorkspace } from "@/components/attendance-workspace";
import { getAttendanceWorkspace, getDefaultAttendanceDate } from "@/lib/attendance/workspace";
import { validateAttendanceDate } from "@/lib/attendance/model";

const copy = {
  en: { kicker: "Student operations", title: "Attendance & Biometrics", body: "Run daily student attendance with immutable records, correction history and device-source visibility." },
  ur: { kicker: "طلبہ آپریشنز", title: "حاضری و بایومیٹرکس", body: "ناقابلِ تبدیلی ریکارڈ، اصلاحی تاریخ اور ڈیوائس سورس کے ساتھ روزانہ طلبہ کی حاضری چلائیں۔" },
  ar: { kicker: "عمليات الطلاب", title: "الحضور والبيومتري", body: "إدارة حضور الطلاب اليومي بسجلات غير قابلة للتغيير وسجل تصحيحات ومصدر تسجيل الأجهزة." }
} as const;

export default async function AttendancePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ date?: string; q?: string; page?: string }> }) {
  const { locale: rawLocale } = await params;
  const query = await searchParams;
  const locale = (rawLocale === "ur" || rawLocale === "ar" ? rawLocale : "en") as Locale;
  const defaultDate = await getDefaultAttendanceDate();
  const date = validateAttendanceDate(query.date) ?? defaultDate;
  const search = (query.q ?? "").trim().slice(0, 160);
  const page = Math.max(1, Math.min(Number(query.page) || 1, 100000));
  const data = await getAttendanceWorkspace({ date, search, page, pageSize: 50, locale });
  const text = copy[locale];

  return <>
    <section className="page-heading" data-page-section><div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{text.body}</p></div><time dateTime={date}>{date}</time></section>
    <AttendanceWorkspace locale={locale} data={data} search={search} />
  </>;
}
