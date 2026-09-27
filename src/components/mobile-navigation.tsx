"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./mobile-navigation.module.css";

type MobileNavItem = { key: string; label: string; href: string };
type MobileNavGroup = { key: string; label: string; items: MobileNavItem[] };
type Props = {
  groups: MobileNavGroup[];
  quickItems: MobileNavItem[];
  menuLabel: string;
  closeLabel: string;
  navigationLabel: string;
  institutionName: string;
  branchLabel: string;
};

function current(pathname: string, href: string) {
  const normalizedHref = href.replace(/\/$/, "");
  const isLocaleRoot = /^\/(en|ur)$/.test(normalizedHref);
  return isLocaleRoot ? pathname === normalizedHref || pathname === `${normalizedHref}/` : pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
}

function NavIcon({ itemKey }: { itemKey: string }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (itemKey === "home") return <svg {...common}><path d="M3.5 10.7 12 3.8l8.5 6.9"/><path d="M5.5 9.7v10h13v-10"/><path d="M9.5 19.7v-6h5v6"/></svg>;
  if (itemKey === "admissions") return <svg {...common}><path d="M12 3.5v17"/><path d="M3.5 12h17"/><circle cx="12" cy="12" r="8.5"/></svg>;
  if (itemKey === "students" || itemKey === "my-students") return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.8 19c.5-3.1 2.2-5 5.2-5s4.7 1.9 5.2 5"/><path d="M15.5 6.2a2.7 2.7 0 0 1 0 5.2"/><path d="M16.3 14.3c2.3.6 3.5 2.2 3.9 4.7"/></svg>;
  if (itemKey === "attendance") return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3.5v3M16 3.5v3M4 9h16"/><path d="m8.2 14 2.1 2.1 5-5"/></svg>;
  if (itemKey === "quran") return <svg {...common}><path d="M12 6.2C10.3 4.8 8 4 5 4v14c3 0 5.3.8 7 2.2"/><path d="M12 6.2C13.7 4.8 16 4 19 4v14c-3 0-5.3.8-7 2.2z"/></svg>;
  return <svg {...common}><circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>;
}

export function MobileNavigation({ groups, quickItems, menuLabel, closeLabel, navigationLabel, institutionName, branchLabel }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const visibleGroups = groups.filter((group) => group.items.length > 0);
  const hasMenu = visibleGroups.length > 0;
  const tabCount = quickItems.length + (hasMenu ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
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
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  return <>
    <nav className={styles.bottomNav} aria-label={navigationLabel} style={{ gridTemplateColumns: `repeat(${Math.max(tabCount, 1)}, minmax(0, 1fr))` }}>
      {quickItems.map((item) => <Link href={item.href} key={item.key} data-nav-key={item.key} aria-current={current(pathname, item.href) ? "page" : undefined}><span className={styles.tabIcon}><NavIcon itemKey={item.key} /></span><span className={styles.tabLabel}>{item.label}</span></Link>)}
      {hasMenu ? <button ref={triggerRef} className={styles.menuTab} type="button" aria-expanded={open} aria-controls={drawerId} onClick={() => setOpen(true)}><span className={styles.tabIcon}><NavIcon itemKey="menu" /></span><span className={styles.tabLabel}>{menuLabel}</span></button> : null}
    </nav>
    {hasMenu ? <div className={styles.drawerLayer} data-open={open ? "true" : "false"} aria-hidden={!open}>
      <button className={styles.backdrop} type="button" tabIndex={-1} aria-label={closeLabel} onClick={() => close()} />
      <aside ref={drawerRef} id={drawerId} className={styles.drawer} aria-label={navigationLabel} aria-modal={open ? "true" : undefined} role="dialog">
        <header className={styles.drawerHeader}>
          <div><strong>{institutionName}</strong><span>{branchLabel}</span></div>
          <button ref={closeRef} className={styles.closeButton} type="button" tabIndex={open ? 0 : -1} onClick={() => close()} aria-label={closeLabel}>×</button>
        </header>
        <nav className={styles.drawerNav} aria-label={navigationLabel}>
          {visibleGroups.map((group) => <section className={styles.drawerGroup} key={group.key}><p>{group.label}</p><div>{group.items.map((item) => <Link className={styles.drawerLink} href={item.href} key={item.key} tabIndex={open ? 0 : -1} aria-current={current(pathname, item.href) ? "page" : undefined} onClick={() => close(false)}><span className={styles.indicator} aria-hidden="true" /><span>{item.label}</span><span className={styles.arrow} aria-hidden="true">→</span></Link>)}</div></section>)}
        </nav>
      </aside>
    </div> : null}
  </>;
}
