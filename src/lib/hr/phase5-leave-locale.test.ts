import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phase 5 staff leave English and Urdu contract", () => {
  it("localizes leave request states instead of rendering backend keys", () => {
    const source = read("src/components/hr-leave-workspace.tsx");
    expect(source).toContain("stateLabel(row.state, locale)");
    expect(source).toContain('submitted: "زیرِ التوا"');
    expect(source).toContain('approved: "منظور"');
    expect(source).not.toContain('<span className="status-chip">{row.state}</span>');
  });

  it("keeps Urdu failures user-safe instead of exposing backend English", () => {
    const source = read("src/components/hr-leave-workspace.tsx");
    expect(source).toContain('locale === "ur" ? t.error');
    expect(source).toContain("localizedApprovalReason(locale)");
    expect(source).toContain('return locale === "ur" ? "HR نے منظور کیا"');
  });

  it("shows visible pending feedback for submit and leave decisions", () => {
    const source = read("src/components/hr-leave-workspace.tsx");
    expect(source).toContain("aria-busy={unavailable || undefined}");
    expect(source).toContain("aria-busy={busy === approveKey || undefined}");
    expect(source).toContain("aria-busy={busy === rejectKey || undefined}");
    expect(source).toContain("inline-spinner");
  });
});
