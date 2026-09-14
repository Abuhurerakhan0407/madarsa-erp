export const locales = ["en", "ur"] as const;
export type Locale = (typeof locales)[number];
export type SupportedLocale = Locale;

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  ur: "اردو"
};

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "en" ? "ltr" : "rtl";
}
