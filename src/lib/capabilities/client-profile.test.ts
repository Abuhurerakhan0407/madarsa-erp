import { describe, expect, it } from "vitest";
import {
  coerceClientProfileKey,
  isCapabilityEnabled,
  isNavItemEnabled,
  resolveClientProfileFromConfig
} from "./client-profile";

describe("client capability profiles", () => {
  it("keeps the full product launch modules enabled", () => {
    const profile = resolveClientProfileFromConfig("default-madarsa", {});
    expect(profile.key).toBe("full-product");
    for (const key of [
      "academics",
      "fees",
      "payroll",
      "operations",
      "donations",
      "ai",
      "branches",
      "hostel",
      "students",
      "attendance",
      "configuration"
    ]) {
      expect(isNavItemEnabled(profile, key)).toBe(true);
    }
  });

  it("hides client-specific disabled modules for client-v2 tenants", () => {
    const profile = resolveClientProfileFromConfig("abu-school", { tenantProfile: "client-v2" });
    expect(profile.key).toBe("client-v2");
    for (const key of ["academics", "fees", "payroll", "donations", "contributions", "ai", "assistant"]) {
      expect(isNavItemEnabled(profile, key)).toBe(false);
    }
    for (const key of ["operations", "lifecycle", "branches", "access", "hostel", "students", "attendance", "configuration"]) {
      expect(isNavItemEnabled(profile, key)).toBe(true);
    }
  });

  it("fails closed for retired navigation keys under every profile", () => {
    for (const profile of [
      resolveClientProfileFromConfig("default-madarsa", {}),
      resolveClientProfileFromConfig("client-madarsa", { tenantProfile: "client-v2" })
    ]) {
      for (const key of ["transport", "library", "whatsapp", "demo"]) {
        expect(isNavItemEnabled(profile, key)).toBe(false);
      }
    }
  });

  it("supports a deployment-wide client-v2 profile", () => {
    const profile = resolveClientProfileFromConfig("any-tenant", { profileOverride: "client-v2" });
    expect(profile.key).toBe("client-v2");
    expect(isNavItemEnabled(profile, "fees")).toBe(false);
    expect(isNavItemEnabled(profile, "academics")).toBe(false);
    expect(isNavItemEnabled(profile, "students")).toBe(true);
  });

  it("keeps active capabilities enabled under an explicit full-product override", () => {
    const profile = resolveClientProfileFromConfig("client-madarsa", {
      profileOverride: "full-product",
      tenantProfile: "client-v2",
      clientV2TenantSlugs: "client-madarsa"
    });
    expect(profile.key).toBe("full-product");
    expect(isCapabilityEnabled(profile, "fees_accounting")).toBe(true);
    expect(isCapabilityEnabled(profile, "academics_timetable_homework")).toBe(true);
  });

  it("coerces unknown database values to the stable full-product profile", () => {
    expect(coerceClientProfileKey("client-v2")).toBe("client-v2");
    expect(coerceClientProfileKey("unexpected-value")).toBe("full-product");
    expect(coerceClientProfileKey(null)).toBe("full-product");
  });
});
