import type { Permission } from "./permissions";

export const permissions = {
  tenantSettingsManage: "settings.tenant.manage",
  rolesManage: "settings.roles.manage",
  studentsRead: "students.profile.read",
  studentsUpdate: "students.profile.update",
  attendanceMark: "attendance.student.mark",
  resultsPublish: "exams.results.publish",
  receiptReverse: "finance.receipt.reverse",
  fundAllocate: "donations.fund.allocate"
} as const satisfies Record<string, Permission>;

export type RoleTemplateKey = "owner" | "admin" | "accountant" | "teacher";

export const roleTemplates: Record<RoleTemplateKey, ReadonlySet<Permission>> = {
  owner: new Set(Object.values(permissions)),
  admin: new Set([
    permissions.studentsRead,
    permissions.studentsUpdate,
    permissions.attendanceMark,
    permissions.resultsPublish
  ]),
  accountant: new Set([
    permissions.studentsRead,
    permissions.receiptReverse,
    permissions.fundAllocate
  ]),
  teacher: new Set([
    permissions.studentsRead,
    permissions.attendanceMark
  ])
};
