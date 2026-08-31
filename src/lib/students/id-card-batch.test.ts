import { describe, expect, it } from "vitest";
import { ID_CARD_BATCH_LIMIT, normalizeIdCardStudentIds } from "./id-card-batch-model";

describe("bulk ID card selection", () => {
  it("normalizes valid unique student ids", () => {
    expect(normalizeIdCardStudentIds(["4", "7", "4", "bad", "-1"])).toEqual([4, 7]);
  });

  it("accepts one query-string student id", () => {
    expect(normalizeIdCardStudentIds("12")).toEqual([12]);
  });

  it("rejects selections above the print safety cap", () => {
    const ids = Array.from({ length: ID_CARD_BATCH_LIMIT + 1 }, (_, index) => String(index + 1));
    expect(() => normalizeIdCardStudentIds(ids)).toThrow(`Select no more than ${ID_CARD_BATCH_LIMIT} students.`);
  });
});
