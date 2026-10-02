export type ProductCapability =
  | "fees_accounting"
  | "student_lifecycle_import_promotion_renewal"
  | "donations_zakat_sponsorships"
  | "ai_assistant"
  | "branches_roles_ui"
  | "academics_timetable_homework"
  | "hostel_mess_operations";

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

// Retired product areas remain fail-closed. They are not exposed as capabilities
// because the current product no longer offers them through the legacy routes.
const RETIRED_NAV_KEYS = new Set(["transport", "library", "whatsapp", "demo"]);

const fullProductProfile: ClientCapabilityProfile = {
  key: "full-product",
  disabledCapabilities: new Set<ProductCapability>()
};

const clientV2Profile: ClientCapabilityProfile = {
  key: "client-v2",
  disabledCapabilities: new Set<ProductCapability>([
    "academics_timetable_homework",
    "fees_accounting",
    "donations_zakat_sponsorships",
    "ai_assistant"
  ])
};

export const CLIENT_PROFILES: Record<ClientProfileKey, ClientCapabilityProfile> = {
  "full-product": fullProductProfile,
  "client-v2": clientV2Profile
};

export const NAV_CAPABILITY_BY_KEY: Readonly<Record<string, ProductCapability | undefined>> = {
  academics: "academics_timetable_homework",
  fees: "fees_accounting",
  payroll: "fees_accounting",
  operations: "student_lifecycle_import_promotion_renewal",
  lifecycle: "student_lifecycle_import_promotion_renewal",
  donations: "donations_zakat_sponsorships",
  contributions: "donations_zakat_sponsorships",
  ai: "ai_assistant",
  assistant: "ai_assistant",
  branches: "branches_roles_ui",
  access: "branches_roles_ui",
  hostel: "hostel_mess_operations"
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
  if (RETIRED_NAV_KEYS.has(navKey)) return false;
  return isCapabilityEnabled(profile, NAV_CAPABILITY_BY_KEY[navKey]);
}
