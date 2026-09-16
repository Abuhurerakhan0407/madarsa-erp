import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phase 5 teacher detail final-touch contract", () => {
  it("keeps the teacher detail page on dedicated responsive hierarchy instead of the generic four-card grid", () => {
    const page = read("src/app/[locale]/staff/[employmentId]/page.tsx");
    const css = read("src/app/[locale]/staff/[employmentId]/page.module.css");

    expect(page).toContain('data-testid="teacher-detail-hero"');
    expect(page).toContain('data-testid="teacher-detail-summary"');
    expect(page).toContain('data-testid="teacher-detail-scope"');
    expect(page).toContain('data-testid="teacher-detail-timetable"');
    expect(page).toContain("styles.summaryGrid");
    expect(page).not.toContain('<section className="demo-card-grid"><article className="professional-card"');
    expect(css).toContain("grid-template-columns: minmax(0, 1.15fr) minmax(18rem, 0.85fr)");
    expect(css).toContain("@media (max-width: 520px)");
  });

  it("provides a professional photo fallback and does not leak English assignment labels on Urdu routes", () => {
    const page = read("src/app/[locale]/staff/[employmentId]/page.tsx");
    expect(page).toContain("initials(teacher.displayName)");
    expect(page).toContain('if (locale === "ur") return labels.ur || fallback;');
    expect(page).toContain("return labels.en || fallback;");
    expect(page).not.toContain("labels[locale]||labels.en||labels.ur||labels.ar||fallback");
  });
});
