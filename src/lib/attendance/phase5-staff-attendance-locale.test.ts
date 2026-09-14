import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phase 5 teacher attendance English and Urdu contract", () => {
  it("localizes the date filter and keeps its navigation visibly pending", () => {
    const page = read("src/app/[locale]/staff/attendance/page.tsx");
    expect(page).toContain("GetFilterForm");
    expect(page).toContain("GetFilterSubmitButton");
    expect(page).toContain('apply: "دیکھیں"');
    expect(page).toContain('applying: "لوڈ ہو رہا ہے…"');
    expect(page).toContain("aria-label={t.audience}");
    expect(page).not.toContain('aria-label="Attendance audience"');
  });

  it("localizes status, designation, source, trend and time presentation", () => {
    const workspace = read("src/components/hr-attendance-v2-workspace.tsx");
    expect(workspace).toContain("statusLabel(row.status, locale)");
    expect(workspace).toContain("designationLabel(row.designationKey, locale)");
    expect(workspace).toContain("sourceLabel(row, locale)");
    expect(workspace).toContain("time(row.firstScan, locale)");
    expect(workspace).toContain("{t.monthly}");
    expect(workspace).toContain("{t.recorded}");
    expect(workspace).not.toContain("row.source.toUpperCase()");
    expect(workspace).not.toContain('row.status.replaceAll("_"," ")');
  });

  it("does not present retired NFC as an active teacher-attendance capability", () => {
    const workspace = read("src/components/hr-attendance-v2-workspace.tsx");
    expect(workspace).toContain('row.source === "nfc"');
    expect(workspace).toContain("legacyDevice");
    expect(workspace).toContain('legacyDevice: "پرانا ڈیوائس"');
    expect(workspace).not.toContain('return `${row.source.toUpperCase()}');
  });

  it("keeps teacher emergency marking visibly pending and Urdu-safe on failures", () => {
    const workspace = read("src/components/hr-attendance-v2-workspace.tsx");
    expect(workspace).toContain("aria-busy={busy !== null || undefined}");
    expect(workspace).toContain("aria-busy={busy === key || undefined}");
    expect(workspace).toContain("inline-spinner");
    expect(workspace).toContain("setError(t.error)");
    expect(workspace).toContain("locale={supportedLocale}");
  });
});
