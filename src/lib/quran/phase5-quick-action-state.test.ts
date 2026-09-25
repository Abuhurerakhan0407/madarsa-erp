import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Client Qur'an daily fast-entry state", () => {
  it("maps persisted day status to the compact status selector", () => {
    const source = read("src/components/quran-daily-register.tsx");
    expect(source).toContain('if (status === "passed") return "pass"');
    expect(source).toContain('if (status === "repeat") return "repeat"');
    expect(source).toContain('if (status === "partial") return "needs_support"');
    expect(source).toContain('if (status === "absent") return "absent"');
    expect(source).toContain('if (status === "no_lesson") return "no_lesson"');
    expect(source).toContain('useState<QuranDailyAction>(()=>persistedAction ?? "pass")');
    expect(source).toContain('value={selectedAction}');
  });

  it("uses one guarded Save/Update mutation and carries the short teacher note", () => {
    const source = read("src/components/quran-daily-register.tsx");
    expect(source).toContain("if (submitLock.current) return");
    expect(source).toContain("submitLock.current = true");
    expect(source).toContain("submitLock.current = false");
    expect(source).toContain("if (teacherNote.trim()) body.teacherNote = teacherNote.trim()");
    expect(source).toContain('className="action-button action-button-primary quran-daily-save"');
    expect(source).toContain("disabled={busy} onClick={submit}");
  });

  it("keeps optional numeric scoring out of the daily fast-entry surface", () => {
    const source = read("src/components/quran-daily-register.tsx");
    expect(source).not.toContain('className="quran-score-fields"');
    expect(source).not.toContain("setTajweed");
    expect(source).not.toContain("setFluency");
    expect(source).not.toContain("setMistakes");
    expect(source).not.toContain('className="quran-quick-buttons"');
  });

  it("remounts rows per lesson date so local entry state cannot bleed into another day", () => {
    const source = read("src/components/quran-daily-register.tsx");
    expect(source).toContain('key={`${data.selectedDate}:${row.personId}`}');
  });
});
