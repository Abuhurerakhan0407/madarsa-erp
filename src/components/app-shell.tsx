import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { AppNavLink } from "@/components/app-nav-link";
import { InterfaceMotion } from "@/components/interface-motion";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { MobileNavigation } from "@/components/mobile-navigation";
import { SignOutButton } from "@/components/sign-out-button";
import type { Locale } from "@/lib/i18n/config";
import type { TenantContext } from "@/lib/tenancy/context";

type AppShellProps = { children: ReactNode; locale: Locale; workspace: TenantContext };
type NavItem = { key: string; labels: Record<Locale, string>; href: (locale: Locale) => string };
type NavGroup = { key: string; labels: Record<Locale, string>; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    key: "academic",
    labels: { en: "Academic operations", ur: "تعلیمی آپریشنز", ar: "العمليات الأكاديمية" },
    items: [
      { key: "overview", labels: { en: "Overview", ur: "جائزہ", ar: "نظرة عامة" }, href: (locale) => `/${locale}` },
      { key: "admissions", labels: { en: "Admissions", ur: "داخلہ", ar: "القبول" }, href: (locale) => `/${locale}/admissions` },
      { key: "students", labels: { en: "Students", ur: "طلبہ", ar: "الطلاب" }, href: (locale) => `/${locale}/students` },
      { key: "academics", labels: { en: "Academics & Timetable", ur: "اکیڈمکس و ٹائم ٹیبل", ar: "الأكاديميات والجدول" }, href: (locale) => `/${locale}/people-academics` },
      { key: "attendance", labels: { en: "Attendance & Biometrics", ur: "حاضری و بایومیٹرکس", ar: "الحضور والبيومتري" }, href: (locale) => `/${locale}/attendance` },
      { key: "quran", labels: { en: "Qur'an & Hifz", ur: "قرآن و حفظ", ar: "القرآن والحفظ" }, href: (locale) => `/${locale}/quran` },
      { key: "fees", labels: { en: "Fees & Accounting", ur: "فیس و اکاؤنٹنگ", ar: "الرسوم والمحاسبة" }, href: (locale) => `/${locale}/demo/fees` },
      { key: "exams", labels: { en: "Exams & Results", ur: "امتحانات و نتائج", ar: "الاختبارات والنتائج" }, href: (locale) => `/${locale}/exams` }
    ]
  },
  {
    key: "campus",
    labels: { en: "Campus operations", ur: "کیمپس آپریشنز", ar: "عمليات الحرم" },
    items: [
      { key: "portals", labels: { en: "Parent & Staff Portals", ur: "والدین و عملہ پورٹلز", ar: "بوابات أولياء الأمور والموظفين" }, href: (locale) => `/${locale}/demo/portals` },
      { key: "operations", labels: { en: "Import, Promotion & Renewal", ur: "امپورٹ، پروموشن و رینیول", ar: "الاستيراد والترفيع والتجديد" }, href: (locale) => `/${locale}/demo/operations` },
      { key: "donations", labels: { en: "Donations & Sponsorships", ur: "عطیات و کفالت", ar: "التبرعات والكفالات" }, href: (locale) => `/${locale}/demo/donations` },
      { key: "hostel", labels: { en: "Hostel & Mess", ur: "ہاسٹل و میس", ar: "السكن والإعاشة" }, href: (locale) => `/${locale}/demo/hostel` },
      { key: "transport", labels: { en: "Transport & Routes", ur: "ٹرانسپورٹ و روٹس", ar: "النقل والمسارات" }, href: (locale) => `/${locale}/demo/transport` },
      { key: "staff", labels: { en: "HR & Payroll", ur: "HR و پے رول", ar: "الموارد البشرية والرواتب" }, href: (locale) => `/${locale}/staff` },
      { key: "library", labels: { en: "Library", ur: "لائبریری", ar: "المكتبة" }, href: (locale) => `/${locale}/demo/library` },
      { key: "certificates", labels: { en: "IDs & Certificates", ur: "ID و سرٹیفکیٹس", ar: "الهويات والشهادات" }, href: (locale) => `/${locale}/demo/certificates` }
    ]
  },
  {
    key: "administration",
    labels: { en: "Administration & intelligence", ur: "انتظامیہ و انٹیلیجنس", ar: "الإدارة والذكاء" },
    items: [
      { key: "reports", labels: { en: "Reports & Analytics", ur: "رپورٹس و اینالیٹکس", ar: "التقارير والتحليلات" }, href: (locale) => `/${locale}/demo/reports` },
      { key: "whatsapp", labels: { en: "WhatsApp Automation", ur: "واٹس ایپ آٹومیشن", ar: "أتمتة واتساب" }, href: (locale) => `/${locale}/demo/whatsapp` },
      { key: "ai", labels: { en: "AI Assistant", ur: "AI معاون", ar: "مساعد الذكاء الاصطناعي" }, href: (locale) => `/${locale}/demo/ai` },
      { key: "branches", labels: { en: "Branches & Roles", ur: "برانچز و رولز", ar: "الفروع والأدوار" }, href: (locale) => `/${locale}/demo/branches` },
      { key: "configuration", labels: { en: "Configuration", ur: "کنفیگریشن", ar: "التهيئة" }, href: (locale) => `/${locale}/settings/configuration` }
    ]
  }
];

