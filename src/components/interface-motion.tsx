"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function InterfaceMotion() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let cancelled = false;
    let context: { revert: () => void } | undefined;

    const timer = window.setTimeout(() => {
      void import("gsap").then(({ gsap }) => {
        if (cancelled) return;

        const elements = gsap.utils.toArray<HTMLElement>("#main-content > [data-page-section]");
        if (elements.length === 0) return;

        context = gsap.context(() => {
          gsap.fromTo(
            elements,
            { autoAlpha: 0, y: 10 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.38,
              stagger: 0.035,
              ease: "power2.out",
              clearProps: "opacity,visibility,transform"
            }
          );
        });
      });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      context?.revert();
    };
  }, [pathname]);

  return null;
}
