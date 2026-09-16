"use client";

import type { MouseEvent, ReactNode } from "react";
import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type AppNavLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function AppNavLink({ href, children, className }: AppNavLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const normalizedHref = href.replace(/\/$/, "").split("?")[0];
  const isOverview = /^\/(en|ur)$/.test(normalizedHref);
  const isActive = isOverview
    ? pathname === normalizedHref
    : pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);

  function warmRoute() {
    if (!isActive) router.prefetch(href);
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (isActive) return;
    event.preventDefault();
    startTransition(() => router.push(href));
  }

  return (
    <Link
      href={href}
      className={className}
      aria-current={isActive ? "page" : undefined}
      aria-busy={pending || undefined}
      data-managed-pending="true"
      data-pending={pending ? "true" : undefined}
      prefetch={false}
      onMouseEnter={warmRoute}
      onFocus={warmRoute}
      onTouchStart={warmRoute}
      onClick={handleClick}
    >
      {children}
      {pending ? <span className="inline-spinner" aria-hidden="true" /> : null}
    </Link>
  );
}
