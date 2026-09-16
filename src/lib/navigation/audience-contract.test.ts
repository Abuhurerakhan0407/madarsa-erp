import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/lib/navigation/audience.ts"), "utf8");

describe("navigation audience fail-closed contract", () => {
  it("does not treat unresolved role or permission state as a teacher", () => {
    expect(source).toContain('if (!roleIds.length) return "office"');
    expect(source).toContain('if (!permissions.length) return "office"');
    expect(source).not.toContain('if (!roleIds.length) return "teacher"');
    expect(source).not.toContain('if (!permissions.length) return "teacher"');
  });
});
