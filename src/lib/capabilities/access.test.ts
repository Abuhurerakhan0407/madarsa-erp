import { describe, expect, it } from "vitest";
import {
  canAccessCapability,
  canTenantAccessCapability,
  capabilityForApiPath,
  capabilityForAppPath
} from "./access";
import { CLIENT_PROFILES } from "./client-profile";

const hiddenAppRoutes = [
  ["/en/demo/fees", "fees_accounting"],
  ["/ur/students/lifecycle", "student_lifecycle_import_promotion_renewal"],
  ["/ar/demo/donations", "donations_zakat_sponsorships"],
  ["/en/hostel", "hostel_mess"],
  ["/en/transport", "transport"],
  ["/en/library", "library"],
  ["/en/communications/whatsapp", "whatsapp_automation"],
  ["/en/demo/ai", "ai_assistant"],
  ["/en/access", "branches_roles_ui"]
] as const;

describe("Client V2 capability access", () => {
  it.each(hiddenAppRoutes)("maps %s to %s", (pathname, capability) => {
    expect(capabilityForAppPath(pathname)).toBe(capability);
  });

  it("maps hidden mutation API families", () => {
    expect(capabilityForApiPath("/api/students/lifecycle/import")).toBe(
      "student_lifecycle_import_promotion_renewal"
    );
    expect(capabilityForApiPath("/api/communications/whatsapp/queue")).toBe(
      "whatsapp_automation"
    );
    expect(capabilityForApiPath("/api/students")).toBeUndefined();
  });

  it("preserves every capability in the default full product", () => {
    for (const [, capability] of hiddenAppRoutes) {
      expect(canAccessCapability(CLIENT_PROFILES["full-product"], capability)).toBe(true);
    }
  });

  it("blocks every client-hidden capability in Client V2", () => {
    for (const [, capability] of hiddenAppRoutes) {
      expect(canAccessCapability(CLIENT_PROFILES["client-v2"], capability)).toBe(false);
    }
  });

  it("uses the persisted tenant profile in tenant-level checks", () => {
    expect(canTenantAccessCapability("abu-school", "fees_accounting", true, "client-v2")).toBe(false);
    expect(canTenantAccessCapability("new-tenant", "fees_accounting", true, "full-product")).toBe(true);
  });

  it("never lets capability enablement bypass RBAC permission denial", () => {
    expect(canAccessCapability(CLIENT_PROFILES["full-product"], undefined, false)).toBe(false);
    expect(canAccessCapability(CLIENT_PROFILES["full-product"], "fees_accounting", false)).toBe(false);
  });
});
