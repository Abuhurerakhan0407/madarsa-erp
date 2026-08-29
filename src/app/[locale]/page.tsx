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
  liveBody: {
    en: "Use these after the product overview when the client wants to see a real workflow.",
    ur: "پروڈکٹ اوورویو کے بعد جب کلائنٹ حقیقی ورک فلو دیکھنا چاہے تو یہ کھولیں۔",
    ar: "استخدم هذه بعد عرض المنتج عندما يريد العميل رؤية مسار عمل فعلي."
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
            <span>Active students</span>
            <strong>4,000</strong>
            <small>Across 3 branches</small>
          </article>
          <article className="demo-metric-card">
            <span>Attendance today</span>
            <strong>94.6%</strong>
            <small>3,784 present</small>
          </article>
          <article className="demo-metric-card">
            <span>Fee collection</span>
            <strong>₹18.6L</strong>
            <small>This month</small>
          </article>
          <article className="demo-metric-card">
            <span>Hifz students</span>
            <strong>684</strong>
            <small>Sabaq · Sabqi · Manzil</small>
          </article>
          <article className="demo-metric-card">
            <span>Hostel residents</span>
            <strong>612</strong>
            <small>660-bed capacity</small>
          </article>
          <article className="demo-metric-card">
            <span>Staff</span>
            <strong>214</strong>
            <small>182 teachers</small>
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
            <h2>Admissions → Student record</h2>
            <p>{copy.liveBody[typedLocale]}</p>
          </div>
        </header>
        <div className="demo-live-actions">
          <a className="action-button action-button-primary" href={`/${typedLocale}/admissions`}>
            Open live Admissions
          </a>
          <a className="action-button" href={`/${typedLocale}/people-academics`}>
            Open live Student structure
          </a>
          <a className="action-button" href={`/${typedLocale}/settings/configuration`}>
            Open live Configuration
          </a>
        </div>
      </section>
    </>
  );
}
