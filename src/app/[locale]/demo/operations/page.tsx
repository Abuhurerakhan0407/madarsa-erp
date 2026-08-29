import { DemoModulePage } from "@/components/demo-module-page";
import type { DemoModule, LocalizedText } from "@/lib/demo/modules";
import type { Locale } from "@/lib/i18n/config";

const l = (en: string, ur: string, ar: string): LocalizedText => ({ en, ur, ar });

const operationsModule: DemoModule = {
  id: "admissions",
  code: "OP",
  title: l("Bulk Import, Promotion & Renewal", "بلک امپورٹ، پروموشن و رینیول", "الاستيراد الجماعي والترفيع والتجديد"),
  description: l(
    "High-volume year-end operations for importing legacy records, promoting cohorts, renewing returning students and handling transfers without rewriting history.",
    "لیگیسی ریکارڈ بلک امپورٹ، گروپ پروموشن، واپس آنے والے طلبہ کی رینیول اور ٹرانسفر کے لیے ہائی والیوم آپریشنز۔",
    "عمليات نهاية العام لاستيراد السجلات القديمة وترفيع المجموعات وتجديد الطلاب العائدين ومعالجة النقل دون تغيير التاريخ."
  ),
  metrics: [
    { label: l("Renewals ready", "رینیول تیار", "تجديدات جاهزة"), value: "3,612" },
    { label: l("Promotion batches", "پروموشن بیچز", "دفعات الترفيع"), value: "18" },
    { label: l("Import rows validated", "امپورٹ قطاریں ویلیڈیٹ", "صفوف الاستيراد المتحققة"), value: "4,000" },
    { label: l("Exceptions", "استثنا", "الاستثناءات"), value: "23" }
  ],
  workflow: [
    l("Upload / select cohort", "فائل / گروپ منتخب", "رفع الملف / اختيار المجموعة"),
    l("Validate and preview changes", "ویلیڈیٹ اور پری ویو", "التحقق ومعاينة التغييرات"),
    l("Resolve exceptions", "استثنا حل کریں", "حل الاستثناءات"),
    l("Approve and apply batch", "منظوری اور بیچ لاگو", "الموافقة وتطبيق الدفعة")
  ],
  features: [
    l("CSV/Excel legacy student import with validation", "CSV/Excel لیگیسی طالب علم امپورٹ", "استيراد طلاب CSV/Excel مع التحقق"),
    l("Returning-student renewal for the next session", "اگلے تعلیمی سال کے لیے طالب علم رینیول", "تجديد الطلاب العائدين للسنة التالية"),
    l("Bulk promotion / retention by program and group", "پروگرام و گروپ کے مطابق بلک پروموشن / ریٹینشن", "ترفيع / إبقاء جماعي حسب البرنامج والمجموعة"),
    l("Transfer, withdrawal and re-admission handling", "ٹرانسفر، ودڈراول اور دوبارہ داخلہ", "النقل والانسحاب وإعادة القبول"),
    l("Duplicate detection and exception review", "ڈپلیکیٹ ڈیٹیکشن اور استثنا ریویو", "كشف التكرار ومراجعة الاستثناءات"),
    l("Dry-run preview, approval and audit trail", "ڈرائی رن پری ویو، منظوری اور آڈٹ ٹریل", "معاينة تجريبية وموافقة وسجل تدقيق")
  ],
  table: {
    columns: [
      l("Batch", "بیچ", "الدفعة"),
      l("Records", "ریکارڈ", "السجلات"),
      l("Ready", "تیار", "جاهز"),
      l("Exceptions", "استثنا", "الاستثناءات")
    ],
    rows: [
      ["2027 renewal", "3,612", "3,596", "16"],
      ["Hifz promotion", "684", "681", "3"],
      ["Dars-e-Nizami promotion", "1,022", "1,020", "2"],
      ["Legacy guardian import", "3,180", "3,178", "2"]
    ]
  }
};

type PageProps = { params: Promise<{ locale: string }> };

export default async function OperationsDemoPage({ params }: PageProps) {
  const { locale } = await params;
  const typedLocale = (locale === "ur" || locale === "ar" ? locale : "en") as Locale;
  return <DemoModulePage module={operationsModule} locale={typedLocale} />;
}
