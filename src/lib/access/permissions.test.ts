import { describe, expect, it } from "vitest";
import { authorize, can, type AccessContext } from "./permissions";

const context: AccessContext = {
  identityId: "identity-a",
  membershipId: "membership-a",
  membershipStatus: "active",
  tenantId: "tenant-a",
  branchIds: ["branch-a"],
  permissions: new Set(["students.profile.read"]),
  relatedPersonIds: new Set(["person-a"])
};

describe("authorization", () => {
  it("denies missing or inactive membership context", () => {
    expect(can(null, "students.profile.read")).toBe(false);
    expect(authorize({ ...context, membershipStatus: "suspended" }, {
      permission: "students.profile.read",
      tenantId: "tenant-a"
    })).toBe(false);
  });

  it("denies missing permission", () => {
    expect(can(context, "students.profile.update")).toBe(false);
  });

  it("denies cross-tenant and cross-branch requests", () => {
    expect(authorize(context, {
      permission: "students.profile.read",
      tenantId: "tenant-b",
      branchId: "branch-a"
    })).toBe(false);
    expect(can(context, "students.profile.read", "branch-b")).toBe(false);
  });

  it("allows matching permission and branch", () => {
    expect(can(context, "students.profile.read", "branch-a")).toBe(true);
    expect(can({ ...context, branchIds: "all" }, "students.profile.read", "branch-b")).toBe(true);
  });

  it("enforces relationship scope", () => {
    expect(authorize(context, {
      permission: "students.profile.read",
      tenantId: "tenant-a",
      relatedPersonId: "person-b"
    })).toBe(false);
    expect(authorize(context, {
      permission: "students.profile.read",
      tenantId: "tenant-a",
      relatedPersonId: "person-a"
    })).toBe(true);
  });

  it("enforces temporary access windows", () => {
    const temporaryContext = {
      ...context,
      accessStartsAt: new Date("2026-08-20T09:00:00Z"),
      accessEndsAt: new Date("2026-08-20T10:00:00Z")
    };

    expect(authorize(temporaryContext, {
      permission: "students.profile.read",
      tenantId: "tenant-a",
      now: new Date("2026-08-20T08:59:59Z")
    })).toBe(false);
    expect(authorize(temporaryContext, {
      permission: "students.profile.read",
      tenantId: "tenant-a",
      now: new Date("2026-08-20T09:30:00Z")
    })).toBe(true);
    expect(authorize(temporaryContext, {
      permission: "students.profile.read",
      tenantId: "tenant-a",
      now: new Date("2026-08-20T10:00:00Z")
    })).toBe(false);
  });

  it("enforces explicit data scopes", () => {
    const scopedContext = {
      ...context,
      scopeBindings: new Set(["group:group-a"] as const)
    };

    expect(authorize(scopedContext, {
      permission: "students.profile.read",
      tenantId: "tenant-a",
      scope: { type: "group", key: "group-a" }
    })).toBe(true);
    expect(authorize(scopedContext, {
      permission: "students.profile.read",
      tenantId: "tenant-a",
      scope: { type: "group", key: "group-b" }
    })).toBe(false);
  });

  it("enforces delegated permission windows and branch limits", () => {
    const delegatedContext: AccessContext = {
      ...context,
      permissions: new Set(),
      delegatedPermissions: [{
        permission: "students.profile.update",
        branchId: "branch-a",
        startsAt: new Date("2026-08-20T09:00:00Z"),
        endsAt: new Date("2026-08-20T10:00:00Z")
      }]
    };

    expect(authorize(delegatedContext, {
      permission: "students.profile.update",
      tenantId: "tenant-a",
      branchId: "branch-a",
      now: new Date("2026-08-20T09:30:00Z")
    })).toBe(true);
    expect(authorize(delegatedContext, {
      permission: "students.profile.update",
      tenantId: "tenant-a",
      branchId: "branch-a",
      now: new Date("2026-08-20T10:00:00Z")
    })).toBe(false);
    expect(authorize(delegatedContext, {
      permission: "students.profile.update",
      tenantId: "tenant-a",
      branchId: "branch-b",
      now: new Date("2026-08-20T09:30:00Z")
    })).toBe(false);
  });
});
