import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import { demoModules, localize } from "@/lib/demo/modules";
import { getTenantContext } from "@/lib/tenancy/context";

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
};

const copy = {
  academicYear: {
    en: "Academic year 2026–27",
    ur: "تعلیمی سال 2026–27",
    ar: "العام الدراسي 2026–27"
  },
  body: {
    en: "A clear view of students, attendance, fees, Qur'an learning, staffing and day-to-day school operations.",
    ur: "طلبہ، حاضری، فیس، قرآن کی تعلیم، عملہ اور روزمرہ ادارہ آپریشنز کا واضح جائزہ۔",
    ar: "نظرة واضحة على الطلاب والحضور والرسوم وتعليم القرآن والموظفين والعمليات اليومية للمؤسسة."
  },
  operations: {
    en: "Institution overview",
    ur: "ادارہ جائزہ",
    ar: "نظرة عامة على المؤسسة"
  },
  operationsBody: {
    en: "The numbers your administration team needs at a glance.",
    ur: "انتظامیہ کے لیے اہم اعداد ایک نظر میں۔",
    ar: "أهم الأرقام التي يحتاجها فريق الإدارة في لمحة واحدة."
  },
  modules: {
    en: "Core operational areas",
    ur: "اہم آپریشنل شعبے",
    ar: "مجالات التشغيل الأساسية"
  },
  modulesBody: {
    en: "Open the areas used most often, or browse the complete administration suite.",
    ur: "سب سے زیادہ استعمال ہونے والے شعبے کھولیں یا مکمل انتظامی سسٹم دیکھیں۔",
    ar: "افتح المجالات الأكثر استخداماً أو استعرض مجموعة الإدارة الكاملة."
  },
  allModules: {
    en: "View all modules",
    ur: "تمام ماڈیولز دیکھیں",
    ar: "عرض جميع الوحدات"
  },
  quickActions: {
    en: "Quick access",
    ur: "فوری رسائی",
    ar: "وصول سريع"
  },
  quickTitle: {
    en: "Admissions and student records",
    ur: "داخلہ اور طالب علم ریکارڈ",
    ar: "القبول وسجلات الطلاب"
  },
  quickBody: {
    en: "Move directly into admissions, student structure or institution configuration.",
    ur: "داخلہ، طالب علم اسٹرکچر یا ادارہ کنفیگریشن میں براہ راست جائیں۔",
    ar: "انتقل مباشرة إلى القبول أو هيكل الطلاب أو تهيئة المؤسسة."
  },
  buttons: {
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
  const workspace = await getTenantContext();

  if (!workspace) return null;

  const dateLabel = new Intl.DateTimeFormat(typedLocale, {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata"
  }).format(new Date());

  const featuredIds = new Set(["attendance", "quran", "fees", "whatsapp", "ai", "reports"]);
  const featured = demoModules.filter((module) => featuredIds.has(module.id));

  return (
    <>
      <section className="demo-hub-hero demo-overview-hero" data-page-section>
        <div>
          <div className="demo-eyebrow-row">
            <span className="demo-scenario-chip">{copy.academicYear[typedLocale]}</span>
          </div>
          <h1>{workspace.tenantName}</h1>
          <p>{copy.body[typedLocale]}</p>
        </div>
        <time className="demo-date-chip" dateTime={new Date().toISOString()}>{dateLabel}</time>
      </section>

      <section className="demo-overview-section" data-page-section>
        <header className="demo-section-heading">
          <div>
            <h2>{copy.operations[typedLocale]}</h2>
            <p>{copy.operationsBody[typedLocale]}</p>
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

      <section className="demo-overview-section" data-page-section>
        <header className="demo-section-heading">
          <div>
            <h2>{copy.modules[typedLocale]}</h2>
            <p>{copy.modulesBody[typedLocale]}</p>
          </div>
          <Link className="action-button" href={`/${typedLocale}/demo`} prefetch>
            {copy.allModules[typedLocale]}
          </Link>
        </header>
        <div className="demo-module-grid demo-featured-grid">
          {featured.map((module) => (
            <Link className="demo-module-card" href={`/${typedLocale}/demo/${module.id}`} key={module.id} prefetch>
              <span className="demo-module-code">{module.code}</span>
              <div>
                <h3>{localize(module.title, typedLocale)}</h3>
                <p>{localize(module.description, typedLocale)}</p>
              </div>
              <span className="demo-card-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel demo-live-panel professional-quick-panel" data-page-section>
        <header className="panel-header">
          <div>
            <p className="sample-label">{copy.quickActions[typedLocale]}</p>
            <h2>{copy.quickTitle[typedLocale]}</h2>
            <p>{copy.quickBody[typedLocale]}</p>
          </div>
        </header>
        <div className="demo-live-actions">
          <Link className="action-button action-button-primary" href={`/${typedLocale}/admissions`} prefetch>
            {copy.buttons.admissions[typedLocale]}
          </Link>
          <Link className="action-button" href={`/${typedLocale}/people-academics`} prefetch>
            {copy.buttons.students[typedLocale]}
          </Link>
          <Link className="action-button" href={`/${typedLocale}/settings/configuration`} prefetch>
            {copy.buttons.configuration[typedLocale]}
          </Link>
        </div>
      </section>
    </>
  );
}
