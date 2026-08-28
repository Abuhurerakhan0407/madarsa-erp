import { describe, expect, it } from "vitest";
import { validatePublicAdmissionTrackingInput } from "./tracking-model";

describe("public admission tracking input", () => {
  it("accepts a UUID reference and private token", () => {
    const result = validatePublicAdmissionTrackingInput({
      trackingId: "289a1ec3-cf76-4da8-97d6-65e657347d8e",
      trackingToken: "a".repeat(43)
    });

    expect(result.errors).toEqual([]);
    expect(result.value?.trackingId).toBe("289a1ec3-cf76-4da8-97d6-65e657347d8e");
  });

  it("rejects malformed references and short tokens", () => {
    const result = validatePublicAdmissionTrackingInput({
      trackingId: "not-a-reference",
      trackingToken: "short"
    });

    expect(result.errors).toContain("Tracking reference is invalid.");
    expect(result.errors).toContain("Private tracking key is invalid.");
  });

  it("rejects non-object bodies", () => {
    expect(validatePublicAdmissionTrackingInput(null).errors).toEqual([
      "Request body must be an object."
    ]);
  });
});
