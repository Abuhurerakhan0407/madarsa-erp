import { describe, expect, it } from "vitest";
import { activeStudentCount, annualizedRevenue, entitlementAllowed, normalizeSubscription } from "./rules";

describe("SaaS billing rules", () => {
  it("converges duplicate out-of-order webhooks", () => {
    const events = [
      { id: "2", occurredAt: "2026-08-02", type: "payment_recovered" as const },
      { id: "1", occurredAt: "2026-08-01", type: "payment_failed" as const },
      { id: "2", occurredAt: "2026-08-02", type: "payment_recovered" as const }
    ];
    expect(normalizeSubscription("active", events)).toBe("active");
  });
  it("counts concurrent-program students once", () => {
    expect(activeStudentCount([{ studentId: "s1", active: true }, { studentId: "s1", active: true }, { studentId: "s2", active: false }])).toBe(1);
  });
  it("enforces server entitlement limits", () => {
    expect(entitlementAllowed({ baseEnabled: true, usage: 10, limit: 10 })).toBe(false);
    expect(entitlementAllowed({ baseEnabled: false, usage: 99, override: "enable" })).toBe(true);
  });
  it("annualizes independent billing prices", () => {
    expect(annualizedRevenue(3000, "quarterly")).toBe(12000);
    expect(annualizedRevenue(10000, "yearly")).toBe(10000);
  });
});
