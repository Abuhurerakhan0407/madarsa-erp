import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

const page = read("app/[locale]/hostel/page.tsx");
const layout = read("app/[locale]/hostel/layout.tsx");
const boys = read("lib/hostel/boys.ts");
const mobile = read("app/api/mobile/hostel/route.ts");
const navigation = read("lib/navigation/client-v3-navigation.ts");

describe("Hostel Boys workspace contract", () => {
  it("uses the hostel resident permission only", () => {
    expect(layout).toContain("hostel.resident.manage");
    expect(layout).not.toContain("hostel.security.manage");
    expect(layout).not.toContain("mess.service.manage");
  });

  it("models Hostel Boys as the existing student record plus residence state", () => {
    expect(page).toContain("getHostelBoysWorkspace");
    expect(page).toContain("setStudentResidence");
    expect(boys).toContain("get_hostel_boys_center_v1");
    expect(boys).toContain("set_student_residence_v1");
    expect(page).toContain("/students/");
  });

  it("shows learning program and class / group instead of physical bed operations", () => {
    expect(page).toContain("Learning programs");
    expect(page).toContain("Classes / groups");
    expect(page).toContain("Hostel boys register");
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
      "recordMealAttendance"
    ]) {
      expect(page).not.toContain(value);
    }
  });

  it("supports adding an existing student without creating a duplicate", () => {
    expect(page).toContain("Add existing student");
    expect(page).toContain('name="studentPersonId"');
    expect(page).toContain('value="hostel"');
    expect(page).toContain("same record in Students");
  });

  it("supports removing a student from Hostel Boys without deleting the student", () => {
    expect(page).toContain("Remove from hostel");
    expect(page).toContain('value="day"');
    expect(page).toContain("The student remains");
  });

  it("exposes the same model to the mobile app", () => {
    expect(mobile).toContain("get_hostel_boys_center_v1");
    expect(mobile).toContain("set_student_residence_v1");
    expect(mobile).toContain('export async function POST');
    expect(mobile).not.toContain("get_hostel_mess_center_v1");
  });

  it("renames the navigation entry to Hostel Boys", () => {
    expect(navigation).toContain('item("hostel", "Hostel Boys", "ہاسٹل بوائز"');
    const teacherBlock = navigation.slice(
      navigation.indexOf("const teacherPrimary"),
      navigation.indexOf("function enabled")
    );
    expect(teacherBlock).not.toContain('item("hostel"');
  });
});