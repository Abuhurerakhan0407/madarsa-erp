import { describe, expect, it } from "vitest";
import type { SubjectResultInput } from "./model";
import { calculateSubjectResult, canTransitionMarksheet, validateComponents, validateEntry, validatePromotion } from "./rules";

const input: SubjectResultInput = {
  subjectId: "fiqh",
  components: [
    { id: "written", maximumMarks: 80, passMarks: 32, weight: 80, required: true },
    { id: "oral", maximumMarks: 20, passMarks: 8, weight: 20, required: true }
  ],
  entries: [
    { componentId: "written", status: "present", rawMarks: 64 },
    { componentId: "oral", status: "present", rawMarks: 15 }
  ]
};

describe("assessment rules", () => {
  it("requires exact component weights", () => {
    expect(validateComponents([{ id: "paper", maximumMarks: 100, weight: 90, required: true }])).toContain("component_weights_must_total_100");
  });

  it("rejects marks outside the component range", () => {
    expect(validateEntry({ componentId: "paper", status: "present", rawMarks: 101 }, { id: "paper", maximumMarks: 100, weight: 100, required: true })).toContain("marks_out_of_range");
  });

  it("calculates reproducible weighted results with trace", () => {
    expect(calculateSubjectResult(input)).toEqual(expect.objectContaining({ rawMarks: 79, weightedMarks: 79, outcome: "pass" }));
    expect(calculateSubjectResult(input).trace).toContain("rounded_half_up:79");
  });

  it("preserves withheld and incomplete states", () => {
    expect(calculateSubjectResult({ ...input, entries: [{ componentId: "written", status: "withheld" }, input.entries[1]] }).outcome).toBe("withheld");
  });

  it("requires reasons for reopening and promotion exceptions", () => {
    expect(canTransitionMarksheet("locked", "reopened", "fix")).toBe(false);
    expect(canTransitionMarksheet("locked", "reopened", "incorrect moderation")).toBe(true);
    expect(validatePromotion("retain", "promote")).toContain("exception_reason_required");
  });
});
