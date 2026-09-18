import { AcademicTimetableViews } from "@/components/academic-timetable-views";
import { AcademicsTimetableManager } from "@/components/academics-timetable-manager";
import { WorkspacePageHeader } from "@/components/workspace-ui";
import { getAcademicsWorkspace } from "@/lib/academics/workspace";
import type { SupportedLocale } from "@/lib/i18n/config";

const copy: Record<SupportedLocale, {
  eyebrow: string;
  title: string;
  description: string;
  meta: (date: string, timezone: string) => string;
}> = {
  en: {
    eyebrow: "Daily teaching",
    title: "Academics & Timetable",
    description: "Plan the teaching day, manage timetable conflicts and exceptions, assign homework, and keep the academic calendar in one operational workspace.",
    meta: (date, timezone) => `${date} · ${timezone}`
  },
  ur: {
    eyebrow: "روزمرہ تدریس",
    title: "اکیڈمکس و ٹائم ٹیبل",
    description: "تدریسی دن، ٹائم ٹیبل کے تصادم اور تبدیلیاں، ہوم ورک اور اکیڈمک کیلنڈر ایک ہی عملی ورک اسپیس سے چلائیں۔",
    meta: (date, timezone) => `${date} · ${timezone}`
  }
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value: unknown): string | null {
  if (typeof value !== "string" || !DATE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ date?: string }> };

export default async function PeopleAcademicsPage({ params, searchParams }: Props) {
  const { locale: rawLocale } = await params;
  const query = await searchParams;
  const locale: SupportedLocale = rawLocale === "ur" ? "ur" : "en";
  const data = await getAcademicsWorkspace(locale, validDate(query.date));
  const text = copy[locale];

  return (
    <>
      <WorkspacePageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
        meta={text.meta(data.selectedDate, data.timezone)}
      />
      <AcademicsTimetableManager locale={locale} data={data} />
      <AcademicTimetableViews locale={locale} data={data} />
    </>
  );
}
