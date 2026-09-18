import { describe, expect, it } from "vitest";
import { coerceClientProfileKey, isCapabilityEnabled, isNavItemEnabled, resolveClientProfileFromConfig } from "./client-profile";

describe("client capability profiles", () => {
  it("keeps the locked commercial modules enabled by default", () => {
    const profile = resolveClientProfileFromConfig("default-madarsa", {});
    expect(profile.key).toBe("full-product");
    for (const key of ["fees", "operations", "donations", "ai", "branches", "students", "attendance", "configuration"]) {
      expect(isNavItemEnabled(profile, key)).toBe(true);
    }
  });

  it("keeps the same launch scope for client-v2 tenants", () => {
    const profile = resolveClientProfileFromConfig("abu-school", { tenantProfile: "client-v2" });
    expect(profile.key).toBe("client-v2");
    for (const key of ["fees", "operations", "donations", "ai", "branches", "students", "attendance", "configuration"]) {
      expect(isNavItemEnabled(profile, key)).toBe(true);
    }
  });

  it("cannot re-enable retired features through a profile key", () => {
    const profile = resolveClientProfileFromConfig("CLIENT-MADARSA", { clientV2TenantSlugs: "client-madarsa, another-client" });
    expect(profile.key).toBe("client-v2");
    expect(isNavItemEnabled(profile, "hostel")).toBe(true);
    expect(isNavItemEnabled(profile, "transport")).toBe(true);
    expect(isNavItemEnabled(profile, "library")).toBe(true);
    expect(isNavItemEnabled(profile, "whatsapp")).toBe(true);
  });

  it("supports a deployment-wide client-v2 profile without disabling launch modules", () => {
    const profile = resolveClientProfileFromConfig("any-tenant", { profileOverride: "client-v2" });
    expect(profile.key).toBe("client-v2");
    expect(isNavItemEnabled(profile, "fees")).toBe(true);
    expect(isNavItemEnabled(profile, "students")).toBe(true);
  });

  it("keeps active capabilities enabled under an explicit full-product override", () => {
    const profile = resolveClientProfileFromConfig("client-madarsa", { profileOverride: "full-product", tenantProfile: "client-v2", clientV2TenantSlugs: "client-madarsa" });
    expect(profile.key).toBe("full-product");
    expect(isCapabilityEnabled(profile, "fees_accounting")).toBe(true);
  });

  it("coerces unknown database values to the stable full-product profile", () => {
    expect(coerceClientProfileKey("client-v2")).toBe("client-v2");
    expect(coerceClientProfileKey("unexpected-value")).toBe("full-product");
    expect(coerceClientProfileKey(null)).toBe("full-product");
  });
});
