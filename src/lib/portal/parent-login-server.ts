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

export async function consumeParentLoginRateLimit(request: Request, username?: string | null): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_parent_portal_login_rate_limit_v1", {
    p_source_key: getClientIp(request),
    p_username: username || null
  });
  if (error) return false;
  return data?.allowed === true;
}
