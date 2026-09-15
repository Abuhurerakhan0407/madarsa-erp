import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phase 5 localized fallback contract", () => {
  it("localizes the missing branch-name fallback in the app shell", () => {
    const source = read("src/components/app-shell.tsx");
    expect(source).toContain('mainBranch: "Main Branch"');
    expect(source).toContain('mainBranch: "مرکزی برانچ"');
    expect(source).toContain("workspace.branchName || copy.mainBranch");
    expect(source).not.toContain('workspace.branchName || "Main Branch"');
  });

  it("does not show unknown backend student status keys in global search", () => {
    const source = read("src/components/global-student-search.tsx");
    expect(source).toContain('otherStatus: "دیگر حالت"');
    expect(source).toContain("return text.otherStatus");
    expect(source).not.toContain("return status;");
  });

  it("does not show unknown backend student status keys in the student register", () => {
    const source = read("src/app/[locale]/students/page.tsx");
    expect(source).toContain('otherStatus: "دیگر حالت"');
    expect(source).toContain("statusLabels[locale][row.status] ?? text.otherStatus");
    expect(source).not.toContain("statusLabels[locale][row.status] ?? row.status");
  });
});
