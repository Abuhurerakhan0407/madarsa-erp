import { localeLabels, locales, type Locale } from "@/lib/i18n/config";
import { Link } from "@/i18n/navigation";

type LocaleSwitcherProps = {
  currentLocale: Locale;
  label: string;
};

export function LocaleSwitcher({ currentLocale, label }: LocaleSwitcherProps) {
  return (
    <nav aria-label={label} className="locale-switcher">
      {locales.map((locale) => (
        <Link
          key={locale}
          href="/"
          locale={locale}
          aria-current={locale === currentLocale ? "page" : undefined}
          className="locale-link"
        >
          {localeLabels[locale]}
        </Link>
      ))}
    </nav>
  );
}
