import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import type { Locale } from "@/lib/i18n/config";
import type { TenantContext } from "@/lib/tenancy/context";

type AppShellProps = {
  children: ReactNode;
  locale: Locale;
  workspace: TenantContext;
};

type NavItem = {
  key: string;
  labels: Record<Locale, string>;
  href: (locale: Locale) => string;
};

type NavGroup = {
  key: string;
  labels: Record<Locale, string>;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    key: "core",
    labels: { en: "Core operations", ur: "بنیادی آپریشنز", ar: "العمليات الأساسية" },
    items: [
      { key: "overview", labels: { en: "Overview", ur: "جائزہ", ar: "نظرة عامة" }, href: (locale) => `/${locale}` },
      { key: "admissions", labels: { en: "Admissions", ur: "داخلہ", ar: "القبول" }, href: (locale) => `/${locale}/demo/admissions` },
      { key: "students", labels: { en: "Students", ur: "طلبہ", ar: "الطلاب" }, href: (locale) => `/${locale}/demo/students` },
      { key: "attendance", labels: { en: "Attendance & Biometrics", ur: "حاضری و بایومیٹرکس", ar: "الحضور والبيومتري" }, href: (locale) => `/${locale}/demo/attendance` },
      { key: "quran", labels: { en: "Qur'an & Hifz", ur: "قرآن و حفظ", ar: "القرآن والحفظ" }, href: (locale) => `/${locale}/demo/quran` },
      { key: "fees", labels: { en: "Fees & Accounting", ur: "فیس و اکاؤنٹنگ", ar: "الرسوم والمحاسبة" }, href: (locale) => `/${locale}/demo/fees` },
      { key: "exams", labels: { en: "Exams & Results", ur: "امتحانات و نتائج", ar: "الاختبارات والنتائج" }, href: (locale) => `/${locale}/demo/exams` }
    ]
  },
  {
    key: "operations",
    labels: { en: "Institution operations", ur: "ادارہ آپریشنز", ar: "عمليات المؤسسة" },
    items: [
      { key: "portals", labels: { en: "Parent & Staff Portals", ur: "والدین و عملہ پورٹلز", ar: "بوابات أولياء الأمور والموظفين" }, href: (locale) => `/${locale}/demo/portals` },
      { key: "donations", labels: { en: "Donations & Sponsorships", ur: "عطیات و کفالت", ar: "التبرعات والكفالات" }, href: (locale) => `/${locale}/demo/donations` },
      { key: "hostel", labels: { en: "Hostel & Mess", ur: "ہاسٹل و میس", ar: "السكن والإعاشة" }, href: (locale) => `/${locale}/demo/hostel` },
      { key: "staff", labels: { en: "HR & Payroll", ur: "HR و پے رول", ar: "الموارد البشرية والرواتب" }, href: (locale) => `/${locale}/demo/staff` },
      { key: "library", labels: { en: "Library", ur: "لائبریری", ar: "المكتبة" }, href: (locale) => `/${locale}/demo/library` },
      { key: "certificates", labels: { en: "IDs & Certificates", ur: "ID و سرٹیفکیٹس", ar: "الهويات والشهادات" }, href: (locale) => `/${locale}/demo/certificates` }
    ]
  },
  {
    key: "intelligence",
    labels: { en: "Automation & intelligence", ur: "آٹومیشن و انٹیلیجنس", ar: "الأتمتة والذكاء" },
    items: [
      { key: "reports", labels: { en: "Reports & Analytics", ur: "رپورٹس و اینالیٹکس", ar: "التقارير والتحليلات" }, href: (locale) => `/${locale}/demo/reports` },
      { key: "whatsapp", labels: { en: "WhatsApp Automation", ur: "واٹس ایپ آٹومیشن", ar: "أتمتة واتساب" }, href: (locale) => `/${locale}/demo/whatsapp` },
      { key: "ai", labels: { en: "AI Assistant", ur: "AI معاون", ar: "مساعد الذكاء الاصطناعي" }, href: (locale) => `/${locale}/demo/ai` },
      { key: "branches", labels: { en: "Branches & Roles", ur: "برانچز و رولز", ar: "الفروع والأدوار" }, href: (locale) => `/${locale}/demo/branches` },
      { key: "configuration", labels: { en: "Configuration", ur: "کنفیگریشن", ar: "التهيئة" }, href: (locale) => `/${locale}/demo/configuration` }
    ]
  }
];

const mobileNav: NavItem[] = [
  { key: "overview", labels: { en: "Overview", ur: "جائزہ", ar: "نظرة" }, href: (locale) => `/${locale}` },
  { key: "admissions", labels: { en: "Admissions", ur: "داخلہ", ar: "القبول" }, href: (locale) => `/${locale}/demo/admissions` },
  { key: "students", labels: { en: "Students", ur: "طلبہ", ar: "الطلاب" }, href: (locale) => `/${locale}/demo/students` },
  { key: "modules", labels: { en: "All modules", ur: "تمام ماڈیولز", ar: "كل الوحدات" }, href: (locale) => `/${locale}/demo` }
];

const demoLabels: Record<Locale, { badge: string; workspace: string }> = {
  en: { badge: "Full ERP Demo", workspace: "4,000-student client scenario" },
  ur: { badge: "مکمل ERP ڈیمو", workspace: "4,000 طلبہ کا کلائنٹ منظرنامہ" },
  ar: { badge: "عرض ERP كامل", workspace: "سيناريو عميل لـ 4,000 طالب" }
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ME";
}

export async function AppShell({ children, locale, workspace }: AppShellProps) {
  const app = await getTranslations("App");
  const branchLabel = workspace.branchName || "Main Branch";
  const demo = demoLabels[locale];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {app("skipToContent")}
      </a>

      <aside className="sidebar" aria-label={app("productName")}>
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>{app("productName")}</span>
        </div>
        <span className="status-pill demo-status-pill">{demo.badge}</span>

        <div className="institution-card">
          <strong>{workspace.tenantName}</strong>
          <span>{branchLabel}</span>
        </div>

        <nav aria-label={app("openMenu")} className="primary-nav demo-primary-nav">
          {navGroups.map((group) => (
            <div className="nav-section" key={group.key}>
              <p className="nav-section-label">{group.labels[locale]}</p>
              {group.items.map((item) => (
                <a href={item.href(locale)} key={item.key} className="nav-link">
                  {item.labels[locale]}
                </a>
              ))}
            </div>
          ))}
        </nav>

        <LocaleSwitcher currentLocale={locale} label={app("changeLanguage")} />
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="topbar-context">{workspace.tenantName}</p>
            <p className="topbar-session">
              {branchLabel} · {demo.workspace}
            </p>
          </div>
          <LocaleSwitcher currentLocale={locale} label={app("changeLanguage")} />
          <SignOutButton
            label={app("userMenu")}
            initials={initials(workspace.displayName)}
            title={workspace.displayName}
          />
        </header>

        <main id="main-content" className="main-content">
          {children}
        </main>
      </div>

      <nav className="mobile-nav demo-mobile-nav" aria-label={app("openMenu")}>
        {mobileNav.map((item) => (
          <a href={item.href(locale)} key={item.key}>
            {item.labels[locale]}
          </a>
        ))}
      </nav>
    </div>
  );
}
