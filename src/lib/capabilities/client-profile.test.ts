import { describe, expect, it } from "vitest";
import { coerceClientProfileKey, isCapabilityEnabled, isNavItemEnabled, resolveClientProfileFromConfig } from "./client-profile";

const retiredKeys = ["hostel", "transport", "library", "whatsapp"] as const;

describe("client capability profiles", () => {
  it("keeps required commercial modules enabled by default", () => {
    const profile = resolveClientProfileFromConfig("default-madarsa", {});
    expect(profile.key).toBe("full-product");
    for (const key of ["fees", "operations", "donations", "ai", "branches", "students", "attendance", "configuration"])
      expect(isNavItemEnabled(profile, key)).toBe(true);
  });

  it("keeps required commercial modules enabled in client-v2", () => {
    const profile = resolveClientProfileFromConfig("abu-school", { tenantProfile: "client-v2" });
    expect(profile.key).toBe("client-v2");
    for (const key of ["fees", "operations", "donations", "ai", "branches", "students", "attendance", "configuration"])
      expect(isNavItemEnabled(profile, key)).toBe(true);
  });

  it("keeps retired products disabled in every profile", () => {
    for (const profile of [
      resolveClientProfileFromConfig("default-madarsa", {}),
      resolveClientProfileFromConfig("client-madarsa", { tenantProfile: "client-v2" }),
      resolveClientProfileFromConfig("client-madarsa", { profileOverride: "full-product" })
    ]) {
      for (const key of retiredKeys) expect(isNavItemEnabled(profile, key)).toBe(false);
      expect(isCapabilityEnabled(profile, "internal_demo_suite")).toBe(false);
    }
  });

  it("supports a deployment-wide client-v2 profile", () => {
    const profile = resolveClientProfileFromConfig("any-tenant", { profileOverride: "client-v2" });
    expect(profile.key).toBe("client-v2");
    expect(isNavItemEnabled(profile, "fees")).toBe(true);
    expect(isNavItemEnabled(profile, "students")).toBe(true);
  });

  it("does not allow a full-product override to resurrect retired products", () => {
    const profile = resolveClientProfileFromConfig("client-madarsa", {
      profileOverride: "full-product",
      tenantProfile: "client-v2",
      clientV2TenantSlugs: "client-madarsa"
    });
    expect(profile.key).toBe("full-product");
    expect(isCapabilityEnabled(profile, "fees_accounting")).toBe(true);
    expect(isCapabilityEnabled(profile, "whatsapp_automation")).toBe(false);
    expect(isCapabilityEnabled(profile, "hostel_mess")).toBe(false);
  });

  it("coerces unknown database values to the safe full-product profile", () => {
    expect(coerceClientProfileKey("client-v2")).toBe("client-v2");
    expect(coerceClientProfileKey("unexpected-value")).toBe("full-product");
    expect(coerceClientProfileKey(null)).toBe("full-product");
  });
});
