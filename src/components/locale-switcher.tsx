"use client";

import { useSearchParams } from "next/navigation";
import { localeLabels, locales, type Locale } from "@/lib/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";

type LocaleSwitcherProps = {
  currentLocale: Locale;
  label: string;
};

function persistLocale(locale: "en" | "ur") {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function LocaleSwitcher({ currentLocale, label }: LocaleSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  function changeLocale(locale: "en" | "ur") {
    if (locale === currentLocale) return;
    persistLocale(locale);
    const query = searchParams.toString();
    const destination = query ? `${pathname}?${query}` : pathname;
    router.replace(destination, { locale });
  }

  return (
    <nav aria-label={label} className="locale-switcher">
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          aria-current={locale === currentLocale ? "page" : undefined}
          aria-pressed={locale === currentLocale}
          className="locale-link"
          onClick={() => changeLocale(locale)}
        >
          {localeLabels[locale]}
        </button>
      ))}
    </nav>
  );
}
