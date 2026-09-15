import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phase 5 admissions visible-locale contract", () => {
  it("does not expose Arabic inputs in institution configuration", () => {
    const source = read("src/components/admissions-foundation-setup.tsx");
    expect(source).toContain('en: value("sessionEn")');
    expect(source).toContain('ur: value("sessionUr")');
    expect(source).toContain('en: value("programEn")');
    expect(source).toContain('ur: value("programUr")');
    expect(source).not.toContain('name="sessionAr"');
    expect(source).not.toContain('name="programAr"');
    expect(source).not.toContain('value("sessionAr")');
    expect(source).not.toContain('value("programAr")');
  });

  it("keeps the legacy Arabic storage key internal while requiring English and Urdu", () => {
    const source = read("src/lib/admissions/foundation.ts");
    expect(source).toContain("const ar = suppliedAr || ur");
    expect(source).toContain('errors.push("English and Urdu session labels are required.")');
    expect(source).toContain('errors.push("English and Urdu program labels are required.")');
    expect(source).not.toContain("English, Urdu and Arabic session labels are required.");
    expect(source).not.toContain("English, Urdu and Arabic program labels are required.");
  });
});
