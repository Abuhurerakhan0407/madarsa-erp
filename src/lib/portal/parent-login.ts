export const PARENT_PORTAL_EMAIL_DOMAIN = "parents.ilmgaah.in";
export const PARENT_USERNAME_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const PARENT_USERNAME_PATTERN = /^[abcdefghjkmnpqrstuvwxyz23456789]{3,8}-[abcdefghjkmnpqrstuvwxyz23456789]{6}$/;

export type ParentLoginIdentifier =
  | { kind: "email"; value: string; email: string; username: null }
  | { kind: "username"; value: string; email: string; username: string }
  | { kind: "invalid"; value: string; email: null; username: string | null };

export function normalizeLoginIdentifier(value: unknown): ParentLoginIdentifier {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw || raw.length > 320) return { kind: "invalid", value: raw, email: null, username: null };
  if (raw.includes("@")) return { kind: "email", value: raw, email: raw, username: null };
  if (!PARENT_USERNAME_PATTERN.test(raw)) return { kind: "invalid", value: raw, email: null, username: raw };
  return {
    kind: "username",
    value: raw,
    email: buildParentSyntheticEmail(raw),
    username: raw
  };
}

export function buildParentSyntheticEmail(username: string): string {
  return username.toLowerCase() + "@" + PARENT_PORTAL_EMAIL_DOMAIN;
}

export function isParentSyntheticEmail(value: unknown): boolean {
  return typeof value === "string"
    && value.trim().toLowerCase().endsWith("@" + PARENT_PORTAL_EMAIL_DOMAIN);
}

const COMMON_PARENT_PASSWORDS = new Set([
  "password123", "password1234", "password", "1234567890",
  "12345678", "123456789", "qwerty123", "qwertyui",
  "welcome123", "letmein123", "admin123", "abc12345",
  "11223344", "11111111", "00000000", "madarsa123",
  "ilmgaah123"
]);

export function isCommonParentPassword(value: string): boolean {
  return COMMON_PARENT_PASSWORDS.has(value.trim().toLowerCase());
}

export function validUsernameParentPassword(value: string): boolean {
  return value.length >= 10
    && value.length <= 128
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /[0-9]/.test(value)
    && !isCommonParentPassword(value);
}
