"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { localeLabels, locales, type Locale, type SupportedLocale } from "@/lib/i18n/config";

type Props = { currentLocale: Locale; label: string };

export function localizedHref(pathname: string, query: string, locale: Locale): string {
  const parts = pathname.split("/");
  if (parts.length > 1 && locales.includes(parts[1] as SupportedLocale)) parts[1] = locale;
  else parts.splice(1, 0, locale);
  const path = parts.join("/") || `/${locale}`;
  return query ? `${path}?${query}` : path;
}

export function LocaleSwitcher({ currentLocale, label }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingLocale, setPendingLocale] = useState<SupportedLocale | null>(null);

  return (
    <nav aria-label={label} className="locale-switcher">
      {locales.map((locale) => {
        const baseHref = localizedHref(pathname, "", locale);
        const localePending = pending && pendingLocale === locale;
        return (
          <Link
            key={locale}
            href={baseHref}
            aria-current={locale === currentLocale ? "page" : undefined}
            aria-busy={localePending || undefined}
            className="locale-link"
            hrefLang={locale}
            prefetch
            onClick={(event) => {
              if (locale === currentLocale) return;
              event.preventDefault();
              setPendingLocale(locale);
              const query = window.location.search.replace(/^\?/, "");
              startTransition(() => router.push(localizedHref(pathname, query, locale)));
            }}
          >
            <span>{localeLabels[locale]}</span>
            {localePending ? <span className="inline-spinner" aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
