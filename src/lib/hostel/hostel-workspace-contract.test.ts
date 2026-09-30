import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

const page = read("app/[locale]/hostel/page.tsx");
const layout = read("app/[locale]/hostel/layout.tsx");
const operations = read("lib/hostel/operations.ts");

describe("Hostel & Mess workspace contract", () => {
  it("restores the current route with any governed Hostel or Mess permission", () => {
    expect(layout).toContain("hostel.resident.manage");
    expect(layout).toContain("hostel.security.manage");
    expect(layout).toContain("mess.service.manage");
    expect(layout).toContain('"any"');
    expect(page).toContain("data.permissions.resident");
    expect(page).toContain("data.permissions.security");
    expect(page).toContain("data.permissions.mess");
  });

  it("keeps the complete restored workflow wired to the existing server layer", () => {
    for (const value of [
      "createHostel",
      "addHostelBed",
      "allocateHostelBed",
      "vacateHostelAllocation",
      "checkInHostelVisitor",
      "checkOutHostelVisitor",
      "recordHostelIncident",
      "createMessUnit",
      "createMealService",
      "recordMealAttendance",
      "closeMealService"
    ]) {
      expect(page).toContain(value);
      expect(operations).toContain(value);
    }
  });

  it("keeps the restored route on English and Urdu release copy", () => {
    expect(page).toContain(" en:{");
    expect(page).toContain(" ur:{");
    expect(page).toContain("Hostel & Mess");
    expect(page).toContain("ہاسٹل اور میس");
  });
});
