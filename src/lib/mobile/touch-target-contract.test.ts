import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("mobile touch target contracts", () => {
  it("keeps attendance mark actions at least 44px tall on mobile", () => {
    const css = read("src/app/[locale]/attendance/attendance.css");
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.attendance-mark\s*\{[\s\S]*?min-height:\s*2\.85rem;/);
  });

  it("keeps Quran mistake number inputs at least 44px tall on mobile", () => {
    const css = read("src/app/[locale]/quran/quran.css");
    expect(css).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.quran-mistakes input\s*\{[\s\S]*?min-height:\s*44px;/);
  });
});
