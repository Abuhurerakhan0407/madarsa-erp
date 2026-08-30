"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppNavLink } from "@/components/app-nav-link";

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

type MobileWorkspaceNavigationProps = {
  ariaLabel: string;
  menuLabel: string;
  closeLabel: string;
  menuTitle: string;
  quickItems: MobileNavItem[];
  groups: MobileNavGroup[];
};

export function MobileWorkspaceNavigation({
  ariaLabel,
  menuLabel,
  closeLabel,
  menuTitle,
  quickItems,
  groups
}: MobileWorkspaceNavigationProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <nav className="mobile-nav professional-mobile-nav" aria-label={ariaLabel}>
        {quickItems.map((item) => (
          <AppNavLink href={item.href} key={item.key}>
            {item.label}
          </AppNavLink>
        ))}
        <button
          type="button"
          className="mobile-menu-trigger"
          aria-expanded={open}
          aria-controls="mobile-workspace-menu"
          onClick={() => setOpen(true)}
        >
          <span className="mobile-menu-icon" aria-hidden="true">☰</span>
          <span>{menuLabel}</span>
        </button>
      </nav>

      {open ? (
        <div className="mobile-navigation-layer" role="presentation">
          <button
            type="button"
            className="mobile-navigation-backdrop"
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
          />
          <section
            id="mobile-workspace-menu"
            className="mobile-navigation-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-workspace-menu-title"
          >
            <header className="mobile-navigation-header">
              <div>
                <p className="state-kicker">{ariaLabel}</p>
                <h2 id="mobile-workspace-menu-title">{menuTitle}</h2>
              </div>
              <button
                type="button"
                className="mobile-navigation-close"
                onClick={() => setOpen(false)}
                aria-label={closeLabel}
              >
                ×
              </button>
            </header>

            <div className="mobile-navigation-scroll">
              {groups.map((group) => (
                <section className="mobile-navigation-group" key={group.key}>
                  <h3>{group.label}</h3>
                  <nav aria-label={group.label}>
                    {group.items.map((item) => (
                      <AppNavLink href={item.href} key={item.key} className="mobile-navigation-link">
                        <span>{item.label}</span>
                        <span aria-hidden="true">→</span>
                      </AppNavLink>
                    ))}
                  </nav>
                </section>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
