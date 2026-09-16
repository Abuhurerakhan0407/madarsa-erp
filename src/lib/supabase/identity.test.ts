import { describe, expect, it } from "vitest";
import { isTransientIdentityError } from "./identity";

describe("verified identity transient failure classification", () => {
  it("retries temporary upstream failures", () => {
    expect(isTransientIdentityError({ status: 502, message: "Bad Gateway" })).toBe(true);
    expect(isTransientIdentityError({ message: "Failed to get API key info" })).toBe(true);
    expect(isTransientIdentityError({ message: "Failed to get project config" })).toBe(true);
  });

  it("does not classify an ordinary unauthenticated response as transient", () => {
    expect(isTransientIdentityError({ status: 401, message: "Auth session missing!" })).toBe(false);
  });
});
