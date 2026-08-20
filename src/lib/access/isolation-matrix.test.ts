import { describe, expect, it } from "vitest";
import { authorize, type AccessContext } from "./permissions";

const tenantAContext: AccessContext = {
  identityId: "identity-a",
  membershipId: "membership-a",
  membershipStatus: "active",
  tenantId: "tenant-a",
  branchIds: ["branch-a1"],
  permissions: new Set(["students.profile.read", "attendance.student.mark"]),
  relatedPersonIds: new Set(["student-a"])
};

const cases = [
  { name: "same tenant and branch", tenantId: "tenant-a", branchId: "branch-a1", expected: true },
  { name: "same tenant other branch", tenantId: "tenant-a", branchId: "branch-a2", expected: false },
  { name: "other tenant same branch text", tenantId: "tenant-b", branchId: "branch-a1", expected: false },
  { name: "other tenant other branch", tenantId: "tenant-b", branchId: "branch-b1", expected: false }
] as const;

describe("tenant isolation matrix", () => {
  it.each(cases)("enforces $name", ({ tenantId, branchId, expected }) => {
    expect(authorize(tenantAContext, {
      permission: "students.profile.read",
      tenantId,
      branchId
    })).toBe(expected);
  });

  it("does not let branch access bypass a missing capability", () => {
    expect(authorize(tenantAContext, {
      permission: "finance.receipt.reverse",
      tenantId: "tenant-a",
      branchId: "branch-a1"
    })).toBe(false);
  });

  it.each(["invited", "suspended", "expired", "revoked"] as const)(
    "denies a %s membership",
    (membershipStatus) => {
      expect(authorize({ ...tenantAContext, membershipStatus }, {
        permission: "students.profile.read",
        tenantId: "tenant-a",
        branchId: "branch-a1"
      })).toBe(false);
    }
  );

  it("isolates relationship-bound records", () => {
    expect(authorize(tenantAContext, {
      permission: "students.profile.read",
      tenantId: "tenant-a",
      branchId: "branch-a1",
      relatedPersonId: "student-a"
    })).toBe(true);
    expect(authorize(tenantAContext, {
      permission: "students.profile.read",
      tenantId: "tenant-a",
      branchId: "branch-a1",
      relatedPersonId: "student-b"
    })).toBe(false);
  });
});
