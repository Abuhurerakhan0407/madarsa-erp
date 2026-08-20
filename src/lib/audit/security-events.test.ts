import { describe, expect, it } from "vitest";
import { createSecurityEvent } from "./security-events";

const baseInput = {
  id: "event-a",
  occurredAt: new Date("2026-08-20T10:00:00Z"),
  tenantId: "tenant-a",
  actorIdentityId: "identity-a",
  actorMembershipId: "membership-a",
  action: "settings.roles.update",
  outcome: "succeeded" as const,
  correlationId: "request-a"
};

describe("security events", () => {
  it("captures immutable tenant and actor context", () => {
    const event = createSecurityEvent(baseInput);

    expect(event.tenantId).toBe("tenant-a");
    expect(event.actorMembershipId).toBe("membership-a");
    expect(event.occurredAt).toBe("2026-08-20T10:00:00.000Z");
    expect(Object.isFrozen(event)).toBe(true);
  });

  it("redacts secret values recursively", () => {
    const event = createSecurityEvent({
      ...baseInput,
      metadata: {
        changedField: "displayName",
        accessToken: "never-store-this",
        nested: { password: "never-store-this-either" }
      }
    });

    expect(event.metadata).toEqual({
      changedField: "displayName",
      accessToken: "[REDACTED]",
      nested: { password: "[REDACTED]" }
    });
  });

  it("requires a reason for support impersonation", () => {
    expect(() => createSecurityEvent({
      ...baseInput,
      impersonatorIdentityId: "support-a"
    })).toThrow("Impersonation events require a reason");
  });
});
