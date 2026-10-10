import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mainActivity = readFileSync(
  resolve(process.cwd(), "android/app/src/main/java/in/ilmgaah/app/MainActivity.java"),
  "utf8"
);

describe("Native dashboard live metrics", () => {
  it("starts without fabricated student or staff counts", () => {
    expect(mainActivity).toContain('private String liveStudents = "—";');
    expect(mainActivity).toContain('private String liveStaff = "—";');
    expect(mainActivity).not.toContain('liveStudents = "تقریباً 350"');
    expect(mainActivity).not.toContain('liveStaff = "30–35"');
  });

  it("renders API-provided zero totals instead of retaining placeholders", () => {
    expect(mainActivity).toContain(
      'if (students != null && students.has("active") && students.has("total"))'
    );
    expect(mainActivity).toContain('liveStudents = active + " / " + total;');
    expect(mainActivity).toContain(
      'if (staff != null && staff.has("active") && staff.has("total"))'
    );
    expect(mainActivity).toContain('liveStaff = activeStaff + " / " + totalStaff;');
    expect(mainActivity).not.toContain('if (total > 0) liveStudents = active + " / " + total;');
    expect(mainActivity).not.toContain('if (totalStaff > 0)');
  });
});
