export type Permission = `${string}.${string}.${string}`;

export type AccessContext = {
  tenantId: string;
  branchIds: readonly string[];
  permissions: ReadonlySet<Permission>;
};

export function can(
  context: AccessContext | null,
  permission: Permission,
  branchId?: string
): boolean {
  if (!context?.permissions.has(permission)) {
    return false;
  }

  if (branchId && !context.branchIds.includes(branchId)) {
    return false;
  }

  return true;
}
