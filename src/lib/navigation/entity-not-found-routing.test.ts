import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const entityRoutes = [
  "app/[locale]/students/[personId]/page.tsx",
  "app/[locale]/staff/[employmentId]/page.tsx",
  "app/[locale]/documents/student-status/[personId]/page.tsx",
  "app/[locale]/admissions/[applicationId]/page.tsx",
  "app/[locale]/admissions/enquiries/[enquiryId]/page.tsx"
];

describe("entity routing states", () => {
  it("renders domain states when valid entity identifiers no longer resolve", () => {
    for (const path of entityRoutes) {
      const page = source(path);
      expect(page, path).toContain("EntityNotFoundState");
    }
  });

  it("keeps malformed dynamic identifiers on the framework not-found path", () => {
    for (const path of entityRoutes) {
      const page = source(path);
      expect(page, path).toContain("notFound()");
    }
  });

  it("does not disguise Qur'an service failures as missing students", () => {
    const page = source("app/[locale]/quran/[personId]/page.tsx");
    expect(page).toContain('error.message==="Student Qur\'an record not found."');
    expect(page).toContain("EntityNotFoundState");
    expect(page).toContain("throw error");
    expect(page).not.toContain("catch{notFound();}");
  });

  it("uses the branded shared state for unmatched localized routes", () => {
    const page = source("app/[locale]/not-found.tsx");
    expect(page).toContain("WorkspaceState");
    expect(page).toContain('code="404"');
  });
});