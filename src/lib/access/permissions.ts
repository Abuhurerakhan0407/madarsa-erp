export type Permission = `${string}.${string}.${string}`;

export const membershipStatuses = [
  "active",
  "invited",
  "suspended",
  "expired",
  "revoked"
] as const;

export type MembershipStatus = (typeof membershipStatuses)[number];

export type AccessContext = {
  identityId: string;
  membershipId: string;
  membershipStatus: MembershipStatus;
  tenantId: string;
  branchIds: readonly string[] | "all";
  permissions: ReadonlySet<Permission>;
  relatedPersonIds: ReadonlySet<string>;
  accessStartsAt?: Date;
  accessEndsAt?: Date;
};

export type AccessRequest = {
  permission: Permission;
  tenantId: string;
  branchId?: string;
  relatedPersonId?: string;
  now?: Date;
};

export function authorize(context: AccessContext | null, request: AccessRequest): boolean {
  if (!context || context.membershipStatus !== "active") {
    return false;
  }

  if (context.tenantId !== request.tenantId || !context.permissions.has(request.permission)) {
    return false;
  }

  const now = (request.now ?? new Date()).getTime();

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
