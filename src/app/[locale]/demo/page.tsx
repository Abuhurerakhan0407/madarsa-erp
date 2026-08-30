import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import { demoModules, localize } from "@/lib/demo/modules";

type DemoHubPageProps = {
  params: Promise<{ locale: string }>;
};

type ModuleSummary = {
  id: string;
  code: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
};

const extraModules: ModuleSummary[] = [
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
  eyebrow: {
    en: "Administration suite",
    ur: "انتظامی سسٹم",
    ar: "منظومة الإدارة"
  },
  title: {
    en: "All modules",
    ur: "تمام ماڈیولز",
    ar: "جميع الوحدات"
  },
  moduleCount: {
    en: "operational areas",
    ur: "آپریشنل شعبے",
    ar: "مجالاً تشغيلياً"
  },
  body: {
    en: "Everything your institution team needs—from admissions and academics to finance, campus operations, communication and reporting.",
    ur: "داخلہ اور اکیڈمکس سے لے کر فنانس، کیمپس آپریشنز، کمیونیکیشن اور رپورٹنگ تک ادارے کی مکمل انتظامیہ۔",
    ar: "كل ما يحتاجه فريق المؤسسة، من القبول والأكاديميات إلى المالية وعمليات الحرم والتواصل والتقارير."
  },
  quickTitle: {
    en: "Frequently used workspaces",
    ur: "زیادہ استعمال ہونے والی ورک اسپیسز",
    ar: "مساحات العمل الأكثر استخداماً"
  },
  quickBody: {
    en: "Jump straight into admissions, student structure or institution configuration.",
    ur: "داخلہ، طالب علم اسٹرکچر یا ادارہ کنفیگریشن میں براہ راست جائیں۔",
    ar: "انتقل مباشرة إلى القبول أو هيكل الطلاب أو تهيئة المؤسسة."
  },
  admissions: {
    en: "Admissions workspace",
    ur: "داخلہ ورک اسپیس",
    ar: "مساحة القبول"
  },
  students: {
    en: "Student records",
    ur: "طالب علم ریکارڈز",
    ar: "سجلات الطلاب"
  },
  configuration: {
    en: "Configuration",
    ur: "کنفیگریشن",
    ar: "التهيئة"
  }
} as const;

const groups: Array<{ title: Record<Locale, string>; ids: string[] }> = [
  {
    title: { en: "Students & learning", ur: "طلبہ و تعلیم", ar: "الطلاب والتعلم" },
    ids: ["admissions", "students", "academics", "attendance", "quran", "exams", "portals"]
  },
  {
    title: { en: "Finance & campus operations", ur: "فنانس و کیمپس آپریشنز", ar: "المالية وعمليات الحرم" },
    ids: ["fees", "operations", "donations", "hostel", "transport", "staff", "library", "certificates"]
  },
  {
    title: { en: "Administration & intelligence", ur: "انتظامیہ و انٹیلیجنس", ar: "الإدارة والذكاء" },
    ids: ["reports", "whatsapp", "ai", "branches", "configuration"]
  }
];

export default async function DemoHubPage({ params }: DemoHubPageProps) {
  const { locale } = await params;
  const typedLocale = (locale === "ur" || locale === "ar" ? locale : "en") as Locale;
  const moduleSummaries: ModuleSummary[] = [...demoModules, ...extraModules];
  const moduleMap = new Map(moduleSummaries.map((item) => [item.id, item]));

  return (
    <>
      <section className="demo-hub-hero professional-modules-hero" data-page-section>
        <div>
          <p className="state-kicker">{hubCopy.eyebrow[typedLocale]}</p>
          <h1>{hubCopy.title[typedLocale]}</h1>
          <p>{hubCopy.body[typedLocale]}</p>
        </div>
        <div className="demo-hero-stat">
          <strong>{moduleSummaries.length}</strong>
          <span>{hubCopy.moduleCount[typedLocale]}</span>
        </div>
      </section>

      {groups.map((group) => (
        <section className="demo-module-group" key={group.title.en} data-page-section>
          <header className="demo-section-heading demo-module-group-heading">
            <h2>{group.title[typedLocale]}</h2>
          </header>
          <div className="demo-module-grid">
            {group.ids.map((id) => {
              const item = moduleMap.get(id);
              if (!item) return null;

              return (
                <Link
                  className="demo-module-card"
                  href={`/${typedLocale}/demo/${item.id}`}
                  key={item.id}
                  prefetch={false}
                >
                  <span className="demo-module-code">{item.code}</span>
                  <div>
                    <h3>{localize(item.title, typedLocale)}</h3>
                    <p>{localize(item.description, typedLocale)}</p>
                  </div>
                  <span className="demo-card-arrow" aria-hidden="true">→</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <section className="panel demo-live-panel professional-quick-panel" data-page-section>
        <header className="panel-header">
          <div>
            <p className="sample-label">{hubCopy.eyebrow[typedLocale]}</p>
            <h2>{hubCopy.quickTitle[typedLocale]}</h2>
            <p>{hubCopy.quickBody[typedLocale]}</p>
          </div>
        </header>
        <div className="demo-live-actions">
          <Link className="action-button action-button-primary" href={`/${typedLocale}/admissions`}>
            {hubCopy.admissions[typedLocale]}
          </Link>
          <Link className="action-button" href={`/${typedLocale}/people-academics`}>
            {hubCopy.students[typedLocale]}
          </Link>
          <Link className="action-button" href={`/${typedLocale}/settings/configuration`}>
            {hubCopy.configuration[typedLocale]}
          </Link>
        </div>
      </section>
    </>
  );
}
