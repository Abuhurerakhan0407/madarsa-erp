import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("client Import Students flow", () => {
  it("hides next-session, promotion, and renewal controls from client UI", () => {
    const page = read("src/app/[locale]/students/lifecycle/page.tsx");
    const center = read("src/components/student-lifecycle-center.tsx");
    expect(page).toContain('title: "Import Students"');
    expect(page).not.toContain("Promotion & Renewal");
    expect(center).not.toContain("/api/students/lifecycle/rollover");
    expect(center).not.toContain("/api/students/lifecycle/session");
    expect(center).not.toContain("Plan rollover");
  });

  it("provides sample CSV, upload, preview, error CSV, confirmation, and progress", () => {
    const center = read("src/components/student-lifecycle-center.tsx");
    expect(center).toContain("STUDENT_IMPORT_TEMPLATE_CSV");
    expect(center).toContain('accept=".csv,text/csv"');
    expect(center).toContain("analyzeStudentImportCsv");
    expect(center).toContain("downloadErrors");
    expect(center).toContain("reviewConfirm");
    expect(center).toContain("<progress />");
  });

  it("prevents rapid duplicate imports and sends a stable request key", () => {
    const center = read("src/components/student-lifecycle-center.tsx");
    expect(center).toContain("const lock = useRef(false)");
    expect(center).toContain("if (!analysis || lock.current || !canImport) return");
    expect(center).toContain("lock.current = true");
    expect(center).toContain("lock.current = false");
    expect(center).toContain("requestKey");
    expect(center).toContain("crypto.randomUUID()");
  });

  it("shows created, linked, skipped/review, and failed result counts", () => {
    const center = read("src/components/student-lifecycle-center.tsx");
    expect(center).toContain("guardian_linked_items");
    expect(center).toContain("blocked_items");
    expect(center).toContain("failed_items");
    expect(center).toContain("copy.linked");
    expect(center).toContain("copy.skipped");
  });
});
