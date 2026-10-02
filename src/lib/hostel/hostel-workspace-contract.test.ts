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

  it("preserves the recorded visitor identity in the register", () => {
    expect(operations).toContain("visitorName:string");
    expect(operations).toContain("visitorName:text(obj(x.visitor_identity_snapshot).name)");
    expect(page).toContain("v.visitorName");
  });

  it("renders a governed incident register without exposing restricted details", () => {
    expect(page).toContain("data.incidents.length");
    expect(page).toContain("i.category");
    expect(page).toContain("i.severity");
    expect(page).not.toContain("i.restrictedDetails");
  });

  it("keeps Hostel & Mess out of the Teacher navigation", () => {
    const navigation = read("lib/navigation/client-v3-navigation.ts");
    expect(navigation).toContain('item("hostel", "Hostel & Mess"');
    const teacherBlock = navigation.slice(navigation.indexOf("const teacherPrimary"), navigation.indexOf("function enabled"));
    expect(teacherBlock).not.toContain('item("hostel"');
  });

  it("keeps the restored route on English and Urdu release copy", () => {
    expect(page).toContain(" en:{");
    expect(page).toContain(" ur:{");
    expect(page).toContain("Hostel & Mess");
    expect(page).toContain("ہاسٹل اور میس");
  });
});
