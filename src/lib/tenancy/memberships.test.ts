import { describe, expect, it } from "vitest";
import { canTransitionMembership } from "./memberships";

describe("membership lifecycle", () => {
  it("supports invitation acceptance and temporary suspension", () => {
    expect(canTransitionMembership("invited", "active")).toBe(true);
    expect(canTransitionMembership("active", "suspended")).toBe(true);
    expect(canTransitionMembership("suspended", "active")).toBe(true);
  });

  it("treats revoked membership as terminal", () => {
    expect(canTransitionMembership("revoked", "active")).toBe(false);
  });
});
