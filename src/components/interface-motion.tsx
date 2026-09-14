"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function InterfaceMotion() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const elements = Array.from(
      document.querySelectorAll<HTMLElement>("#main-content > [data-page-section]")
    );

    const animations = elements.map((element, index) =>
      element.animate(
        [
          { opacity: 0, transform: "translateY(6px)" },
          { opacity: 1, transform: "translateY(0)" }
        ],
        {
          duration: 180,
          delay: index * 18,
          easing: "cubic-bezier(.2,.8,.2,1)",
          fill: "both"
        }
      )
    );

    return () => animations.forEach((animation) => animation.cancel());
  }, [pathname]);

  return null;
}
