import type { Locale } from "@/lib/i18n/config";
import { demoModules, demoUiCopy, localize } from "@/lib/demo/modules";

type DemoHubPageProps = {
  params: Promise<{ locale: string }>;
};

type ExtraModule = {
  id: string;
  code: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
};

const extraModules: ExtraModule[] = [
  {
    id: "academics",
    code: "AC",
    title: { en: "Academics & Timetable", ur: "اکیڈمکس و ٹائم ٹیبل", ar: "الأكاديميات والجدول" },
    description: {
      en: "Academic sessions, Dars-e-Nizami levels, subjects/kitabs, teacher allocation, timetables, homework and promotion rules.",
      ur: "تعلیمی سال، درس نظامی درجات، مضامین/کتب، استاد الاٹمنٹ، ٹائم ٹیبل، ہوم ورک اور پروموشن رولز۔",
      ar: "السنوات الدراسية ومستويات الدرس النظامي والمواد/الكتب وتوزيع المعلمين والجداول والواجبات وقواعد الترفيع."
    }
  },
  {
    id: "operations",
    code: "OP",
    title: { en: "Bulk Import, Promotion & Renewal", ur: "بلک امپورٹ، پروموشن و رینیول", ar: "الاستيراد الجماعي والترفيع والتجديد" },
    description: {
      en: "Validated legacy imports, returning-student renewal, bulk promotion, transfers, withdrawals and exception review.",
      ur: "لیگیسی امپورٹ، واپس آنے والے طلبہ کی رینیول، بلک پروموشن، ٹرانسفر، ودڈراول اور استثنا ریویو۔",
      ar: "استيراد السجلات والتجديد والترفيع الجماعي والنقل والانسحاب ومراجعة الاستثناءات."
    }
  },
  {
    id: "transport",
    code: "TR",
    title: { en: "Transport & Route Management", ur: "ٹرانسپورٹ و روٹ مینجمنٹ", ar: "النقل وإدارة المسارات" },
    description: {
      en: "Routes, vehicles, stops, student assignments, pickup/drop visibility, transport fees and parent delay alerts.",
      ur: "روٹس، گاڑیاں، اسٹاپ، طالب علم الاٹمنٹ، پک اپ/ڈراپ، ٹرانسپورٹ فیس اور والدین تاخیر الرٹس۔",
      ar: "المسارات والمركبات والمحطات وتعيين الطلاب وتتبع الصعود/النزول ورسوم النقل وتنبيهات التأخير."
    }
  }
];

const hubCopy = {
  demoData: {
    en: "Demo data",
    ur: "ڈیمو ڈیٹا",
    ar: "بيانات العرض"
  },
  title: {
    en: "Complete Madarsa ERP demo",
    ur: "مکمل مدرسہ ERP ڈیمو",
    ar: "عرض Madarsa ERP متكامل"
  },
  moduleCount: {
    en: "ERP modules",
    ur: "ERP ماڈیولز",
    ar: "وحدات ERP"
  },
  body: {
    en: "A presentation-ready walkthrough of the complete Madarsa ERP product. Every area uses one consistent fictional institution scenario, with live working workflows available for Admissions, student conversion and institution configuration.",
    ur: "مکمل مدرسہ ERP کا پریزنٹیشن کے لیے تیار واک تھرو۔ ہر حصہ ایک ہی حقیقت پسندانہ فرضی ادارے کے منظرنامے پر مبنی ہے، جبکہ داخلہ، طالب علم کنورژن اور ادارہ کنفیگریشن کے حقیقی ورکنگ فلو بھی دستیاب ہیں۔",
    ar: "جولة جاهزة لعرض منتج Madarsa ERP المتكامل. تستخدم جميع الوحدات سيناريو مؤسسة افتراضية موحداً، مع مسارات عملية فعلية للقبول وتحويل الطلاب وتهيئة المؤسسة."
  },
  liveTitle: {
    en: "Live working flows",
    ur: "حقیقی ورکنگ فلو",
    ar: "المسارات العملية الفعلية"
  },
  liveBody: {
    en: "Use these when the client wants to go beyond the product walkthrough and see a real workflow in action.",
    ur: "جب کلائنٹ پروڈکٹ واک تھرو سے آگے بڑھ کر حقیقی ورک فلو دیکھنا چاہے تو یہ فلو استعمال کریں۔",
    ar: "استخدم هذه عندما يريد العميل تجاوز جولة المنتج ورؤية مسار عمل فعلي."
  },
  admissions: {
    en: "Open live Admissions",
    ur: "حقیقی داخلہ کھولیں",
    ar: "فتح القبول الفعلي"
  },
  students: {
    en: "Open live Student structure",
    ur: "حقیقی طالب علم اسٹرکچر",
    ar: "فتح هيكل الطلاب الفعلي"
  },
  configuration: {
    en: "Open live Configuration",
    ur: "حقیقی کنفیگریشن",
    ar: "فتح التهيئة الفعلية"
  }
} as const;

