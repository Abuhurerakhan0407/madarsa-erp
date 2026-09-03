import { afterEach, describe, expect, it } from "vitest";
import {
  isNavItemEnabled,
  resolveClientProfile
} from "./client-profile";

const originalGlobalProfile = process.env.MADARSA_CLIENT_PROFILE;
const originalTenantSlugs = process.env.MADARSA_CLIENT_V2_TENANT_SLUGS;

afterEach(() => {
  if (originalGlobalProfile === undefined) delete process.env.MADARSA_CLIENT_PROFILE;
  else process.env.MADARSA_CLIENT_PROFILE = originalGlobalProfile;

  if (originalTenantSlugs === undefined) delete process.env.MADARSA_CLIENT_V2_TENANT_SLUGS;
  else process.env.MADARSA_CLIENT_V2_TENANT_SLUGS = originalTenantSlugs;
});

describe("client capability profiles", () => {
  it("preserves full-product behavior by default", () => {
    delete process.env.MADARSA_CLIENT_PROFILE;
    delete process.env.MADARSA_CLIENT_V2_TENANT_SLUGS;

    const profile = resolveClientProfile("default-madrasa");

    expect(profile.key).toBe("full-product");
    expect(isNavItemEnabled(profile, "fees")).toBe(true);
    expect(isNavItemEnabled(profile, "branches")).toBe(true);
  });

  it("disables only client-hidden modules for configured tenant slugs", () => {
    delete process.env.MADARSA_CLIENT_PROFILE;
    process.env.MADARSA_CLIENT_V2_TENANT_SLUGS = "client-madrasa, another-client";

    const profile = resolveClientProfile("CLIENT-MADARSA");

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
    process.env.MADARSA_CLIENT_PROFILE = "client-v2";
    delete process.env.MADARSA_CLIENT_V2_TENANT_SLUGS;

    const profile = resolveClientProfile("any-tenant");

    expect(profile.key).toBe("client-v2");
    expect(isNavItemEnabled(profile, "fees")).toBe(false);
    expect(isNavItemEnabled(profile, "students")).toBe(true);
  });
});
