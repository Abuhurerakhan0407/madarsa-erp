import { describe, expect, it } from "vitest";
import { coerceClientProfileKey, isCapabilityEnabled, isNavItemEnabled, resolveClientProfileFromConfig } from "./client-profile";

describe("client capability profiles", () => {
  it("preserves full-product behavior by default", () => {
    const profile = resolveClientProfileFromConfig("default-madarsa", {});
    expect(profile.key).toBe("full-product");
    expect(isNavItemEnabled(profile, "fees")).toBe(true);
    expect(isNavItemEnabled(profile, "branches")).toBe(true);
  });

  it("keeps required commercial modules enabled in client-v2", () => {
    const profile = resolveClientProfileFromConfig("abu-school", { tenantProfile: "client-v2" });
    expect(profile.key).toBe("client-v2");
    for (const key of ["fees","operations","donations","ai","branches","students","attendance","configuration"])
      expect(isNavItemEnabled(profile, key)).toBe(true);
  });

  it("disables only features removed from the commercial product", () => {
    const profile = resolveClientProfileFromConfig("CLIENT-MADARSA", { clientV2TenantSlugs: "client-madarsa, another-client" });
    expect(profile.key).toBe("client-v2");
    expect(isNavItemEnabled(profile, "hostel")).toBe(false);
    expect(isNavItemEnabled(profile, "transport")).toBe(false);
    expect(isNavItemEnabled(profile, "library")).toBe(false);
    expect(isNavItemEnabled(profile, "whatsapp")).toBe(false);
  });

  it("supports a deployment-wide client-v2 profile", () => {
    const profile = resolveClientProfileFromConfig("any-tenant", { profileOverride: "client-v2" });
    expect(profile.key).toBe("client-v2");
    expect(isNavItemEnabled(profile, "fees")).toBe(true);
    expect(isNavItemEnabled(profile, "students")).toBe(true);
  });

  it("lets an explicit full-product override win over persisted and slug profiles", () => {
    const profile = resolveClientProfileFromConfig("client-madarsa", { profileOverride: "full-product", tenantProfile: "client-v2", clientV2TenantSlugs: "client-madarsa" });
    expect(profile.key).toBe("full-product");
    expect(isCapabilityEnabled(profile, "fees_accounting")).toBe(true);
  });

  it("coerces unknown database values to the safe full-product default", () => {
    expect(coerceClientProfileKey("client-v2")).toBe("client-v2");
    expect(coerceClientProfileKey("unexpected-value")).toBe("full-product");
    expect(coerceClientProfileKey(null)).toBe("full-product");
  });
});
