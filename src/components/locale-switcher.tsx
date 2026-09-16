"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingLocale, setPendingLocale] = useState<SupportedLocale | null>(null);
  const query = searchParams.toString();

  return (
    <nav aria-label={label} className="locale-switcher">
      {locales.map((locale) => {
        const href = localizedHref(pathname, query, locale);
        const localePending = pending && pendingLocale === locale;
        return (
          <Link
            key={locale}
            href={href}
            aria-current={locale === currentLocale ? "page" : undefined}
            aria-busy={localePending || undefined}
            className="locale-link"
            hrefLang={locale}
            prefetch
            onClick={(event) => {
              if (locale === currentLocale) {
                event.preventDefault();
                return;
              }
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
              event.preventDefault();
              setPendingLocale(locale);
              startTransition(() => router.push(href));
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
