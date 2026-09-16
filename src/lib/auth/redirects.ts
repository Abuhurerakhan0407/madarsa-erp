import type { SupportedLocale } from "@/lib/i18n/config";

const fallbackPath = "/en";
const applicationOrigin = "https://ilmgaah.invalid";

function normalizeInternalPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const url = new URL(value, applicationOrigin);
    if (url.origin !== applicationOrigin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function safeAuthRedirect(value: string | null, fallback = fallbackPath): string {
  const safeFallback = normalizeInternalPath(fallback) ?? fallbackPath;
  return normalizeInternalPath(value) ?? safeFallback;
}

export function authLocaleFromRedirect(value: string | null): SupportedLocale {
  const target = safeAuthRedirect(value);
  const url = new URL(target, applicationOrigin);
  if (url.searchParams.get("locale") === "ur") return "ur";
  return url.pathname === "/ur" || url.pathname.startsWith("/ur/") ? "ur" : "en";
}

export function localizeAuthDestination(value: string | null, locale: SupportedLocale): string {
  const target = safeAuthRedirect(value, `/${locale}`);
  const url = new URL(target, applicationOrigin);

  if (/^\/(?:en|ur)(?:\/|$)/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/^\/(?:en|ur)(?=\/|$)/, `/${locale}`);
  } else if (url.pathname === "/onboarding" || url.pathname === "/portal" || url.pathname.startsWith("/portal/")) {
    url.searchParams.set("locale", locale);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
