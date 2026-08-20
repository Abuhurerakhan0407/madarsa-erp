export const tenantStates = [
  "onboarding",
  "trial",
  "active",
  "grace",
  "restricted",
  "suspended",
  "closed",
  "deletion_pending",
  "deleted"
] as const;

export type TenantState = (typeof tenantStates)[number];

const allowedTransitions: Record<TenantState, readonly TenantState[]> = {
  onboarding: ["trial", "active", "closed"],
  trial: ["active", "grace", "restricted", "suspended", "closed"],
  active: ["grace", "restricted", "suspended", "closed"],
  grace: ["active", "restricted", "suspended", "closed"],
  restricted: ["active", "grace", "suspended", "closed"],
  suspended: ["active", "restricted", "closed"],
  closed: ["active", "deletion_pending"],
  deletion_pending: ["closed", "deleted"],
  deleted: []
};

export function canTransitionTenant(from: TenantState, to: TenantState): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertTenantTransition(from: TenantState, to: TenantState): void {
  if (!canTransitionTenant(from, to)) {
    throw new Error(`Tenant lifecycle transition is not allowed: ${from} -> ${to}`);
  }
}
