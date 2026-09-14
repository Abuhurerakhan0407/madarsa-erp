import { describe, expect, it } from "vitest";
import { isTransientWorkspaceError } from "./context";
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

describe("workspace transient failure classification", () => {
  it("retries temporary Supabase gateway and project-config failures", () => {
    expect(isTransientWorkspaceError(new Error("Unable to resolve membership: Bad Gateway"))).toBe(true);
    expect(isTransientWorkspaceError(new Error("Failed to get project config"))).toBe(true);
    expect(isTransientWorkspaceError(new Error("Failed to get API key info"))).toBe(true);
  });

  it("does not retry ordinary authorization/configuration failures", () => {
    expect(isTransientWorkspaceError(new Error("Permission denied"))).toBe(false);
    expect(isTransientWorkspaceError(new Error("Active branch is required."))).toBe(false);
  });
});
