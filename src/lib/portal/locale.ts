import type { SupportedLocale } from "@/lib/i18n/config";

type Raw = Record<string, unknown>;
const portalOrigin = "https://ilmgaah.invalid";

function record(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
}

export function resolvePortalLocale(value: unknown): SupportedLocale {
  return value === "ur" ? "ur" : "en";
}

export function localizedPortalText(value: unknown, locale: SupportedLocale, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  const labels = record(value);
  const localized = labels[locale];
  if (typeof localized === "string" && localized.trim()) return localized.trim();
  const english = labels.en;
  if (typeof english === "string" && english.trim()) return english.trim();
  return fallback;
}

export function portalHref(path: string, locale: SupportedLocale, params: Record<string, string | number | null | undefined> = {}): string {
  const url = new URL(path, portalOrigin);
  url.searchParams.set("locale", locale);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function preservePortalLocale(href: string, locale: SupportedLocale): string {
  if (!href.startsWith("/portal")) return href;
  return portalHref(href, locale);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateLocale(locale: SupportedLocale): string {
  return locale === "ur" ? "ur-PK" : "en-IN";
}

export function formatPortalDate(value: unknown, locale: SupportedLocale): string {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat(dateLocale(locale), { dateStyle: "medium" }).format(date) : "—";
}

export function formatPortalDateTime(value: unknown, locale: SupportedLocale): string {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat(dateLocale(locale), { dateStyle: "medium", timeStyle: "short" }).format(date) : "—";
}
