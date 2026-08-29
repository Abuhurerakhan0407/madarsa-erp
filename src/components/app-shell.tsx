import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import type { Locale } from "@/lib/i18n/config";
import type { TenantContext } from "@/lib/tenancy/context";

const navigationKeys = [
  "overview",
  "admissions",
  "students"
] as const;

type NavigationKey = (typeof navigationKeys)[number];

type AppShellProps = {
  children: ReactNode;
  locale: Locale;
  workspace: TenantContext;
};

const admissionsNavigationLabels: Record<Locale, string> = {
  en: "Admissions",
  ur: "داخلہ",
  ar: "القبول"
};

const demoLabels: Record<Locale, { badge: string; workspace: string }> = {
  en: { badge: "Demo", workspace: "Client demonstration" },
  ur: { badge: "ڈیمو", workspace: "کلائنٹ کے لیے عملی نمونہ" },
  ar: { badge: "تجريبي", workspace: "عرض توضيحي للعميل" }
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ME";
}

function navigationHref(locale: Locale, key: NavigationKey): string {
  if (key === "overview") return `/${locale}`;
  if (key === "admissions") return `/${locale}/admissions`;
  return `/${locale}/people-academics`;
}

export async function AppShell({ children, locale, workspace }: AppShellProps) {
  const [app, nav] = await Promise.all([
    getTranslations("App"),
    getTranslations("Navigation")
  ]);

  const branchLabel = workspace.branchName || "Main Branch";
  const navigationLabel = (key: NavigationKey) =>
    key === "admissions" ? admissionsNavigationLabels[locale] : nav(key);
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
          <span className="status-pill">{demo.badge}</span>
        </div>

        <div className="institution-card">
          <strong>{workspace.tenantName}</strong>
          <span>{branchLabel}</span>
        </div>

        <nav aria-label={app("openMenu")} className="primary-nav">
          {navigationKeys.map((key) => (
            <a href={navigationHref(locale, key)} key={key} className="nav-link">
              {navigationLabel(key)}
            </a>
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

      <nav className="mobile-nav" aria-label={app("openMenu")}>
        {navigationKeys.map((key) => (
          <a href={navigationHref(locale, key)} key={key}>
            {navigationLabel(key)}
          </a>
        ))}
      </nav>
    </div>
  );
}
