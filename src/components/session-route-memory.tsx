"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const COOKIE_NAME = "ILMGAAH_LAST_ROUTE";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function isRestorablePath(pathname: string) {
  return /^\/(en|ur)(?:\/|$)/.test(pathname);
}

export function SessionRouteMemory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    if (!isRestorablePath(pathname)) return;
    const route = query ? `${pathname}?${query}` : pathname;
    document.cookie =
      `${COOKIE_NAME}=${encodeURIComponent(route)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
  }, [pathname, query]);

  return null;
}
