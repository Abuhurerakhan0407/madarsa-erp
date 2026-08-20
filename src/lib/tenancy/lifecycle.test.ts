import { describe, expect, it } from "vitest";
import { assertTenantTransition, canTransitionTenant } from "./lifecycle";

describe("tenant lifecycle", () => {
  it("supports activation, restriction, and recovery", () => {
    expect(canTransitionTenant("onboarding", "trial")).toBe(true);
    expect(canTransitionTenant("active", "restricted")).toBe(true);
    expect(canTransitionTenant("restricted", "active")).toBe(true);
  });

  it("requires closure before deletion is scheduled", () => {
    expect(canTransitionTenant("active", "deletion_pending")).toBe(false);
    expect(canTransitionTenant("closed", "deletion_pending")).toBe(true);
  });

  it("treats deleted as terminal", () => {
    expect(() => assertTenantTransition("deleted", "active")).toThrow(
      "Tenant lifecycle transition is not allowed"
    );
  });
});
