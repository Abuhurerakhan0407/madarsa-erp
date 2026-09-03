import { describe, expect, it } from "vitest";
import {
  isCapabilityEnabled,
  isNavItemEnabled,
  resolveClientProfileFromConfig
} from "./client-profile";

describe("client capability profiles", () => {
  it("preserves full-product behavior by default", () => {
    const profile = resolveClientProfileFromConfig("default-madarsa", {});

    expect(profile.key).toBe("full-product");
    expect(isNavItemEnabled(profile, "fees")).toBe(true);
    expect(isNavItemEnabled(profile, "branches")).toBe(true);
  });

  it("disables only client-hidden modules for configured tenant slugs", () => {
    const profile = resolveClientProfileFromConfig("CLIENT-MADARSA", {
      clientV2TenantSlugs: "client-madarsa, another-client"
    });

    expect(profile.key).toBe("client-v2");
    expect(isNavItemEnabled(profile, "fees")).toBe(false);
    expect(isNavItemEnabled(profile, "operations")).toBe(false);
    expect(isNavItemEnabled(profile, "donations")).toBe(false);
    expect(isNavItemEnabled(profile, "hostel")).toBe(false);
    expect(isNavItemEnabled(profile, "transport")).toBe(false);
    expect(isNavItemEnabled(profile, "library")).toBe(false);
    expect(isNavItemEnabled(profile, "whatsapp")).toBe(false);
    expect(isNavItemEnabled(profile, "ai")).toBe(false);
    expect(isNavItemEnabled(profile, "branches")).toBe(false);
    expect(isNavItemEnabled(profile, "attendance")).toBe(true);
    expect(isNavItemEnabled(profile, "configuration")).toBe(true);
  });

  it("supports a deployment-wide client-v2 profile", () => {
    const profile = resolveClientProfileFromConfig("any-tenant", {
      profileOverride: "client-v2"
    });

    expect(profile.key).toBe("client-v2");
    expect(isNavItemEnabled(profile, "fees")).toBe(false);
    expect(isNavItemEnabled(profile, "students")).toBe(true);
  });

  it("lets an explicit full-product override win over a tenant slug", () => {
    const profile = resolveClientProfileFromConfig("client-madarsa", {
      profileOverride: "full-product",
      clientV2TenantSlugs: "client-madarsa"
    });

    expect(profile.key).toBe("full-product");
    expect(isCapabilityEnabled(profile, "fees_accounting")).toBe(true);
  });
});
