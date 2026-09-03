"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import styles from "./mobile-navigation.module.css";

type MobileNavItem = { key: string; label: string; href: string };
type MobileNavGroup = { key: string; label: string; items: MobileNavItem[] };
type MobileNavigationProps = {
  locale: Locale;
  groups: MobileNavGroup[];
  quickItems: MobileNavItem[];
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
  groups,
  quickItems,
  menuLabel,
  closeLabel,
  navigationLabel,
  institutionName,
  branchLabel
}: MobileNavigationProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const closeDrawer = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  return (
    <>
      <nav className={styles.bottomNav} aria-label={navigationLabel}>
        {quickItems.map((item) => (
          <Link href={item.href} key={item.key} prefetch={false} aria-current={isCurrentPath(pathname, item.href) ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
        <button
          ref={triggerRef}
          className={styles.menuTab}
          type="button"
          aria-expanded={open}
          aria-controls={drawerId}
          onClick={() => setOpen(true)}
        >
          <span className={styles.menuIcon} aria-hidden="true"><i /><i /><i /></span>
          <span>{menuLabel}</span>
        </button>
      </nav>

      <div className={styles.drawerLayer} data-open={open ? "true" : "false"} aria-hidden={!open}>
        <button className={styles.backdrop} type="button" tabIndex={open ? 0 : -1} aria-label={closeLabel} onClick={() => closeDrawer()} />
        <aside ref={drawerRef} id={drawerId} className={styles.drawer} aria-label={navigationLabel} aria-modal={open ? "true" : undefined} role="dialog">
          <header className={styles.drawerHeader}>
            <div><strong>{institutionName}</strong><span>{branchLabel}</span></div>
            <button ref={closeRef} className={styles.closeButton} type="button" tabIndex={open ? 0 : -1} onClick={() => closeDrawer()} aria-label={closeLabel}>×</button>
          </header>
          <nav className={styles.drawerNav} aria-label={navigationLabel}>
            {groups.map((group) => (
              <section className={styles.drawerGroup} key={group.key}>
                <p>{group.label}</p>
                <div>
                  {group.items.map((item) => {
                    const current = isCurrentPath(pathname, item.href);
                    return (
                      <Link
                        className={styles.drawerLink}
                        href={item.href}
                        key={item.key}
                        prefetch={false}
                        tabIndex={open ? 0 : -1}
                        aria-current={current ? "page" : undefined}
                        onClick={() => closeDrawer(false)}
                      >
                        <span className={styles.indicator} aria-hidden="true" />
                        <span>{item.label}</span>
                        <span className={styles.arrow} aria-hidden="true">→</span>
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
