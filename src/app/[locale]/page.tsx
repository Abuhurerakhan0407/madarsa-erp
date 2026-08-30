import type { Locale } from "@/lib/i18n/config";
import { demoModules, demoUiCopy, localize } from "@/lib/demo/modules";
import { getDashboardSummary } from "@/lib/dashboard/summary";

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
};

const copy = {
  demoData: {
    en: "Demo data",
    ur: "ڈیمو ڈیٹا",
    ar: "بيانات العرض"
  },
  kicker: {
    en: "Complete ERP demonstration",
    ur: "مکمل ERP ڈیمو",
    ar: "عرض ERP متكامل"
  },
  body: {
    en: "A realistic 4,000-student operating scenario for the client presentation. Use the module walkthrough for the complete product view, then open the live Admissions, student-conversion and configuration flows when you want to demonstrate working operations.",
    ur: "کلائنٹ پریزنٹیشن کے لیے 4,000 طلبہ کا حقیقت پسندانہ آپریشنل منظرنامہ۔ مکمل پروڈکٹ کے لیے ماڈیول واک تھرو دکھائیں، پھر حقیقی آپریشن دکھانے کے لیے داخلہ، طالب علم کنورژن اور کنفیگریشن فلو کھولیں۔",
    ar: "سيناريو تشغيلي واقعي لمؤسسة تضم 4,000 طالب لعرض العميل. استخدم جولة الوحدات لعرض المنتج كاملاً، ثم افتح مسارات القبول وتحويل الطلاب والتهيئة لإظهار العمليات الفعلية."
  },
  operations: {
    en: "Today's institution snapshot",
    ur: "آج کا ادارہ اسنیپ شاٹ",
    ar: "ملخص المؤسسة اليوم"
  },
  modules: {
    en: "Explore the complete ERP",
    ur: "مکمل ERP دیکھیں",
    ar: "استكشف ERP الكامل"
  },
  modulesBody: {
    en: "Every approved area is visible from the demo. Open a module to see metrics, workflow, sample activity and included capabilities.",
    ur: "ہر منظور شدہ حصہ ڈیمو میں نظر آتا ہے۔ میٹرکس، ورک فلو، سرگرمی اور صلاحیتیں دیکھنے کے لیے ماڈیول کھولیں۔",
    ar: "كل المجالات المعتمدة ظاهرة في العرض. افتح أي وحدة لرؤية المؤشرات ومسار العمل والنشاط والقدرات."
  },
  live: {
    en: "Live working samples",
    ur: "حقیقی ورکنگ نمونے",
    ar: "نماذج عملية فعلية"
  },
  liveTitle: {
    en: "Admissions → Student record",
    ur: "داخلہ → طالب علم ریکارڈ",
    ar: "القبول ← سجل الطالب"
  },
  liveBody: {
    en: "Use these after the product overview when the client wants to see a real workflow.",
    ur: "پروڈکٹ اوورویو کے بعد جب کلائنٹ حقیقی ورک فلو دیکھنا چاہے تو یہ کھولیں۔",
    ar: "استخدم هذه بعد عرض المنتج عندما يريد العميل رؤية مسار عمل فعلي."
  },
  buttons: {
    admissions: {
      en: "Open live Admissions",
      ur: "حقیقی داخلہ کھولیں",
      ar: "فتح القبول الفعلي"
    },
    students: {
      en: "Open live Student structure",
      ur: "حقیقی طالب علم اسٹرکچر کھولیں",
      ar: "فتح هيكل الطلاب الفعلي"
    },
    configuration: {
      en: "Open live Configuration",
      ur: "حقیقی کنفیگریشن کھولیں",
      ar: "فتح التهيئة الفعلية"
    }
  },
  metrics: {
    students: {
      label: { en: "Active students", ur: "فعال طلبہ", ar: "الطلاب النشطون" },
      note: { en: "Across 3 branches", ur: "3 برانچز میں", ar: "عبر 3 فروع" }
    },
    attendance: {
      label: { en: "Attendance today", ur: "آج کی حاضری", ar: "حضور اليوم" },
      note: { en: "3,784 present", ur: "3,784 حاضر", ar: "3,784 حاضر" }
    },
    fees: {
      label: { en: "Fee collection", ur: "فیس وصولی", ar: "تحصيل الرسوم" },
      note: { en: "This month", ur: "اس ماہ", ar: "هذا الشهر" }
    },
    hifz: {
      label: { en: "Hifz students", ur: "حفظ طلبہ", ar: "طلاب الحفظ" },
      note: { en: "Sabaq · Sabqi · Manzil", ur: "سبق · سبقی · منزل", ar: "سبق · سبقي · منزل" }
    },
    hostel: {
      label: { en: "Hostel residents", ur: "ہاسٹل طلبہ", ar: "طلاب السكن" },
      note: { en: "660-bed capacity", ur: "660 بیڈ گنجائش", ar: "سعة 660 سريراً" }
    },
    staff: {
      label: { en: "Staff", ur: "عملہ", ar: "الموظفون" },
      note: { en: "182 teachers", ur: "182 اساتذہ", ar: "182 معلماً" }
    }
  }
} as const;

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  const typedLocale = (locale === "ur" || locale === "ar" ? locale : "en") as Locale;
  const summary = await getDashboardSummary(typedLocale);

  const dateLabel = new Intl.DateTimeFormat(typedLocale, {
    dateStyle: "medium",
    timeZone: summary.timeZone
  }).format(new Date());

  const featuredIds = new Set(["attendance", "quran", "fees", "whatsapp", "ai", "reports"]);
  const featured = demoModules.filter((module) => featuredIds.has(module.id));

  return (
    <>
      <section className="demo-hub-hero demo-overview-hero">
        <div>
          <div className="demo-eyebrow-row">
            <span className="demo-data-chip">{copy.demoData[typedLocale]}</span>
            <span className="demo-scenario-chip">{localize(demoUiCopy.scenario, typedLocale)}</span>
          </div>
          <p className="state-kicker">{copy.kicker[typedLocale]}</p>
          <h1>{summary.tenantName}</h1>
          <p>{copy.body[typedLocale]}</p>
        </div>
        <time className="demo-date-chip" dateTime={summary.dateKey}>{dateLabel}</time>
      </section>

      <section className="demo-overview-section">
        <header className="demo-section-heading">
          <div>
            <p className="sample-label">{copy.demoData[typedLocale]}</p>
            <h2>{copy.operations[typedLocale]}</h2>
          </div>
        </header>
        <div className="demo-metric-grid demo-overview-metrics">
          <article className="demo-metric-card demo-metric-featured">
            <span>{copy.metrics.students.label[typedLocale]}</span>
            <strong>4,000</strong>
            <small>{copy.metrics.students.note[typedLocale]}</small>
          </article>
          <article className="demo-metric-card">
            <span>{copy.metrics.attendance.label[typedLocale]}</span>
            <strong>94.6%</strong>
            <small>{copy.metrics.attendance.note[typedLocale]}</small>
          </article>
          <article className="demo-metric-card">
            <span>{copy.metrics.fees.label[typedLocale]}</span>
            <strong>₹18.6L</strong>
            <small>{copy.metrics.fees.note[typedLocale]}</small>
          </article>
          <article className="demo-metric-card">
            <span>{copy.metrics.hifz.label[typedLocale]}</span>
            <strong>684</strong>
            <small>{copy.metrics.hifz.note[typedLocale]}</small>
          </article>
          <article className="demo-metric-card">
            <span>{copy.metrics.hostel.label[typedLocale]}</span>
            <strong>612</strong>
            <small>{copy.metrics.hostel.note[typedLocale]}</small>
          </article>
          <article className="demo-metric-card">
            <span>{copy.metrics.staff.label[typedLocale]}</span>
            <strong>214</strong>
            <small>{copy.metrics.staff.note[typedLocale]}</small>
          </article>
        </div>
      </section>

      <section className="demo-overview-section">
        <header className="demo-section-heading">
          <div>
            <p className="sample-label">{copy.demoData[typedLocale]}</p>
            <h2>{copy.modules[typedLocale]}</h2>
            <p>{copy.modulesBody[typedLocale]}</p>
          </div>
          <a className="action-button" href={`/${typedLocale}/demo`}>
            {localize(demoUiCopy.backToModules, typedLocale)}
          </a>
        </header>
        <div className="demo-module-grid demo-featured-grid">
          {featured.map((module) => (
            <a className="demo-module-card" href={`/${typedLocale}/demo/${module.id}`} key={module.id}>
              <span className="demo-module-code">{module.code}</span>
              <div>
                <h2>{localize(module.title, typedLocale)}</h2>
                <p>{localize(module.description, typedLocale)}</p>
              </div>
              <span className="demo-card-arrow" aria-hidden="true">→</span>
            </a>
          ))}
        </div>
      </section>

      <section className="panel demo-live-panel">
        <header className="panel-header">
          <div>
            <p className="sample-label">{copy.live[typedLocale]}</p>
            <h2>{copy.liveTitle[typedLocale]}</h2>
            <p>{copy.liveBody[typedLocale]}</p>
          </div>
        </header>
        <div className="demo-live-actions">
          <a className="action-button action-button-primary" href={`/${typedLocale}/admissions`}>
            {copy.buttons.admissions[typedLocale]}
          </a>
          <a className="action-button" href={`/${typedLocale}/people-academics`}>
            {copy.buttons.students[typedLocale]}
          </a>
          <a className="action-button" href={`/${typedLocale}/settings/configuration`}>
            {copy.buttons.configuration[typedLocale]}
          </a>
        </div>
      </section>
    </>
  );
}
