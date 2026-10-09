import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const UPPER = "ACDEHJKMNPQRTUVWXYZ";
const LOWER = "acdehjkmnpqrtuvwxyz";
const DIGITS = "3479";
const ALL = UPPER + LOWER + DIGITS;

export function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown"
  ).slice(0, 256);
}

function randomChar(alphabet: string, bytes: Uint8Array, offset: number): string {
  return alphabet[bytes[offset % bytes.length] % alphabet.length];
}

export function generateParentTemporaryPassword(): string {
  const bytes = randomBytes(32);
  const chars = [
    randomChar(UPPER, bytes, 0),
    randomChar(LOWER, bytes, 1),
    randomChar(DIGITS, bytes, 2),
    ...Array.from({ length: 9 }, (_, index) => randomChar(ALL, bytes, index + 3))
  ];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = bytes[(i + 9) % bytes.length] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.slice(0, 4).join("")
    + "-"
    + chars.slice(4, 8).join("")
    + "-"
    + chars.slice(8).join("")
    + "!";
}

export async function resolvePortalLoginEmail(username: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("resolve_portal_username_login_v1", {
    p_username: username
  });
  if (error) throw new Error("portal_login_resolution_failed");
  if (typeof data !== "string" || !data) return null;
  return data.toLowerCase();
}

export async function isPortalEmailLogin(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (
    normalized.endsWith("@parents.ilmgaah.in")
    || normalized.endsWith("@teachers.ilmgaah.in")
  ) return true;

  const admin = createAdminClient();
  const identity = await admin.rpc("find_auth_identity_by_email_v1", {
    p_email: normalized
  });
  if (identity.error) throw new Error("portal_email_classification_failed");
  if (typeof identity.data !== "string" || !identity.data) return false;

  const links = await admin
    .from("identity_person_links")
    .select("link_type")
    .eq("identity_id", identity.data)
    .eq("status", "verified")
    .in("link_type", ["guardian", "employee"])
    .limit(1);
  if (links.error) throw new Error("portal_email_classification_failed");
  return (links.data?.length ?? 0) > 0;
}

export type ParentLoginRateLimitResult = {
  allowed: boolean;
  infrastructureError: boolean;
  retryAfterSeconds: number;
};

export async function checkParentLoginRateLimit(
  request: Request,
  username?: string | null
): Promise<ParentLoginRateLimitResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("check_parent_portal_login_rate_limit_v2", {
    p_source_key: getClientIp(request),
    p_username: username || null
  });
  if (error) {
    return { allowed: false, infrastructureError: true, retryAfterSeconds: 0 };
  }
  return {
    allowed: data?.allowed === true,
    infrastructureError: false,
    retryAfterSeconds: Number(data?.retry_after_seconds) || 0,
  };
}

export async function recordParentLoginFailure(
  request: Request,
  username?: string | null
): Promise<ParentLoginRateLimitResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_parent_portal_login_failure_v2", {
    p_source_key: getClientIp(request),
    p_username: username || null
  });
  if (error) {
    return { allowed: false, infrastructureError: true, retryAfterSeconds: 0 };
  }
  return {
    allowed: data?.allowed === true,
    infrastructureError: false,
    retryAfterSeconds: Number(data?.retry_after_seconds) || 0,
  };
}
