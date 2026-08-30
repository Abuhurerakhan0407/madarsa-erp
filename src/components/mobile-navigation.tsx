"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { Locale } from "@/lib/i18n/config";

type MobileNavItem = {
  key: string;
  label: string;
  href: string;
};

type MobileNavGroup = {
  key: string;
  label: string;
  items: MobileNavItem[];
};

type MobileNavigationProps = {
  locale: Locale;
  groups: MobileNavGroup[];
  overviewLabel: string;
  admissionsLabel: string;
  studentsLabel: string;
  menuLabel: string;
  closeLabel: string;
  navigationLabel: string;
  institutionName: string;
  branchLabel: string;
};

function isCurrentPath(pathname: string, href: string): boolean {
  if (href === "/en" || href === "/ur" || href === "/ar") return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNavigation({
  locale,
  groups,
  overviewLabel,
  admissionsLabel,
  studentsLabel,
  menuLabel,
  closeLabel,
  navigationLabel,
  institutionName,
  branchLabel
}: MobileNavigationProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawerId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const quickItems: MobileNavItem[] = [
    { key: "overview", label: overviewLabel, href: `/${locale}` },
    { key: "admissions", label: admissionsLabel, href: `/${locale}/admissions` },
    { key: "students", label: studentsLabel, href: `/${locale}/students` }
  ];

  return (
    <>
      <nav className="mobile-nav professional-mobile-nav" aria-label={navigationLabel}>
        {quickItems.map((item) => (
          <Link
            href={item.href}
            key={item.key}
            prefetch={false}
            aria-current={isCurrentPath(pathname, item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
        <button
          className="mobile-menu-tab"
          type="button"
          aria-expanded={open}
          aria-controls={drawerId}
          onClick={() => setOpen(true)}
        >
          <span className="mobile-menu-icon" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>{menuLabel}</span>
        </button>
      </nav>

      <div className="mobile-drawer-layer" data-open={open ? "true" : "false"} aria-hidden={!open}>
        <button className="mobile-drawer-backdrop" type="button" tabIndex={open ? 0 : -1} aria-label={closeLabel} onClick={() => setOpen(false)} />
        <aside id={drawerId} className="mobile-navigation-drawer" aria-label={navigationLabel}>
          <header className="mobile-drawer-header">
            <div>
              <strong>{institutionName}</strong>
              <span>{branchLabel}</span>
            </div>
            <button className="mobile-drawer-close" type="button" onClick={() => setOpen(false)} aria-label={closeLabel}>×</button>
          </header>

          <nav className="mobile-drawer-nav" aria-label={navigationLabel}>
            {groups.map((group) => (
              <section className="mobile-drawer-group" key={group.key}>
                <p>{group.label}</p>
                <div>
                  {group.items.map((item) => {
                    const current = isCurrentPath(pathname, item.href);
                    return (
                      <Link
                        className="mobile-drawer-link"
                        href={item.href}
                        key={item.key}
                        prefetch={false}
                        aria-current={current ? "page" : undefined}
                      >
                        <span className="mobile-drawer-indicator" aria-hidden="true" />
                        <span>{item.label}</span>
                        <span className="mobile-drawer-arrow" aria-hidden="true">→</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>
        </aside>
      </div>
    </>
  );
}
