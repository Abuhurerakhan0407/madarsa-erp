export const locales = ["en", "ur", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "en" ? "ltr" : "rtl";
}
