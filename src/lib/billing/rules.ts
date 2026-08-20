export type SubscriptionState = "trial" | "active" | "grace" | "cancel_at_period_end" | "restricted" | "suspended" | "expired" | "closed";
export type ProviderEvent = { id: string; occurredAt: string; type: "activated" | "payment_failed" | "payment_recovered" | "cancel_scheduled" | "cancelled" | "suspended" };

export function normalizeSubscription(initial: SubscriptionState, events: readonly ProviderEvent[]): SubscriptionState {
  let state = initial;
  const ordered = [...new Map(events.map((event) => [event.id, event])).values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
  for (const event of ordered) {
    if (event.type === "activated" || event.type === "payment_recovered") state = "active";
    else if (event.type === "payment_failed" && state === "active") state = "grace";
    else if (event.type === "cancel_scheduled") state = "cancel_at_period_end";
    else if (event.type === "cancelled") state = "closed";
    else if (event.type === "suspended") state = "suspended";
  }
  return state;
}

export function activeStudentCount(enrollments: readonly { studentId: string; active: boolean }[]): number {
  return new Set(enrollments.filter((item) => item.active).map((item) => item.studentId)).size;
}

export function entitlementAllowed(input: { baseEnabled: boolean; usage: number; limit?: number; override?: "enable" | "disable" }): boolean {
  if (input.override === "disable") return false;
  if (input.override === "enable") return true;
  return input.baseEnabled && (input.limit === undefined || input.usage < input.limit);
}

export function annualizedRevenue(amount: number, interval: "quarterly" | "yearly"): number {
  return interval === "yearly" ? amount : amount * 4;
}
