import { describe, expect, it } from "vitest";
import { canAccessCapability, canTenantAccessCapability, capabilityForApiPath, capabilityForAppPath } from "./access";
import { CLIENT_PROFILES } from "./client-profile";

const mappedRoutes = [
  ["/en/fees", "fees_accounting"],
  ["/ur/students/lifecycle", "student_lifecycle_import_promotion_renewal"],
  ["/en/contributions", "donations_zakat_sponsorships"],
  ["/en/assistant", "ai_assistant"],
  ["/en/access", "branches_roles_ui"]
] as const;

describe("commercial capability access", () => {
  it.each(mappedRoutes)("maps %s to %s", (pathname, capability) => expect(capabilityForAppPath(pathname)).toBe(capability));

  it("does not map retired application routes", () => {
    for (const pathname of ["/en/hostel", "/en/transport", "/en/library", "/en/communications/whatsapp", "/en/demo/ai"]) {
      expect(capabilityForAppPath(pathname)).toBeUndefined();
    }
  });

  it("maps only active protected mutation API families", () => {
    expect(capabilityForApiPath("/api/fees")).toBe("fees_accounting");
    expect(capabilityForApiPath("/api/contributions")).toBe("donations_zakat_sponsorships");
    expect(capabilityForApiPath("/api/assistant")).toBe("ai_assistant");
    expect(capabilityForApiPath("/api/students/lifecycle/import")).toBe("student_lifecycle_import_promotion_renewal");
    expect(capabilityForApiPath("/api/communications/whatsapp/queue")).toBeUndefined();
    expect(capabilityForApiPath("/api/students")).toBeUndefined();
  });

  it("keeps launch capabilities available in both supported profiles", () => {
    for (const profile of Object.values(CLIENT_PROFILES)) {
      for (const [, capability] of mappedRoutes) expect(canAccessCapability(profile, capability)).toBe(true);
    }
  });

  it("uses the persisted tenant profile in tenant-level checks", () => {
    expect(canTenantAccessCapability("abu-school", "fees_accounting", true, "client-v2")).toBe(true);
    expect(canTenantAccessCapability("abu-school", "ai_assistant", true, "client-v2")).toBe(true);
  });

  it("never lets capability enablement bypass RBAC permission denial", () => {
    expect(canAccessCapability(CLIENT_PROFILES["full-product"], undefined, false)).toBe(false);
    expect(canAccessCapability(CLIENT_PROFILES["client-v2"], "fees_accounting", false)).toBe(false);
  });
});
