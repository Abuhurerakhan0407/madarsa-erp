export type ProductCapability =
  | "fees_accounting"
  | "student_lifecycle_import_promotion_renewal"
  | "donations_zakat_sponsorships"
  | "ai_assistant"
  | "branches_roles_ui";

export type ClientProfileKey = "full-product" | "client-v2";

export type ClientCapabilityProfile = Readonly<{
  key: ClientProfileKey;
  disabledCapabilities: ReadonlySet<ProductCapability>;
}>;

export type ClientProfileConfig = Readonly<{
  profileOverride?: string | null;
  tenantProfile?: string | null;
  clientV2TenantSlugs?: string | null;
}>;

// Retired product areas (WhatsApp, Hostel, Transport, Library, internal demo suite)
// are intentionally absent from ProductCapability. They cannot be re-enabled by
// changing a tenant profile or environment variable.
const fullProductProfile: ClientCapabilityProfile = {
  key: "full-product",
  disabledCapabilities: new Set<ProductCapability>()
};

const clientV2Profile: ClientCapabilityProfile = {
  key: "client-v2",
  disabledCapabilities: new Set<ProductCapability>()
};

export const CLIENT_PROFILES: Record<ClientProfileKey, ClientCapabilityProfile> = {
  "full-product": fullProductProfile,
  "client-v2": clientV2Profile
};

export const NAV_CAPABILITY_BY_KEY: Readonly<Record<string, ProductCapability | undefined>> = {
  fees: "fees_accounting",
  operations: "student_lifecycle_import_promotion_renewal",
  donations: "donations_zakat_sponsorships",
  ai: "ai_assistant",
  branches: "branches_roles_ui"
};

function normalizeProfileValue(value: string): string {
  return value.trim().toLowerCase();
}

function configuredTenantSlugs(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map(normalizeProfileValue)
    .filter((slug) => slug.length > 0);
}

export function coerceClientProfileKey(value: string | null | undefined): ClientProfileKey {
  return normalizeProfileValue(value ?? "") === "client-v2" ? "client-v2" : "full-product";
}

export function resolveClientProfileFromConfig(
  tenantSlug: string,
  config: ClientProfileConfig
): ClientCapabilityProfile {
  const override = normalizeProfileValue(config.profileOverride ?? "");
  if (override === "client-v2") return clientV2Profile;
  if (override === "full-product") return fullProductProfile;
  const tenantProfile = normalizeProfileValue(config.tenantProfile ?? "");
  if (tenantProfile === "client-v2") return clientV2Profile;
  if (tenantProfile === "full-product") return fullProductProfile;
  const normalizedTenantSlug = normalizeProfileValue(tenantSlug);
  if (configuredTenantSlugs(config.clientV2TenantSlugs).some((slug) => slug === normalizedTenantSlug)) return clientV2Profile;
  return fullProductProfile;
}

export function resolveClientProfile(tenantSlug: string, tenantProfile?: string | null): ClientCapabilityProfile {
  return resolveClientProfileFromConfig(tenantSlug, {
    profileOverride: process.env.MADARSA_CLIENT_PROFILE,
    tenantProfile,
    clientV2TenantSlugs: process.env.MADARSA_CLIENT_V2_TENANT_SLUGS
  });
}

export function isCapabilityEnabled(profile: ClientCapabilityProfile, capability: ProductCapability | undefined): boolean {
  return !capability || !profile.disabledCapabilities.has(capability);
}

export function isNavItemEnabled(profile: ClientCapabilityProfile, navKey: string): boolean {
  return isCapabilityEnabled(profile, NAV_CAPABILITY_BY_KEY[navKey]);
}
