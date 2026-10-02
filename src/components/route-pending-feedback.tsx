"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function RoutePendingFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const pendingAnchor = useRef<HTMLAnchorElement | null>(null);
  const timeout = useRef<number | null>(null);
  const [pending,setPending]=useState(false);

  const clearPending = useCallback(() => {
    if (timeout.current !== null) {
      window.clearTimeout(timeout.current);
      timeout.current = null;
    }
    if (pendingAnchor.current) {
      pendingAnchor.current.removeAttribute("data-route-pending");
      if (pendingAnchor.current.getAttribute("data-managed-pending") !== "true") {
        pendingAnchor.current.removeAttribute("aria-busy");
      }
      pendingAnchor.current = null;
    }
    document.documentElement.removeAttribute("data-route-pending");
    setPending(false);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(clearPending);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, query, clearPending]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("download") || anchor.target === "_blank") return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.href === window.location.href) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash) return;

      clearPending();
      pendingAnchor.current = anchor;
      anchor.setAttribute("data-route-pending", "true");
      anchor.setAttribute("aria-busy", "true");
      document.documentElement.setAttribute("data-route-pending", "true");
      setPending(true);
      timeout.current = window.setTimeout(clearPending, 15000);
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearPending();
    };
  }, [clearPending]);

  if(!pending)return null;
  return <div className="route-loading" role="status" aria-live="polite" aria-label="Loading next page">
    <div className="route-loading-track" aria-hidden="true"><span /></div>
    <div className="route-loading-pill"><span className="inline-spinner" aria-hidden="true" /><span className="route-loading-label" /></div>
  </div>;
}
