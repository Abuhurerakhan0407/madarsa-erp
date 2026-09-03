import { describe, expect, it } from "vitest";
import { validateProgramsSyllabusMutation } from "./model";

describe("Programs & Syllabus mutation validation", () => {
  it("accepts a valid teaching program template", () => {
    const result = validateProgramsSyllabusMutation({
      action: "create_program",
      key: "deeniyat_primary",
      labels: { en: "Deeniyat Primary", ur: "دینیات" },
      descriptions: { en: "Core Deeniyat teaching program" },
      programType: "custom",
      templateKey: "deeniyat"
    });
    expect(result.errors).toEqual([]);
    expect(result.value?.action).toBe("create_program");
  });

  it("rejects unsafe program keys and unknown templates", () => {
    const result = validateProgramsSyllabusMutation({
      action: "create_program",
      key: "../deeniyat",
      labels: { en: "Deeniyat" },
      descriptions: { en: "Program" },
      programType: "custom",
      templateKey: "forced_template"
    });
    expect(result.value).toBeUndefined();
    expect(result.errors).toContain("Program key is invalid.");
    expect(result.errors).toContain("Program template is invalid.");
  });

  it("accepts a curriculum component with a configured progress method", () => {
    const result = validateProgramsSyllabusMutation({
      action: "add_component",
      programId: 12,
      levelId: 4,
      subjectKey: "fiqh",
      subjectLabels: { en: "Fiqh", ur: "فقہ" },
      subjectType: "traditional",
      progressMethod: "completion",
      unitStructure: "lesson"
    });
    expect(result.errors).toEqual([]);
    expect(result.value?.action).toBe("add_component");
  });

  it("rejects unknown progress and unit methods", () => {
    const result = validateProgramsSyllabusMutation({
      action: "add_component",
      programId: 12,
      levelId: null,
      subjectKey: "fiqh",
      subjectLabels: { en: "Fiqh" },
      subjectType: "traditional",
      progressMethod: "magic",
      unitStructure: "random"
    });
    expect(result.value).toBeUndefined();
    expect(result.errors).toContain("Progress method is invalid.");
    expect(result.errors).toContain("Unit structure is invalid.");
  });

  it("requires exactly one teaching target", () => {
    const base = {
      action: "assign",
      sessionId: 2,
      curriculumItemId: 8,
      teacherPersonId: 9,
      evaluationMethod: "completion",
      startsOn: "2026-09-03",
      endsOn: null
    } as const;

    expect(validateProgramsSyllabusMutation({ ...base, groupId: 4, studentPersonId: null }).errors).toEqual([]);
    expect(validateProgramsSyllabusMutation({ ...base, groupId: null, studentPersonId: 42 }).errors).toEqual([]);
    expect(validateProgramsSyllabusMutation({ ...base, groupId: null, studentPersonId: null }).errors).toContain("Select exactly one group or student target.");
    expect(validateProgramsSyllabusMutation({ ...base, groupId: 4, studentPersonId: 42 }).errors).toContain("Select exactly one group or student target.");
  });

  it("rejects invalid assignment dates", () => {
    const result = validateProgramsSyllabusMutation({
      action: "assign",
      sessionId: 2,
      curriculumItemId: 8,
      groupId: 4,
      studentPersonId: null,
      teacherPersonId: 9,
      evaluationMethod: "completion",
      startsOn: "2026-09-10",
      endsOn: "2026-09-01"
    });
    expect(result.value).toBeUndefined();
    expect(result.errors).toContain("End date cannot be before start date.");
  });

  it("validates progress state and bounded progress payload", () => {
    const valid = validateProgramsSyllabusMutation({
      action: "record_progress",
      assignmentId: 5,
      studentPersonId: 22,
      curriculumUnitId: 11,
      teacherPersonId: 9,
      state: "completed",
      progressValue: { percent: 100 },
      notes: "Completed confidently"
    });
    expect(valid.errors).toEqual([]);

    const invalid = validateProgramsSyllabusMutation({
      action: "record_progress",
      assignmentId: 5,
      studentPersonId: 22,
      curriculumUnitId: 11,
      teacherPersonId: 9,
      state: "invented",
      progressValue: { payload: "x".repeat(5000) },
      notes: ""
    });
    expect(invalid.value).toBeUndefined();
    expect(invalid.errors).toContain("Progress state is invalid.");
    expect(invalid.errors).toContain("Progress value is invalid.");
  });
});
