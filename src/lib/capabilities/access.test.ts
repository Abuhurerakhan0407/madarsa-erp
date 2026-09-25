import { describe, expect, it } from "vitest";
import {
  canAccessCapability,
  canTenantAccessCapability,
  capabilityForApiPath,
  capabilityForAppPath
} from "./access";
import { CLIENT_PROFILES } from "./client-profile";

const mappedRoutes = [
  ["/en/people-academics", "academics_timetable_homework"],
  ["/en/fees", "fees_accounting"],
  ["/en/payroll", "fees_accounting"],
  ["/ur/students/lifecycle", "student_lifecycle_import_promotion_renewal"],
  ["/en/contributions", "donations_zakat_sponsorships"],
  ["/en/assistant", "ai_assistant"],
  ["/en/access", "branches_roles_ui"]
] as const;

describe("commercial capability access", () => {
  it.each(mappedRoutes)(
    "maps %s to %s",
    (pathname, capability) => expect(capabilityForAppPath(pathname)).toBe(capability)
  );

  it("does not map retired application routes", () => {
    for (const pathname of [
      "/en/hostel",
      "/en/transport",
      "/en/library",
      "/en/communications/whatsapp",
      "/en/demo/ai"
    ]) {
      expect(capabilityForAppPath(pathname)).toBeUndefined();
    }
  });

  it("maps protected API families", () => {
    expect(capabilityForApiPath("/api/academics")).toBe("academics_timetable_homework");
    expect(capabilityForApiPath("/api/academics/attachment")).toBe("academics_timetable_homework");
    expect(capabilityForApiPath("/api/fees")).toBe("fees_accounting");
    expect(capabilityForApiPath("/api/payroll")).toBe("fees_accounting");
    expect(capabilityForApiPath("/api/contributions")).toBe("donations_zakat_sponsorships");
    expect(capabilityForApiPath("/api/assistant")).toBe("ai_assistant");
    expect(capabilityForApiPath("/api/students/lifecycle/import")).toBe("student_lifecycle_import_promotion_renewal");
    expect(capabilityForApiPath("/api/communications/whatsapp/queue")).toBeUndefined();
    expect(capabilityForApiPath("/api/students")).toBeUndefined();
  });

  it("keeps mapped capabilities available in full-product", () => {
    for (const [, capability] of mappedRoutes) {
      expect(canAccessCapability(CLIENT_PROFILES["full-product"], capability)).toBe(true);
    }
  });

  it("enforces the client-v2 visibility contract", () => {
    const profile = CLIENT_PROFILES["client-v2"];
    for (const capability of [
      "academics_timetable_homework",
      "fees_accounting",
      "donations_zakat_sponsorships",
      "ai_assistant"
    ] as const) {
      expect(canAccessCapability(profile, capability)).toBe(false);
    }
    expect(canAccessCapability(profile, "student_lifecycle_import_promotion_renewal")).toBe(true);
    expect(canAccessCapability(profile, "branches_roles_ui")).toBe(true);
  });

  it("uses the persisted tenant profile in tenant-level checks", () => {
    expect(canTenantAccessCapability("abu-school", "fees_accounting", true, "client-v2")).toBe(false);
    expect(canTenantAccessCapability("abu-school", "ai_assistant", true, "client-v2")).toBe(false);
    expect(canTenantAccessCapability("abu-school", "student_lifecycle_import_promotion_renewal", true, "client-v2")).toBe(true);
  });

  it("never lets capability enablement bypass RBAC permission denial", () => {
    expect(canAccessCapability(CLIENT_PROFILES["full-product"], undefined, false)).toBe(false);
    expect(canAccessCapability(CLIENT_PROFILES["client-v2"], "branches_roles_ui", false)).toBe(false);
  });
});
