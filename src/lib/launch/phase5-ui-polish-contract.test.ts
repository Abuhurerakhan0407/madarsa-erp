import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const localeConfig = source("src/lib/i18n/config.ts");
const navLink = source("src/components/app-nav-link.tsx");
const routePending = source("src/components/route-pending-feedback.tsx");
const login = source("src/app/login/page.tsx");
const motion = source("src/components/interface-motion.tsx");
const localeLayout = source("src/app/[locale]/layout.tsx");
const polish = source("src/app/phase5-polish.css");

describe("Client V3 Phase 5 UI polish contract", () => {
  it("exposes only English and Urdu application routes", () => {
    expect(localeConfig).toContain('export const locales = ["en", "ur"] as const;');
  });

  it("warms navigation on intent and renders pending feedback", () => {
    expect(navLink).toContain("router.prefetch(href)");
    expect(navLink).toContain('className="inline-spinner"');
    expect(navLink).toContain("aria-busy");
    expect(routePending).toContain('data-route-pending');
    expect(routePending).toContain('aria-busy');
  });

  it("keeps login visibly pending until successful navigation completes", () => {
    expect(login).toContain("Signing in…");
    expect(login).toContain("navigating = true");
    expect(login).toContain("aria-busy");
  });

  it("uses lightweight native interface motion instead of route-time GSAP loading", () => {
    expect(motion).toContain("element.animate");
    expect(motion).not.toContain('import("gsap")');
  });

  it("loads final card, loading and Urdu readability polish", () => {
    expect(localeLayout).toContain('import "../phase5-polish.css";');
    expect(polish).toContain(".exam-v2-actions");
    expect(polish).toContain(".professional-card");
    expect(polish).toContain('html[lang="ur"] body');
    expect(polish).toContain("--font-naskh-arabic");
    expect(polish).toContain(".route-loading-track");
  });
});
