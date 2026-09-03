import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { AppNavLink } from "@/components/app-nav-link";
import { InterfaceMotion } from "@/components/interface-motion";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { MobileNavigation } from "@/components/mobile-navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { resolveClientProfile } from "@/lib/capabilities/client-profile";
import type { Locale } from "@/lib/i18n/config";
import { findNavItem, getVisibleNavigation } from "@/lib/navigation/app-navigation";
import type { TenantContext } from "@/lib/tenancy/context";

type AppShellProps = { children: ReactNode; locale: Locale; workspace: TenantContext };

const shellCopy: Record<Locale, { productLine: string; academicYear: string; navigation: string; menu: string; close: string; workspace: string }> = {
  en: { productLine: "Institution operations", academicYear: "Academic year 2026–27", navigation: "Workspace navigation", menu: "Menu", close: "Close menu", workspace: "Workspace" },
  ur: { productLine: "ادارہ آپریشنز", academicYear: "تعلیمی سال 2026–27", navigation: "ورک اسپیس نیویگیشن", menu: "مینو", close: "مینو بند کریں", workspace: "ورک اسپیس" },
  ar: { productLine: "عمليات المؤسسة", academicYear: "العام الدراسي 2026–27", navigation: "تنقل مساحة العمل", menu: "القائمة", close: "إغلاق القائمة", workspace: "مساحة العمل" }
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ME";
}

export async function AppShell({ children, locale, workspace }: AppShellProps) {
  const app = await getTranslations("App");
  const branchLabel = workspace.branchName || "Main Branch";
  const copy = shellCopy[locale];
  const clientProfile = resolveClientProfile(workspace.tenantSlug);
  const visibleNavGroups = getVisibleNavigation(clientProfile);
  const mobileGroups = visibleNavGroups.map((group) => ({
    key: group.key,
    label: group.labels[locale],
    items: group.items.map((item) => ({ key: item.key, label: item.labels[locale], href: item.href(locale) }))
  }));
  const quickKeys = ["overview", "students", "attendance"] as const;
  const quickItems = quickKeys.map((key) => {
    const item = findNavItem(key);
    if (!item) throw new Error(`Missing navigation item: ${key}`);
    return { key: item.key, label: item.labels[locale], href: item.href(locale) };
  });

  return (
    <div className="app-shell professional-shell client-v2-shell">
      <a className="skip-link" href="#main-content">{app("skipToContent")}</a>
      <aside className="sidebar professional-sidebar client-v2-sidebar" aria-label={copy.navigation}>
        <div className="brand-lockup professional-brand-lockup">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span className="brand-copy"><strong>{app("productName")}</strong><small>{copy.productLine}</small></span>
        </div>
        <div className="institution-card professional-institution-card client-v2-institution">
          <span className="client-v2-institution-label">{copy.workspace}</span>
          <strong>{workspace.tenantName}</strong>
          <span>{branchLabel}</span>
          <small>{copy.academicYear}</small>
        </div>
        <nav aria-label={app("openMenu")} className="primary-nav demo-primary-nav client-v2-primary-nav">
          {visibleNavGroups.map((group) => (
            <div className="nav-section" key={group.key}>
              <p className="nav-section-label">{group.labels[locale]}</p>
              {group.items.map((item) => (
                <AppNavLink href={item.href(locale)} key={item.key} className="nav-link">
                  <span className="nav-indicator" aria-hidden="true" />
                  <span>{item.labels[locale]}</span>
                </AppNavLink>
              ))}
            </div>
          ))}
        </nav>
        <LocaleSwitcher currentLocale={locale} label={app("changeLanguage")} />
      </aside>
      <div className="workspace">
        <header className="topbar professional-topbar client-v2-topbar">
          <div className="topbar-school-context"><p className="topbar-context">{workspace.tenantName}</p><p className="topbar-session">{branchLabel} · {copy.academicYear}</p></div>
          <div className="topbar-actions"><LocaleSwitcher currentLocale={locale} label={app("changeLanguage")} /><SignOutButton label={app("userMenu")} initials={initials(workspace.displayName)} title={workspace.displayName} /></div>
        </header>
        <main id="main-content" className="main-content professional-main-content client-v2-main"><InterfaceMotion />{children}</main>
      </div>
      <MobileNavigation locale={locale} groups={mobileGroups} quickItems={quickItems} menuLabel={copy.menu} closeLabel={copy.close} navigationLabel={copy.navigation} institutionName={workspace.tenantName} branchLabel={branchLabel} />
    </div>
  );
}
