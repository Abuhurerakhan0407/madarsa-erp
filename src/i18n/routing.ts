import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/config";

// Runtime routes expose only English and Urdu. Widen the compile-time tuple to
// the legacy Locale union so older localized copy can remain type-compatible
// while `locales` itself stays the authoritative routed locale list.
const routingLocales = locales as unknown as [Locale, ...Locale[]];

export const routing = defineRouting({
  locales: routingLocales,
  defaultLocale,
  localePrefix: "always"
});
