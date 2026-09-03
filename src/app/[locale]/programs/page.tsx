import { WorkspacePageHeader, TaskLanding } from "@/components/workspace-ui";
import { getAcademicFoundationSummary } from "@/lib/academics/live-summary";
import type { Locale } from "@/lib/i18n/config";

type ProgramsPageProps = { params: Promise<{ locale: string }> };

type ProgramsCopy = {
  eyebrow: string;
  title: string;
  description: string;
  summary: string;
  tasks: string;
  tasksBody: string;
  structureTitle: string;
  structureBody: string;
  configurationTitle: string;
  configurationBody: string;
};

const copy: Record<Locale, ProgramsCopy> = {
  en: {
    eyebrow: "Teaching setup",
    title: "Programs & Syllabus",
    description: "Keep curriculum structure separate from daily student work. Review the current teaching structure or adjust the institution model from one clear starting point.",
    summary: "programs · groups · active enrollments",
    tasks: "Choose a task",
    tasksBody: "Phase 1 keeps this landing page simple and routes into the proven academic/configuration tools already in the product.",
    structureTitle: "Review teaching structure",
    structureBody: "See sessions, programs, levels, groups and active enrollments in the existing academic foundation.",
    configurationTitle: "Configure institution teaching model",
    configurationBody: "Open institution configuration for curriculum presets, terminology and setup controls."
  },
  ur: {
    eyebrow: "تدریسی سیٹ اپ",
    title: "پروگرامز و نصاب",
    description: "نصاب کی ساخت کو روزمرہ طلبہ کے کام سے الگ رکھیں۔ موجودہ تدریسی ساخت دیکھیں یا ادارے کے ماڈل کو ایک واضح جگہ سے ترتیب دیں۔",
    summary: "پروگرامز · گروپس · فعال داخلے",
    tasks: "کام منتخب کریں",
    tasksBody: "فیز 1 اس لینڈنگ صفحے کو سادہ رکھتا ہے اور موجودہ قابل اعتماد اکیڈمک و کنفیگریشن ٹولز تک لے جاتا ہے۔",
    structureTitle: "تدریسی ساخت دیکھیں",
    structureBody: "موجودہ اکیڈمک فاؤنڈیشن میں سیشنز، پروگرامز، لیولز، گروپس اور فعال داخلے دیکھیں۔",
    configurationTitle: "ادارے کا تدریسی ماڈل ترتیب دیں",
    configurationBody: "نصاب پری سیٹس، اصطلاحات اور سیٹ اپ کنٹرولز کے لیے ادارہ کنفیگریشن کھولیں۔"
  },
  ar: {
    eyebrow: "إعداد التدريس",
    title: "البرامج والمنهج",
    description: "افصل بنية المنهج عن العمل اليومي للطلاب. راجع بنية التدريس الحالية أو اضبط نموذج المؤسسة من نقطة بداية واضحة.",
    summary: "برامج · مجموعات · تسجيلات نشطة",
    tasks: "اختر مهمة",
    tasksBody: "تحافظ المرحلة الأولى على بساطة هذه الصفحة وتوجّه إلى أدوات الأكاديميات والتهيئة الموجودة والموثوقة.",
    structureTitle: "مراجعة بنية التدريس",
    structureBody: "راجع الجلسات والبرامج والمستويات والمجموعات والتسجيلات النشطة في الأساس الأكاديمي الحالي.",
    configurationTitle: "تهيئة نموذج التدريس للمؤسسة",
    configurationBody: "افتح تهيئة المؤسسة لإعدادات المنهج والمصطلحات وعناصر التحكم في الإعداد."
  }
};

export default async function ProgramsPage({ params }: ProgramsPageProps) {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale === "ur" || rawLocale === "ar" ? rawLocale : "en") as Locale;
  const text = copy[locale];
  const summary = await getAcademicFoundationSummary(locale);
  const meta = `${summary.programs} · ${summary.groups} · ${summary.activeEnrollments} ${text.summary}`;

  return (
    <>
      <WorkspacePageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} meta={meta} />
      <TaskLanding
        title={text.tasks}
        description={text.tasksBody}
        items={[
          { title: text.structureTitle, description: text.structureBody, href: `/${locale}/people-academics` },
          { title: text.configurationTitle, description: text.configurationBody, href: `/${locale}/settings/configuration` }
        ]}
      />
    </>
  );
}
