import { DemoModulePage } from "@/components/demo-module-page";
import type { DemoModule, LocalizedText } from "@/lib/demo/modules";
import type { Locale } from "@/lib/i18n/config";

const l = (en: string, ur: string, ar: string): LocalizedText => ({ en, ur, ar });

const academicsModule: DemoModule = {
  id: "students",
  code: "AC",
  title: l("Academics & Timetable", "اکیڈمکس و ٹائم ٹیبل", "الأكاديميات والجدول"),
  description: l(
    "Academic sessions, Dars-e-Nizami years, Maktab classes, subjects/kitabs, teacher allocation, timetable publishing and promotion rules.",
    "تعلیمی سال، درس نظامی درجات، مکتب کلاسز، مضامین/کتب، استاد الاٹمنٹ، ٹائم ٹیبل اور پروموشن رولز۔",
    "السنوات الدراسية ومستويات الدرس النظامي وصفوف المكتب والمواد/الكتب وتوزيع المعلمين ونشر الجداول وقواعد الترفيع."
  ),
  metrics: [
    { label: l("Academic programs", "تعلیمی پروگرام", "البرامج الأكاديمية"), value: "18" },
    { label: l("Groups / classes", "گروپس / کلاسز", "المجموعات / الصفوف"), value: "128" },
    { label: l("Lessons today", "آج اسباق", "حصص اليوم"), value: "312" },
    { label: l("Timetable conflicts", "ٹائم ٹیبل تصادم", "تعارضات الجدول"), value: "0" }
  ],
  workflow: [
    l("Open academic session", "تعلیمی سال کھولیں", "فتح السنة الدراسية"),
    l("Build program / level / group", "پروگرام / لیول / گروپ بنائیں", "بناء البرنامج / المستوى / المجموعة"),
    l("Assign subjects, kitabs & teachers", "مضامین، کتب و اساتذہ دیں", "تعيين المواد والكتب والمعلمين"),
    l("Publish conflict-checked timetable", "تصادم چیک شدہ ٹائم ٹیبل شائع", "نشر جدول بعد فحص التعارض")
  ],
  features: [
    l("Hijri + Gregorian academic sessions", "ہجری + گریگورین تعلیمی سال", "سنوات دراسية هجرية + ميلادية"),
    l("Maktab, Hifz, Nazra, Qaida and Dars-e-Nizami structures", "مکتب، حفظ، ناظرہ، قاعدہ اور درس نظامی اسٹرکچر", "هياكل المكتب والحفظ والنظرة والقاعدة والدرس النظامي"),
    l("Subjects, kitabs, periods and teacher allocation", "مضامین، کتب، پیریڈ اور استاد الاٹمنٹ", "المواد والكتب والحصص وتوزيع المعلمين"),
    l("Teacher / room / group conflict detection", "استاد / کمرہ / گروپ تصادم چیک", "كشف تعارض المعلم / الغرفة / المجموعة"),
    l("Homework, lesson notes and academic calendar", "ہوم ورک، سبق نوٹس اور تعلیمی کیلنڈر", "الواجبات وملاحظات الدروس والتقويم الأكاديمي"),
    l("Promotion, retention and next-session rules", "پروموشن، ریٹینشن اور اگلے سال کے رولز", "قواعد الترفيع والإبقاء والسنة التالية")
  ],
  table: {
    columns: [
      l("Program / level", "پروگرام / لیول", "البرنامج / المستوى"),
      l("Groups", "گروپس", "المجموعات"),
      l("Students", "طلبہ", "الطلاب"),
      l("Today", "آج", "اليوم")
    ],
    rows: [
      ["Dars-e-Nizami · Aalim 1", "8", "318", "42 lessons"],
      ["Hifz", "20", "684", "86 sessions"],
      ["Nazra", "31", "1,146", "74 sessions"],
      ["Maktab / Qaida", "26", "932", "61 sessions"]
    ]
  },
  liveHref: (locale) => `/${locale}/people-academics`,
  liveLabel: l("Open live academic structure", "حقیقی اکیڈمک اسٹرکچر کھولیں", "فتح الهيكل الأكاديمي الفعلي")
};

type PageProps = { params: Promise<{ locale: string }> };

export default async function AcademicsDemoPage({ params }: PageProps) {
  const { locale } = await params;
  const typedLocale = (locale === "ur" || locale === "ar" ? locale : "en") as Locale;
  return <DemoModulePage module={academicsModule} locale={typedLocale} />;
}
