import { Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { AppNavLink } from "@/components/app-nav-link";
import { GlobalStudentSearch } from "@/components/global-student-search";
import { InterfaceMotion } from "@/components/interface-motion";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { MobileNavigation } from "@/components/mobile-navigation";
import { RoutePendingFeedback } from "@/components/route-pending-feedback";
import { SessionRouteMemory } from "@/components/session-route-memory";
import { SignOutButton } from "@/components/sign-out-button";
import { ErrorState } from "@/components/workspace-ui";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getNavigationAudience } from "@/lib/navigation/audience";
import { JAMIA_CLIENT, JAMIA_OFFICE_NAV } from "@/lib/client-branding";
import type { TenantContext } from "@/lib/tenancy/context";

type AppShellProps = { children: ReactNode; locale: SupportedLocale; workspace: TenantContext };
const shellCopy: Record<SupportedLocale, {
  productLine: string;
  year: string;
  navigation: string;
  menu: string;
  close: string;
  workspace: string;
  more: string;
  newAdmission: string;
  mainBranch: string;
}> = {
  en: { productLine: "Institution operations", year: "Academic year", navigation: "Workspace navigation", menu: "Menu", close: "Close menu", workspace: "Workspace", more: "More", newAdmission: "+ New Admission", mainBranch: "Main Branch" },
  ur: { productLine: "ادارہ آپریشنز", year: "تعلیمی سال", navigation: "ورک اسپیس نیویگیشن", menu: "مینو", close: "مینو بند کریں", workspace: "ورک اسپیس", more: "مزید", newAdmission: "+ نیا داخلہ", mainBranch: "مرکزی برانچ" }
};
const accessDeniedCopy: Record<SupportedLocale, { title: string; body: string }> = {
  en: { title: "Workspace access unavailable", body: "Your account does not have a verified workspace role. Ask an administrator to review your access before continuing." },
  ur: { title: "ورک اسپیس تک رسائی دستیاب نہیں", body: "آپ کے اکاؤنٹ کے لیے تصدیق شدہ ورک اسپیس کردار موجود نہیں ہے۔ جاری رکھنے سے پہلے منتظم سے اپنی رسائی چیک کروائیں۔" }
};

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ME";
}

export async function AppShell({ children, locale, workspace }: AppShellProps) {
  const [app, audience] = await Promise.all([
    getTranslations("App"),
    getNavigationAudience(workspace)
  ]);
  const copy = shellCopy[locale];

  if (audience === "neutral") {
    const denied = accessDeniedCopy[locale];
    return <div className="app-shell professional-shell client-v2-shell" data-client-v3 data-navigation-audience="neutral">
      <main id="main-content" className="main-content professional-main-content client-v2-main">
        <ErrorState code="403" title={denied.title} body={denied.body} />
        <div className="topbar-actions">
          <LocaleSwitcher currentLocale={locale} label={app("changeLanguage")} />
          <SignOutButton label={app("userMenu")} initials={initials(workspace.displayName)} title={workspace.displayName} locale={locale} />
        </div>
      </main>
    </div>;
  }

  const clientName = locale === "ur" ? JAMIA_CLIENT.nameUr : JAMIA_CLIENT.name;
  const clientShortName = locale === "ur" ? JAMIA_CLIENT.shortNameUr : JAMIA_CLIENT.shortName;
  const branchLabel = locale === "ur" ? "مرکزی کیمپس" : JAMIA_CLIENT.branch;
  const academicSessionLabel = JAMIA_CLIENT.year;
  const nav = audience === "teacher"
    ? JAMIA_OFFICE_NAV.filter((item) => ["home", "talaba", "attendance", "hifz", "portals"].includes(item.key))
    : JAMIA_OFFICE_NAV;
  const quickKeys = new Set(["home", "talaba", "attendance", "hifz"]);
  const quickItems = nav.filter((item) => quickKeys.has(item.key)).map((item) => ({ key: item.key, label: item.labels[locale], href: item.href(locale) }));
  const supplementalMobileItems = nav.filter((item) => !quickKeys.has(item.key));
  const mobileGroups = supplementalMobileItems.length ? [{ key: "menu", label: copy.more, items: supplementalMobileItems.map((item) => ({ key: item.key, label: item.labels[locale], href: item.href(locale) })) }] : [];

  return <div className="app-shell professional-shell client-v2-shell client-jamia-shell" data-client-v3 data-client-jamia data-navigation-audience={audience}>
    <Suspense fallback={null}><RoutePendingFeedback /><SessionRouteMemory /></Suspense>
    <a className="skip-link" href="#main-content">{app("skipToContent")}</a>
    <aside className="sidebar professional-sidebar client-v2-sidebar" aria-label={copy.navigation}>
      <div className="brand-lockup professional-brand-lockup">
        <span className="brand-mark jamia-brand-mark" aria-hidden="true">ج</span>
        <span className="brand-copy"><strong>{clientShortName}</strong><small>{locale === "ur" ? JAMIA_CLIENT.descriptorUr : JAMIA_CLIENT.descriptor}</small></span>
      </div>
      <div className="institution-card professional-institution-card client-v2-institution">
        <span className="client-v2-institution-label">{locale === "ur" ? "ادارہ" : "Institution"}</span>
        <strong>{clientName}</strong>
        <span>{branchLabel}</span>
        <small>{academicSessionLabel}</small>
      </div>
      <nav aria-label={copy.navigation} className="primary-nav demo-primary-nav client-v2-primary-nav">
        <div className="nav-section">{nav.map((item) => <AppNavLink href={item.href(locale)} key={item.key} className="nav-link"><span className="nav-indicator" aria-hidden="true" /><span>{item.labels[locale]}</span></AppNavLink>)}</div>
      </nav>
      <div className="jamia-sidebar-meta">
        <span>{JAMIA_CLIENT.director}</span>
        <a href="tel:9450825657">{JAMIA_CLIENT.phone}</a>
      </div>
      <LocaleSwitcher currentLocale={locale} label={`${app("changeLanguage")} — sidebar`} />
    </aside>
    <div className="workspace">
      <header className="topbar professional-topbar client-v2-topbar" style={{ gap: ".75rem", flexWrap: "wrap" }}>
        <div className="topbar-school-context"><p className="topbar-context">{clientName}</p><p className="topbar-session">{branchLabel} · {academicSessionLabel}</p></div>
        {audience === "office" ? <GlobalStudentSearch locale={locale} /> : null}
        <div className="topbar-actions">{audience === "office" ? <AppNavLink className="action-button action-button-primary" href={`/${locale}/students/new`}>{copy.newAdmission}</AppNavLink> : null}<LocaleSwitcher currentLocale={locale} label={`${app("changeLanguage")} — topbar`} /><SignOutButton label={app("userMenu")} initials={initials(workspace.displayName)} title={workspace.displayName} locale={locale} /></div>
      </header>
      <main id="main-content" className="main-content professional-main-content client-v2-main"><InterfaceMotion />{children}</main>
    </div>
    <MobileNavigation groups={mobileGroups} quickItems={quickItems} menuLabel={copy.menu} closeLabel={copy.close} navigationLabel={copy.navigation} institutionName={clientName} branchLabel={branchLabel} />
  </div>;
}
