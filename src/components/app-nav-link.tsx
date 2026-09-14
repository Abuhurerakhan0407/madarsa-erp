"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
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
  const [pending, setPending] = useState(false);
  const normalizedHref = href.replace(/\/$/, "").split("?")[0];
  const isOverview = /^\/(en|ur)$/.test(normalizedHref);
  const isActive = isOverview
    ? pathname === normalizedHref
    : pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  function warmRoute() {
    if (!isActive) router.prefetch(href);
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (pending) {
      event.preventDefault();
      return;
    }
    if (!isActive) setPending(true);
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
