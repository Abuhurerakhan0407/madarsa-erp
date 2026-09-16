import { describe, expect, it } from "vitest";
import {
  defaultAdmissionFormSections,
  parseAdmissionsFoundationInput,
  validateDefaultAdmissionWorkflow
} from "./foundation";

const validInput = {
  sessionKey: "2026_27",
  sessionLabels: { en: "2026-27", ur: "تعلیمی سال 2026-27" },
  startsOn: "2026-06-01",
  endsOn: "2027-05-31",
  programKey: "dars_e_nizami",
  programLabels: { en: "Dars-e-Nizami", ur: "درس نظامی" },
  programType: "dars_e_nizami"
} as const;

describe("admissions foundation", () => {
  it("accepts the visible English and Urdu session/program configuration", () => {
    const result = parseAdmissionsFoundationInput(validInput);
    expect(result.errors).toEqual([]);
    expect(result.value).toMatchObject({
      sessionKey: "2026_27",
      programType: "dars_e_nizami",
      sessionLabels: {
        en: "2026-27",
        ur: "تعلیمی سال 2026-27",
        ar: "تعلیمی سال 2026-27"
      },
      programLabels: {
        en: "Dars-e-Nizami",
        ur: "درس نظامی",
        ar: "درس نظامی"
      }
    });
  });

  it("continues accepting a legacy Arabic storage label when supplied internally", () => {
    const result = parseAdmissionsFoundationInput({
      ...validInput,
      sessionLabels: { ...validInput.sessionLabels, ar: "العام الدراسي 2026-27" },
      programLabels: { ...validInput.programLabels, ar: "الدرس النظامي" }
    });
    expect(result.errors).toEqual([]);
    expect(result.value?.sessionLabels.ar).toBe("العام الدراسي 2026-27");
    expect(result.value?.programLabels.ar).toBe("الدرس النظامي");
  });

  it("rejects unstable keys, missing visible labels, and reversed dates", () => {
    const result = parseAdmissionsFoundationInput({
      ...validInput,
      sessionKey: "Year 2026",
      programKey: "Dars!",
      sessionLabels: { en: "Only English" },
      startsOn: "2027-06-01",
      endsOn: "2026-05-31"
    });

    expect(result.errors).toContain("Session key is invalid.");
    expect(result.errors).toContain("Program key is invalid.");
    expect(result.errors).toContain("English and Urdu session labels are required.");
    expect(result.errors).toContain("Session end date must be after its start date.");
  });

  it("keeps the published staff workflow acyclic and reachable", () => {
    expect(validateDefaultAdmissionWorkflow()).toEqual({ valid: true, errors: [] });
  });

  it("ships only minimal editable admission fields", () => {
    const fields = defaultAdmissionFormSections.flatMap((section) => section.fields);
    expect(fields.map((field) => field.key)).toEqual([
      "applicant_name",
      "date_of_birth",
      "guardian_name",
      "guardian_phone",
      "guardian_email",
      "address"
    ]);
    expect(fields.find((field) => field.key === "applicant_name")?.required).toBe(true);
  });
});
