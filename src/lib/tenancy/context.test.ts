import { describe, expect, it } from "vitest";
import { selectWorkspaceBranchId } from "./workspace";

describe("workspace branch selection", () => {
  it("uses the tenant primary branch for all-branch memberships", () => {
    expect(selectWorkspaceBranchId(1, true, [2])).toBe(1);
  });
  it("uses only an explicit scope for a branch-scoped membership", () => {
    expect(selectWorkspaceBranchId(1, false, [2])).toBe(2);
  });
  it("fails closed when a scoped membership has no branch", () => {
    expect(selectWorkspaceBranchId(1, false, [])).toBeNull();
  });
});
