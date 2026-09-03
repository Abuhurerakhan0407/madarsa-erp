export type ProductCapability =
  | "fees_accounting"
  | "student_lifecycle_import_promotion_renewal"
  | "donations_zakat_sponsorships"
  | "hostel_mess"
  | "transport"
  | "library"
  | "whatsapp_automation"
  | "ai_assistant"
  | "branches_roles_ui";

export type ClientProfileKey = "full-product" | "client-v2";

export type ClientCapabilityProfile = Readonly<{
  key: ClientProfileKey;
  disabledCapabilities: ReadonlySet<ProductCapability>;
}>;

export type ClientProfileConfig = Readonly<{
  profileOverride?: string | null;
  clientV2TenantSlugs?: string | null;
}>;

const fullProductProfile: ClientCapabilityProfile = {
  key: "full-product",
  disabledCapabilities: new Set<ProductCapability>()
};

const clientV2Profile: ClientCapabilityProfile = {
  key: "client-v2",
  disabledCapabilities: new Set<ProductCapability>([
    "fees_accounting",
    "student_lifecycle_import_promotion_renewal",
    "donations_zakat_sponsorships",
    "hostel_mess",
    "transport",
    "library",
    "whatsapp_automation",
    "ai_assistant",
    "branches_roles_ui"
  ])
};

export const CLIENT_PROFILES: Record<ClientProfileKey, ClientCapabilityProfile> = {
  "full-product": fullProductProfile,
  "client-v2": clientV2Profile
};

export const NAV_CAPABILITY_BY_KEY: Readonly<Record<string, ProductCapability | undefined>> = {
  fees: "fees_accounting",
  operations: "student_lifecycle_import_promotion_renewal",
  donations: "donations_zakat_sponsorships",
  hostel: "hostel_mess",
  transport: "transport",
  library: "library",
  whatsapp: "whatsapp_automation",
  ai: "ai_assistant",
  branches: "branches_roles_ui"
};

function normalizeTenantSlug(value: string): string {
  return value.trim().toLowerCase();
}

function configuredTenantSlugs(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map(normalizeTenantSlug)
    .filter((slug) => slug.length > 0);
}

export function resolveClientProfileFromConfig(
  tenantSlug: string,
  config: ClientProfileConfig
): ClientCapabilityProfile {
  const override = config.profileOverride ? normalizeTenantSlug(config.profileOverride) : "";

  if (override === "client-v2") return clientV2Profile;
  if (override === "full-product") return fullProductProfile;

  const normalizedTenantSlug = normalizeTenantSlug(tenantSlug);
  if (configuredTenantSlugs(config.clientV2TenantSlugs).some((slug) => slug === normalizedTenantSlug)) {
    return clientV2Profile;
  }

  return fullProductProfile;
}

export function resolveClientProfile(tenantSlug: string): ClientCapabilityProfile {
  return resolveClientProfileFromConfig(tenantSlug, {
    profileOverride: process.env.MADARSA_CLIENT_PROFILE,
    clientV2TenantSlugs: process.env.MADARSA_CLIENT_V2_TENANT_SLUGS
  });
}

export function isCapabilityEnabled(
  profile: ClientCapabilityProfile,
  capability: ProductCapability | undefined
): boolean {
  return !capability || !profile.disabledCapabilities.has(capability);
}

export function isNavItemEnabled(profile: ClientCapabilityProfile, navKey: string): boolean {
  return isCapabilityEnabled(profile, NAV_CAPABILITY_BY_KEY[navKey]);
}
