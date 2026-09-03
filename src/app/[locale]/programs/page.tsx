import { ProgramsSyllabusManager } from "@/components/programs-syllabus-manager";
import { WorkspacePageHeader } from "@/components/workspace-ui";
import { getAcademicFoundationSummary } from "@/lib/academics/live-summary";
import type { Locale } from "@/lib/i18n/config";
import { getProgramsSyllabusWorkspace } from "@/lib/programs-syllabus/runtime";

type ProgramsPageProps = { params: Promise<{ locale: string }> };

type ProgramsCopy = {
  eyebrow: string;
  title: string;
  description: string;
  meta: (programs: number, levels: number, components: number, assignments: number) => string;
};

const copy: Record<Locale, ProgramsCopy> = {
  en: {
    eyebrow: "Teaching setup",
    title: "Programs & Syllabus",
    description: "Build the institution's real teaching model from programs, stages, subjects and units. Publish versioned syllabi, assign them to teachers and learners, then record progress without rewriting historical academic data.",
    meta: (programs, levels, components, assignments) => `${programs} programs · ${levels} levels · ${components} components · ${assignments} teaching assignments`
  },
  ur: {
    eyebrow: "تدریسی سیٹ اپ",
    title: "پروگرامز و نصاب",
    description: "پروگرام، مراحل، مضامین اور یونٹس سے ادارے کا حقیقی تدریسی ماڈل بنائیں۔ ورژن شدہ نصاب شائع کریں، اساتذہ اور طلبہ کو مقرر کریں، اور تاریخی اکیڈمک ریکارڈ بدلے بغیر پیش رفت درج کریں۔",
    meta: (programs, levels, components, assignments) => `${programs} پروگرام · ${levels} لیول · ${components} اجزاء · ${assignments} تدریسی اسائنمنٹس`
  },
  ar: {
    eyebrow: "إعداد التدريس",
    title: "البرامج والمنهج",
    description: "أنشئ نموذج التدريس الفعلي للمؤسسة من البرامج والمراحل والمواد والوحدات. انشر مناهج بإصدارات، وعيّنها للمعلمين والطلاب، وسجّل التقدم دون تغيير السجلات الأكاديمية التاريخية.",
    meta: (programs, levels, components, assignments) => `${programs} برامج · ${levels} مستويات · ${components} مكونات · ${assignments} مهام تدريس`
  }
};

export default async function ProgramsPage({ params }: ProgramsPageProps) {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale === "ur" || rawLocale === "ar" ? rawLocale : "en") as Locale;
  const text = copy[locale];
  const [summary, workspace] = await Promise.all([
    getAcademicFoundationSummary(locale),
    getProgramsSyllabusWorkspace(locale)
  ]);

  return (
    <>
      <WorkspacePageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
        meta={text.meta(summary.programs, summary.levels, workspace.items.length, workspace.assignments.length)}
      />
      <ProgramsSyllabusManager locale={locale} data={workspace} />
    </>
  );
}
