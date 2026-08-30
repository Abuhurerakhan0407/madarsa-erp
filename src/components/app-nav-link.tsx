"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AppNavLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function AppNavLink({ href, children, className }: AppNavLinkProps) {
  const pathname = usePathname();
  const normalizedHref = href.replace(/\/$/, "");
  const isOverview = /^\/(en|ur|ar)$/.test(normalizedHref);
  const isActive = isOverview
    ? pathname === normalizedHref
    : pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);

  return (
    <Link
      href={href}
      className={className}
      aria-current={isActive ? "page" : undefined}
      prefetch
    >
      {children}
    </Link>
  );
}
