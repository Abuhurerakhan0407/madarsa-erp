"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";

export function InterfaceMotion() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const elements = gsap.utils.toArray<HTMLElement>("#main-content > [data-page-section]");
    if (elements.length === 0) return;

    const context = gsap.context(() => {
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

    return () => context.revert();
  }, [pathname]);

  return null;
}
