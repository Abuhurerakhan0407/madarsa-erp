import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/lib/i18n/config";
import type { TenantContext } from "@/lib/tenancy/context";

const navigationKeys = [
  "overview",
  "students",
  "attendance",
  "fees",
  "exams",
  "donations",
  "reports",
  "settings"
] as const;

type AppShellProps = {
  children: ReactNode;
  locale: Locale;
  workspace: TenantContext;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ME";
}

export async function AppShell({ children, locale, workspace }: AppShellProps) {
  const [app, nav] = await Promise.all([
    getTranslations("App"),
    getTranslations("Navigation")
  ]);

  const branchLabel = workspace.branchName || "Branch setup pending";

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
          {navigationKeys.map((key, index) => (
            <a
              href={
                index === 0
                  ? `/${locale}`
                  : key === "students"
                    ? `/${locale}/people-academics`
                  : key === "settings"
                    ? `/${locale}/settings/configuration`
                    : `/${locale}#${key}`
              }
              key={key}
              aria-current={index === 0 ? "page" : undefined}
              className="nav-link"
            >
              {nav(key)}
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
              {branchLabel} · {workspace.tenantState}
            </p>
          </div>
          <LocaleSwitcher currentLocale={locale} label={app("changeLanguage")} />
          <button
            type="button"
            className="user-button"
            aria-label={`${app("userMenu")}: ${workspace.displayName}`}
            title={workspace.displayName}
          >
            {initials(workspace.displayName)}
          </button>
        </header>

        <main id="main-content" className="main-content">
          {children}
        </main>
      </div>

      <nav className="mobile-nav" aria-label={app("openMenu")}>
        {navigationKeys.slice(0, 4).map((key, index) => (
          <a
            href={
              index === 0
                ? `/${locale}`
                : key === "students"
                  ? `/${locale}/people-academics`
                  : `/${locale}#${key}`
            }
            key={key}
            aria-current={index === 0 ? "page" : undefined}
          >
            {nav(key)}
          </a>
        ))}
      </nav>
    </div>
  );
}
