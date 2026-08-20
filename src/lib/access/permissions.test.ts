import { describe, expect, it } from "vitest";
import { can, type AccessContext } from "./permissions";

const context: AccessContext = {
  tenantId: "tenant-a",
  branchIds: ["branch-a"],
  permissions: new Set(["students.profile.read"])
};

describe("can", () => {
  it("denies missing context", () => {
    expect(can(null, "students.profile.read")).toBe(false);
  });

  it("denies missing permission", () => {
    expect(can(context, "students.profile.update")).toBe(false);
  });

  it("denies another branch", () => {
    expect(can(context, "students.profile.read", "branch-b")).toBe(false);
  });

  it("allows matching permission and branch", () => {
    expect(can(context, "students.profile.read", "branch-a")).toBe(true);
  });
});
