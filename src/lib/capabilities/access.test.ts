import { describe, expect, it } from "vitest";
import { canAccessCapability, canTenantAccessCapability, capabilityForApiPath, capabilityForAppPath } from "./access";
import { CLIENT_PROFILES } from "./client-profile";

const mappedRoutes = [
  ["/en/fees", "fees_accounting"],
  ["/ur/students/lifecycle", "student_lifecycle_import_promotion_renewal"],
  ["/en/contributions", "donations_zakat_sponsorships"],
  ["/en/hostel", "hostel_mess"],
  ["/en/transport", "transport"],
  ["/en/library", "library"],
  ["/en/communications/whatsapp", "whatsapp_automation"],
  ["/en/assistant", "ai_assistant"],
  ["/en/demo/ai", "ai_assistant"],
  ["/en/access", "branches_roles_ui"]
] as const;

const removedCapabilities = ["hostel_mess","transport","library","whatsapp_automation"] as const;

describe("Client V2 capability access", () => {
  it.each(mappedRoutes)("maps %s to %s", (pathname, capability) => expect(capabilityForAppPath(pathname)).toBe(capability));
  it("maps protected mutation API families", () => {
    expect(capabilityForApiPath("/api/fees")).toBe("fees_accounting");
    expect(capabilityForApiPath("/api/contributions")).toBe("donations_zakat_sponsorships");
    expect(capabilityForApiPath("/api/assistant")).toBe("ai_assistant");
    expect(capabilityForApiPath("/api/students/lifecycle/import")).toBe("student_lifecycle_import_promotion_renewal");
    expect(capabilityForApiPath("/api/communications/whatsapp/queue")).toBe("whatsapp_automation");
    expect(capabilityForApiPath("/api/students")).toBeUndefined();
  });
  it("preserves mapped capabilities in the default full product", () => {
    for (const [, capability] of mappedRoutes) expect(canAccessCapability(CLIENT_PROFILES["full-product"], capability)).toBe(true);
  });
  it("blocks only explicitly removed client capabilities", () => {
    for (const capability of removedCapabilities) expect(canAccessCapability(CLIENT_PROFILES["client-v2"], capability)).toBe(false);
    for (const capability of ["fees_accounting","student_lifecycle_import_promotion_renewal","donations_zakat_sponsorships","ai_assistant","branches_roles_ui"] as const)
      expect(canAccessCapability(CLIENT_PROFILES["client-v2"], capability)).toBe(true);
  });
  it("uses the persisted tenant profile in tenant-level checks", () => {
    expect(canTenantAccessCapability("abu-school", "fees_accounting", true, "client-v2")).toBe(true);
    expect(canTenantAccessCapability("abu-school", "whatsapp_automation", true, "client-v2")).toBe(false);
  });
  it("never lets capability enablement bypass RBAC permission denial", () => {
    expect(canAccessCapability(CLIENT_PROFILES["full-product"], undefined, false)).toBe(false);
    expect(canAccessCapability(CLIENT_PROFILES["client-v2"], "fees_accounting", false)).toBe(false);
  });
});