export default async function DemoHubPage({ params }: DemoHubPageProps) {
  const { locale } = await params;
  const typedLocale = (locale === "ur" || locale === "ar" ? locale : "en") as Locale;

  return (
    <>
      <section className="demo-hub-hero">
        <div>
          <div className="demo-eyebrow-row">
            <span className="demo-data-chip">{hubCopy.demoData[typedLocale]}</span>
            <span className="demo-scenario-chip">{localize(demoUiCopy.scenario, typedLocale)}</span>
          </div>
          <p className="state-kicker">Madarsa ERP</p>
          <h1>{hubCopy.title[typedLocale]}</h1>
          <p>{hubCopy.body[typedLocale]}</p>
        </div>
        <div className="demo-hero-stat">
          <strong>{demoModules.length + extraModules.length}</strong>
          <span>{hubCopy.moduleCount[typedLocale]}</span>
        </div>
      </section>

      <section className="demo-module-grid" aria-label={hubCopy.title[typedLocale]}>
        {demoModules.slice(0, 2).map((module) => (
          <a className="demo-module-card" href={`/${typedLocale}/demo/${module.id}`} key={module.id}>
            <span className="demo-module-code">{module.code}</span>
            <div>
              <h2>{localize(module.title, typedLocale)}</h2>
              <p>{localize(module.description, typedLocale)}</p>
            </div>
            <span className="demo-card-arrow" aria-hidden="true">→</span>
          </a>
        ))}

        <a className="demo-module-card" href={`/${typedLocale}/demo/academics`}>
          <span className="demo-module-code">{extraModules[0].code}</span>
          <div>
            <h2>{extraModules[0].title[typedLocale]}</h2>
            <p>{extraModules[0].description[typedLocale]}</p>
          </div>
          <span className="demo-card-arrow" aria-hidden="true">→</span>
        </a>

        {demoModules.slice(2, 7).map((module) => (
          <a className="demo-module-card" href={`/${typedLocale}/demo/${module.id}`} key={module.id}>
            <span className="demo-module-code">{module.code}</span>
            <div>
              <h2>{localize(module.title, typedLocale)}</h2>
              <p>{localize(module.description, typedLocale)}</p>
            </div>
            <span className="demo-card-arrow" aria-hidden="true">→</span>
          </a>
        ))}

        <a className="demo-module-card" href={`/${typedLocale}/demo/operations`}>
          <span className="demo-module-code">{extraModules[1].code}</span>
          <div>
            <h2>{extraModules[1].title[typedLocale]}</h2>
            <p>{extraModules[1].description[typedLocale]}</p>
          </div>
          <span className="demo-card-arrow" aria-hidden="true">→</span>
        </a>

        {demoModules.slice(7, 9).map((module) => (
          <a className="demo-module-card" href={`/${typedLocale}/demo/${module.id}`} key={module.id}>
            <span className="demo-module-code">{module.code}</span>
            <div>
              <h2>{localize(module.title, typedLocale)}</h2>
              <p>{localize(module.description, typedLocale)}</p>
            </div>
            <span className="demo-card-arrow" aria-hidden="true">→</span>
          </a>
        ))}

        <a className="demo-module-card" href={`/${typedLocale}/demo/transport`}>
          <span className="demo-module-code">{extraModules[2].code}</span>
          <div>
            <h2>{extraModules[2].title[typedLocale]}</h2>
            <p>{extraModules[2].description[typedLocale]}</p>
          </div>
          <span className="demo-card-arrow" aria-hidden="true">→</span>
        </a>

        {demoModules.slice(9).map((module) => (
          <a className="demo-module-card" href={`/${typedLocale}/demo/${module.id}`} key={module.id}>
            <span className="demo-module-code">{module.code}</span>
            <div>
              <h2>{localize(module.title, typedLocale)}</h2>
              <p>{localize(module.description, typedLocale)}</p>
            </div>
            <span className="demo-card-arrow" aria-hidden="true">→</span>
          </a>
        ))}
      </section>

      <section className="panel demo-live-panel">
        <header className="panel-header">
          <div>
            <p className="sample-label">{hubCopy.demoData[typedLocale]}</p>
            <h2>{hubCopy.liveTitle[typedLocale]}</h2>
            <p>{hubCopy.liveBody[typedLocale]}</p>
          </div>
        </header>
        <div className="demo-live-actions">
          <a className="action-button action-button-primary" href={`/${typedLocale}/admissions`}>
            {hubCopy.admissions[typedLocale]}
          </a>
          <a className="action-button" href={`/${typedLocale}/people-academics`}>
            {hubCopy.students[typedLocale]}
          </a>
          <a className="action-button" href={`/${typedLocale}/settings/configuration`}>
            {hubCopy.configuration[typedLocale]}
          </a>
        </div>
      </section>
    </>
  );
}
