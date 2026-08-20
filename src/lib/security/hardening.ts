const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function originAllowed(method: string, origin: string | null, allowedOrigins: readonly string[]): boolean {
  if (!mutationMethods.has(method.toUpperCase())) return true;
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

export function safeRedirectTarget(target: string, appOrigin: string): string {
  try {
    const url = new URL(target, appOrigin);
    return url.origin === appOrigin ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}

export function deletionReady(input: { coolingEnded: boolean; legalHoldActive: boolean; policyApproved: boolean; exportOffered: boolean }): boolean {
  return input.coolingEnded && !input.legalHoldActive && input.policyApproved && input.exportOffered;
}

export function restoreDrillPassed(input: { rpoHours: number; rtoHours: number; database: boolean; storage: boolean; application: boolean }): boolean {
  return input.rpoHours <= 24 && input.rtoHours <= 8 && input.database && input.storage && input.application;
}
