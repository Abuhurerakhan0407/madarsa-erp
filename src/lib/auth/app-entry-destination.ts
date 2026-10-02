import type { SupportedLocale } from "@/lib/i18n/config";

const APP_PATH = /^\/(en|ur)(?=\/|$)/;

export function resolveOperatorAppDestination(
  storedRoute: string | null | undefined,
  locale: SupportedLocale
): string {
  const fallback = `/${locale}`;
  if (!storedRoute) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(storedRoute);
  } catch {
    return fallback;
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;

  try {
    const url = new URL(decoded, "https://ilmgaah.invalid");
    if (url.origin !== "https://ilmgaah.invalid" || !APP_PATH.test(url.pathname)) {
      return fallback;
    }

    const localizedPath = url.pathname.replace(APP_PATH, `/${locale}`);
    return `${localizedPath}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
