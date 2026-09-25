import {
  isCapabilityEnabled,
  resolveClientProfile,
  type ClientCapabilityProfile,
  type ProductCapability
} from "./client-profile";

const APP_ROUTE_CAPABILITIES: ReadonlyArray<readonly [RegExp, ProductCapability]> = [
  [/^\/(?:en|ur)\/people-academics(?:\/|$)/, "academics_timetable_homework"],
  [/^\/(?:en|ur)\/fees(?:\/|$)/, "fees_accounting"],
  [/^\/(?:en|ur)\/payroll(?:\/|$)/, "fees_accounting"],
  [/^\/(?:en|ur)\/students\/lifecycle(?:\/|$)/, "student_lifecycle_import_promotion_renewal"],
  [/^\/(?:en|ur)\/contributions(?:\/|$)/, "donations_zakat_sponsorships"],
  [/^\/(?:en|ur)\/assistant(?:\/|$)/, "ai_assistant"],
  [/^\/(?:en|ur)\/access(?:\/|$)/, "branches_roles_ui"]
];

const API_ROUTE_CAPABILITIES: ReadonlyArray<readonly [RegExp, ProductCapability]> = [
  [/^\/api\/academics(?:\/|$)/, "academics_timetable_homework"],
  [/^\/api\/fees(?:\/|$)/, "fees_accounting"],
  [/^\/api\/payroll(?:\/|$)/, "fees_accounting"],
  [/^\/api\/contributions(?:\/|$)/, "donations_zakat_sponsorships"],
  [/^\/api\/assistant(?:\/|$)/, "ai_assistant"],
  [/^\/api\/students\/lifecycle(?:\/|$)/, "student_lifecycle_import_promotion_renewal"]
];

export function canAccessCapability(
  profile: ClientCapabilityProfile,
  capability: ProductCapability | undefined,
  permissionAllowed = true
): boolean {
  return permissionAllowed && isCapabilityEnabled(profile, capability);
}

export function canTenantAccessCapability(
  tenantSlug: string,
  capability: ProductCapability | undefined,
  permissionAllowed = true,
  tenantProfile?: string | null
): boolean {
  return canAccessCapability(resolveClientProfile(tenantSlug, tenantProfile), capability, permissionAllowed);
}

function capabilityForPath(
  pathname: string,
  mappings: ReadonlyArray<readonly [RegExp, ProductCapability]>
): ProductCapability | undefined {
  return mappings.find(([pattern]) => pattern.test(pathname))?.[1];
}

export function capabilityForAppPath(pathname: string): ProductCapability | undefined {
  return capabilityForPath(pathname, APP_ROUTE_CAPABILITIES);
}

export function capabilityForApiPath(pathname: string): ProductCapability | undefined {
  return capabilityForPath(pathname, API_ROUTE_CAPABILITIES);
}
