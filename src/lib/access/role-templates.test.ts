import { describe, expect, it } from "vitest";
import { permissions, roleTemplates } from "./role-templates";

describe("role templates", () => {
  it("keeps high-risk finance capabilities out of the teacher template", () => {
    expect(roleTemplates.teacher.has(permissions.receiptReverse)).toBe(false);
    expect(roleTemplates.teacher.has(permissions.fundAllocate)).toBe(false);
  });

  it("allows templates to be copied without mutating the baseline", () => {
    const clonedPermissions = new Set(roleTemplates.admin);
    clonedPermissions.add(permissions.rolesManage);

    expect(roleTemplates.admin.has(permissions.rolesManage)).toBe(false);
    expect(clonedPermissions.has(permissions.rolesManage)).toBe(true);
  });
});
