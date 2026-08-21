import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import type { Locale } from "@/lib/i18n/config";
import type { TenantContext } from "@/lib/tenancy/context";

const navigationKeys = [
  "overview",
  "admissions",
  "students",
  "attendance",
  "fees",
  "exams",
  "donations",
  "reports",
  "settings"
] as const;

type NavigationKey = (typeof navigationKeys)[number];

type AppShellProps = {
  children: ReactNode;
  locale: Locale;
  workspace: TenantContext;
};

const disabledNavStyle = {
  pointerEvents: "none",
  opacity: 0.55
} as const;

const admissionsNavigationLabels: Record<Locale, string> = {
  en: "Admissions",
  ur: "داخلہ",
  ar: "القبول"
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ME";
}

function navigationHref(locale: Locale, key: NavigationKey): string | null {
  if (key === "overview") return `/${locale}`;
  if (key === "admissions") return `/${locale}/admissions`;
  if (key === "students") return `/${locale}/people-academics`;
  if (key === "settings") return `/${locale}/settings/configuration`;
  return null;
}

export async function AppShell({ children, locale, workspace }: AppShellProps) {
  const [app, nav] = await Promise.all([
    getTranslations("App"),
    getTranslations("Navigation")
  ]);

  const branchLabel = workspace.branchName || "Branch setup pending";
  const navigationLabel = (key: NavigationKey) =>
    key === "admissions" ? admissionsNavigationLabels[locale] : nav(key);

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

        <div className="institution-card">
          <strong>{workspace.tenantName}</strong>
          <span>{branchLabel}</span>
        </div>

        <nav aria-label={app("openMenu")} className="primary-nav">
          {navigationKeys.map((key) => {
            const href = navigationHref(locale, key);
            if (!href) {
              return (
                <span
                  className="nav-link"
                  aria-disabled="true"
                  key={key}
                  style={disabledNavStyle}
                >
                  {navigationLabel(key)}
                </span>
              );
            }

            return (
              <a href={href} key={key} className="nav-link">
                {navigationLabel(key)}
              </a>
            );
          })}
        </nav>

        <LocaleSwitcher currentLocale={locale} label={app("changeLanguage")} />
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="topbar-context">{workspace.tenantName}</p>
            <p className="topbar-session">
              {branchLabel} · {workspace.tenantState}
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
        {navigationKeys.slice(0, 4).map((key) => {
          const href = navigationHref(locale, key);
          if (!href) {
            return (
              <a aria-disabled="true" key={key} style={disabledNavStyle}>
                {navigationLabel(key)}
              </a>
            );
          }

          return (
            <a href={href} key={key}>
              {navigationLabel(key)}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
