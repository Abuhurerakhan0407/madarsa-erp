import {
  isCapabilityEnabled,
  resolveClientProfile,
  type ClientCapabilityProfile,
  type ProductCapability
} from "./client-profile";

const APP_ROUTE_CAPABILITIES: ReadonlyArray<readonly [RegExp, ProductCapability]> = [
  [/^\/(?:en|ur|ar)\/demo\/fees(?:\/|$)/, "fees_accounting"],
  [/^\/(?:en|ur|ar)\/students\/lifecycle(?:\/|$)/, "student_lifecycle_import_promotion_renewal"],
  [/^\/(?:en|ur|ar)\/demo\/donations(?:\/|$)/, "donations_zakat_sponsorships"],
  [/^\/(?:en|ur|ar)\/hostel(?:\/|$)/, "hostel_mess"],
  [/^\/(?:en|ur|ar)\/transport(?:\/|$)/, "transport"],
  [/^\/(?:en|ur|ar)\/library(?:\/|$)/, "library"],
  [/^\/(?:en|ur|ar)\/communications\/whatsapp(?:\/|$)/, "whatsapp_automation"],
  [/^\/(?:en|ur|ar)\/demo\/ai(?:\/|$)/, "ai_assistant"],
  [/^\/(?:en|ur|ar)\/access(?:\/|$)/, "branches_roles_ui"]
];

const API_ROUTE_CAPABILITIES: ReadonlyArray<readonly [RegExp, ProductCapability]> = [
  [/^\/api\/students\/lifecycle(?:\/|$)/, "student_lifecycle_import_promotion_renewal"],
  [/^\/api\/communications\/whatsapp(?:\/|$)/, "whatsapp_automation"]
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
  return canAccessCapability(
    resolveClientProfile(tenantSlug, tenantProfile),
    capability,
    permissionAllowed
  );
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
