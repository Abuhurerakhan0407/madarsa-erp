export type Permission = `${string}.${string}.${string}`;

export const membershipStatuses = [
  "active",
  "invited",
  "suspended",
  "expired",
  "revoked"
] as const;

export type MembershipStatus = (typeof membershipStatuses)[number];

export const accessScopeTypes = [
  "program",
  "cohort",
  "group",
  "student",
  "department",
  "fund",
  "self",
  "linked_person"
] as const;

export type AccessScopeType = (typeof accessScopeTypes)[number];
export type ScopeBinding = `${AccessScopeType}:${string}`;

export type DelegatedPermission = {
  permission: Permission;
  startsAt: Date;
  endsAt: Date;
  branchId?: string;
  revokedAt?: Date;
};

export type AccessContext = {
  identityId: string;
  membershipId: string;
  membershipStatus: MembershipStatus;
  tenantId: string;
  branchIds: readonly string[] | "all";
  permissions: ReadonlySet<Permission>;
  delegatedPermissions?: readonly DelegatedPermission[];
  scopeBindings?: ReadonlySet<ScopeBinding>;
  relatedPersonIds: ReadonlySet<string>;
  accessStartsAt?: Date;
  accessEndsAt?: Date;
};

export type AccessRequest = {
  permission: Permission;
  tenantId: string;
  branchId?: string;
  relatedPersonId?: string;
  scope?: { type: AccessScopeType; key: string };
  now?: Date;
};

export function authorize(context: AccessContext | null, request: AccessRequest): boolean {
  if (!context || context.membershipStatus !== "active") {
    return false;
  }

  if (context.tenantId !== request.tenantId) {
    return false;
  }

  const now = (request.now ?? new Date()).getTime();

  const hasDelegatedPermission = context.delegatedPermissions?.some((delegation) =>
    delegation.permission === request.permission &&
    delegation.startsAt.getTime() <= now &&
    delegation.endsAt.getTime() > now &&
    !delegation.revokedAt &&
    (!delegation.branchId || delegation.branchId === request.branchId)
  ) ?? false;

  if (!context.permissions.has(request.permission) && !hasDelegatedPermission) {
    return false;
  }

  if (context.accessStartsAt && now < context.accessStartsAt.getTime()) {
    return false;
  }

  if (context.accessEndsAt && now >= context.accessEndsAt.getTime()) {
    return false;
  }

  if (
    request.branchId &&
    context.branchIds !== "all" &&
    !context.branchIds.includes(request.branchId)
  ) {
    return false;
  }

  if (request.relatedPersonId && !context.relatedPersonIds.has(request.relatedPersonId)) {
    return false;
  }

  if (
    request.scope &&
    !context.scopeBindings?.has(`${request.scope.type}:${request.scope.key}`)
  ) {
    return false;
  }

  return true;
}

export function can(
  context: AccessContext | null,
  permission: Permission,
  branchId?: string
): boolean {
  return authorize(context, {
    permission,
    tenantId: context?.tenantId ?? "",
    branchId
  });
}
