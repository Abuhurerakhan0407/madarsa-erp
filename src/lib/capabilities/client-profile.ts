export type ProductCapability =
  | "fees_accounting"
  | "student_lifecycle_import_promotion_renewal"
  | "donations_zakat_sponsorships"
  | "hostel_mess"
  | "transport"
  | "library"
  | "whatsapp_automation"
  | "ai_assistant"
  | "branches_roles_ui"
  | "internal_demo_suite";

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
    "branches_roles_ui",
    "internal_demo_suite"
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

function normalizeProfileValue(value: string): string {
  return value.trim().toLowerCase();
}

function configuredTenantSlugs(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map(normalizeProfileValue)
    .filter((slug) => slug.length > 0);
}

function applyTenantPendingRestrictions(tenantSlug:string,profile:ClientCapabilityProfile):ClientCapabilityProfile{
  // Furkania has not approved WhatsApp scope/provider/events/consent practice yet.
  // Fail closed even when the broader product profile is enabled; activation is a
  // deliberate client-configuration change, not an implicit consequence of credentials.
  if(normalizeProfileValue(tenantSlug)!=="madrasa-e-furkania")return profile;
  return {key:profile.key,disabledCapabilities:new Set<ProductCapability>([...profile.disabledCapabilities,"whatsapp_automation"])};
}

export function coerceClientProfileKey(value: string | null | undefined): ClientProfileKey {
  return normalizeProfileValue(value ?? "") === "client-v2" ? "client-v2" : "full-product";
}

export function resolveClientProfileFromConfig(
  tenantSlug: string,
  config: ClientProfileConfig
): ClientCapabilityProfile {
  const override = normalizeProfileValue(config.profileOverride ?? "");
  let profile:ClientCapabilityProfile;

  if (override === "client-v2") profile=clientV2Profile;
  else if (override === "full-product") profile=fullProductProfile;
  else {
    const tenantProfile = normalizeProfileValue(config.tenantProfile ?? "");
    if (tenantProfile === "client-v2") profile=clientV2Profile;
    else if (tenantProfile === "full-product") profile=fullProductProfile;
    else {
      const normalizedTenantSlug = normalizeProfileValue(tenantSlug);
      profile=configuredTenantSlugs(config.clientV2TenantSlugs).some((slug) => slug === normalizedTenantSlug)
        ? clientV2Profile
        : fullProductProfile;
    }
  }

  return applyTenantPendingRestrictions(tenantSlug,profile);
}

export function resolveClientProfile(
  tenantSlug: string,
  tenantProfile?: string | null
): ClientCapabilityProfile {
  return resolveClientProfileFromConfig(tenantSlug, {
    profileOverride: process.env.MADARSA_CLIENT_PROFILE,
    tenantProfile,
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
