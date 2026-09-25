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
      {quickItems.map((item) => <Link href={item.href} key={item.key} aria-current={current(pathname, item.href) ? "page" : undefined}>{item.label}</Link>)}
      {hasMenu ? <button ref={triggerRef} className={styles.menuTab} type="button" aria-expanded={open} aria-controls={drawerId} onClick={() => setOpen(true)}><span className={styles.menuIcon} aria-hidden="true"><i /><i /><i /></span><span>{menuLabel}</span></button> : null}
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
