import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(resolve(process.cwd(), "src/components/exams-results-v2-hub.tsx"), "utf8");

describe("Phase 5 exams Urdu and pending-state contract", () => {
  it("keeps API failures localized on Urdu routes", () => {
    const text = source();
    expect(text).toContain('setError(locale==="ur"?t.error:(payload.error||t.error))');
  });

  it("localizes aggregate result states instead of rendering backend keys", () => {
    const text = source();
    expect(text).toContain("aggregateStatusLabel(student.aggregateStatus,locale)");
    expect(text).toContain('resultPassed:"کامیاب"');
    expect(text).toContain('resultFailed:"ناکام"');
    expect(text).not.toContain("student.percentage??\"—\"}% · {student.aggregateStatus}");
  });

  it("shows spinners and busy state for exam creation, marks, moderation and result workflow", () => {
    const text = source();
    expect(text).toContain('aria-busy={busy==="create-exam"||undefined}');
    expect(text).toContain("aria-busy={busy===saveKey||undefined}");
    expect(text).toContain("aria-busy={busy===moderateKey||undefined}");
    expect(text).toContain('aria-busy={busy==="workflow-calculate"||undefined}');
    expect(text).toContain("inline-spinner");
  });
});
