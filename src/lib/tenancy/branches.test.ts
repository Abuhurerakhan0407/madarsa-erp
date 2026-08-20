import { describe, expect, it } from "vitest";
import { validateTenantBranches, type TenantBranches } from "./branches";

const tenantBranches: TenantBranches = {
  tenantId: "tenant-a",
  primaryBranchId: "branch-a",
  branches: [
    { id: "branch-a", tenantId: "tenant-a", name: "Main", status: "active" },
    { id: "branch-b", tenantId: "tenant-a", name: "North", status: "active" }
  ]
};

describe("tenant branches", () => {
  it("accepts one active primary branch in the same tenant", () => {
    expect(validateTenantBranches(tenantBranches)).toBe(true);
  });

  it("rejects a primary branch from another tenant", () => {
    expect(validateTenantBranches({
      ...tenantBranches,
      branches: [
        ...tenantBranches.branches,
        { id: "branch-x", tenantId: "tenant-b", name: "Other", status: "active" }
      ],
      primaryBranchId: "branch-x"
    })).toBe(false);
  });

  it("rejects an inactive primary branch", () => {
    expect(validateTenantBranches({
      ...tenantBranches,
      branches: [{ ...tenantBranches.branches[0], status: "inactive" }]
    })).toBe(false);
  });
});
