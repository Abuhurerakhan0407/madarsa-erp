export const locales = ["en", "ur"] as const;
export type SupportedLocale = (typeof locales)[number];

// Arabic remains a legacy internal translation/data key so existing records and
// dormant copy stay type-safe, but it is not an application route or UI option.
export type Locale = SupportedLocale | "ar";

export const defaultLocale: SupportedLocale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  ur: "اردو",
  ar: "العربية"
};

export function isLocale(value: string): value is SupportedLocale {
  return locales.includes(value as SupportedLocale);
}

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "en" ? "ltr" : "rtl";
}
