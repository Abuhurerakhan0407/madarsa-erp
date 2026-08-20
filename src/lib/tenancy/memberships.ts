import type { MembershipStatus } from "../access/permissions";

const membershipTransitions: Record<MembershipStatus, readonly MembershipStatus[]> = {
  invited: ["active", "expired", "revoked"],
  active: ["suspended", "expired", "revoked"],
  suspended: ["active", "expired", "revoked"],
  expired: [],
  revoked: []
};

export function canTransitionMembership(
  from: MembershipStatus,
  to: MembershipStatus
): boolean {
  return membershipTransitions[from].includes(to);
}