const shellCopy: Record<Locale, { productLine: string; academicYear: string; navigation: string; menu: string; close: string }> = {
  en: { productLine: "School administration", academicYear: "Academic year 2026–27", navigation: "Workspace navigation", menu: "Menu", close: "Close menu" },
  ur: { productLine: "ادارہ انتظامیہ", academicYear: "تعلیمی سال 2026–27", navigation: "ورک اسپیس نیویگیشن", menu: "مینو", close: "مینو بند کریں" },
  ar: { productLine: "إدارة المؤسسة", academicYear: "العام الدراسي 2026–27", navigation: "تنقل مساحة العمل", menu: "القائمة", close: "إغلاق القائمة" }
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ME";
}

export async function AppShell({ children, locale, workspace }: AppShellProps) {
  const app = await getTranslations("App");
  const branchLabel = workspace.branchName || "Main Branch";
  const copy = shellCopy[locale];
  const mobileGroups = navGroups.map((group) => ({
    key: group.key,
    label: group.labels[locale],
    items: group.items.map((item) => ({ key: item.key, label: item.labels[locale], href: item.href(locale) }))
  }));

  return (
    <div className="app-shell professional-shell">
      <a className="skip-link" href="#main-content">{app("skipToContent")}</a>
      <aside className="sidebar professional-sidebar" aria-label={copy.navigation}>
        <div className="brand-lockup professional-brand-lockup"><span className="brand-mark" aria-hidden="true">M</span><span className="brand-copy"><strong>{app("productName")}</strong><small>{copy.productLine}</small></span></div>
        <div className="institution-card professional-institution-card"><strong>{workspace.tenantName}</strong><span>{branchLabel}</span><small>{copy.academicYear}</small></div>
        <nav aria-label={app("openMenu")} className="primary-nav demo-primary-nav">
          {navGroups.map((group) => <div className="nav-section" key={group.key}><p className="nav-section-label">{group.labels[locale]}</p>{group.items.map((item) => <AppNavLink href={item.href(locale)} key={item.key} className="nav-link"><span className="nav-indicator" aria-hidden="true" /><span>{item.labels[locale]}</span></AppNavLink>)}</div>)}
        </nav>
        <LocaleSwitcher currentLocale={locale} label={app("changeLanguage")} />
      </aside>
      <div className="workspace">
        <header className="topbar professional-topbar">
          <div className="topbar-school-context"><p className="topbar-context">{workspace.tenantName}</p><p className="topbar-session">{branchLabel} · {copy.academicYear}</p></div>
          <div className="topbar-actions"><LocaleSwitcher currentLocale={locale} label={app("changeLanguage")} /><SignOutButton label={app("userMenu")} initials={initials(workspace.displayName)} title={workspace.displayName} /></div>
        </header>
        <main id="main-content" className="main-content professional-main-content"><InterfaceMotion />{children}</main>
      </div>
      <MobileNavigation locale={locale} groups={mobileGroups} overviewLabel={navGroups[0].items[0].labels[locale]} admissionsLabel={navGroups[0].items[1].labels[locale]} studentsLabel={navGroups[0].items[2].labels[locale]} menuLabel={copy.menu} closeLabel={copy.close} navigationLabel={copy.navigation} institutionName={workspace.tenantName} branchLabel={branchLabel} />
    </div>
  );
}
