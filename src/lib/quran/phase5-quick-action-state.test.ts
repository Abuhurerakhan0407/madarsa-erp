import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phase 5 Qur'an daily quick-action selected state", () => {
  it("maps persisted day status to the corresponding quick action", () => {
    const source = read("src/components/quran-daily-register.tsx");
    expect(source).toContain('if (status === "passed") return "pass"');
    expect(source).toContain('if (status === "repeat") return "repeat"');
    expect(source).toContain('if (status === "partial") return "needs_support"');
    expect(source).toContain('if (status === "absent") return "absent"');
    expect(source).toContain('if (status === "no_lesson") return "no_lesson"');
  });

  it("initializes detailed result from persisted status and keeps the successful action selected immediately", () => {
    const source = read("src/components/quran-daily-register.tsx");
    expect(source).toContain("const persistedAction = actionFromDayStatus(row.dayStatus)");
    expect(source).toContain('useState<QuranDailyAction>(()=>persistedAction ?? "pass")');
    expect(source).toContain("const [savedAction,setSavedAction] = useState<QuranDailyAction|null>(null)");
    expect(source).toContain("const selectedAction = savedAction ?? persistedAction");
    expect(source).toContain("setSavedAction(action)");
    expect(source).toContain("setDetailedAction(action)");
  });

  it("remounts rows per lesson date so optimistic state cannot bleed into another day", () => {
    const source = read("src/components/quran-daily-register.tsx");
    expect(source).toContain('key={`${data.selectedDate}:${row.personId}`}');
  });

  it("exposes the selected quick action semantically and visually", () => {
    const source = read("src/components/quran-daily-register.tsx");
    const css = read("src/app/quran-v2.css");
    expect(source).toContain('aria-pressed={selectedAction==="needs_support"}');
    expect(source).toContain('aria-pressed={selectedAction==="pass"}');
    expect(css).toContain('.quran-quick-buttons button[aria-pressed="true"]');
    expect(css).not.toContain(".quran-quick-buttons button:first-child");
  });
});
