import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phase 5 route recovery", () => {
  it("keeps common teacher and portal aliases on valid localized surfaces", () => {
    const teachers = read("src/app/[locale]/teachers/page.tsx");
    const portal = read("src/app/[locale]/portal/page.tsx");
    expect(teachers).toContain("redirect(`/${locale}/staff`)");
    expect(portal).toContain("redirect(`/${locale}/portals`)");
  });

  it("renders an Ilmgaah recovery experience instead of a generic dead end", () => {
    const page = read("src/app/[locale]/not-found.tsx");
    const css = read("src/app/[locale]/not-found.module.css");
    expect(page).toContain("ILMGAAH · 404");
    expect(page).toContain('href="/students"');
    expect(page).toContain('"/portals"');
    expect(page).toContain('"/staff"');
    expect(page).toContain("صفحہ نہیں ملا");
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("var(--accent-strong)");
  });
});
