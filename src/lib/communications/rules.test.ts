import { describe, expect, it } from "vitest";
import { canDispatch, dispatchKey, previewBulk, validateTemplate } from "./rules";

describe("communication rules", () => {
  it("rejects missing and sensitive variables", () => {
    expect(validateTemplate("Hello {{private_note}}", ["name"], "whatsapp")).toEqual(["missing_variable:name", "sensitive_variable:private_note"]);
  });
  it("creates retry-stable dispatch keys", () => {
    expect(dispatchKey("t1", "e1", "r1", "email", "v2")).toBe("t1:e1:r1:email:v2");
  });
  it("enforces consent and spend limits", () => {
    expect(canDispatch({ consent: true, optedOut: false, blocked: false, allowanceUnits: 10, prepaidUnits: 5, estimatedUnits: 15 })).toBe(true);
    expect(canDispatch({ consent: false, optedOut: false, blocked: false, allowanceUnits: 10, prepaidUnits: 5, estimatedUnits: 1 })).toBe(false);
  });
  it("previews audience cost", () => {
    expect(previewBulk(100, 10, 1, 0.8)).toEqual({ recipients: 90, units: 90, cost: 72 });
  });
});
