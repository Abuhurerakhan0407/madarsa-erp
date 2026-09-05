"use client";

import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {localeLabels,locales,type Locale} from "@/lib/i18n/config";
type Props={currentLocale:Locale;label:string};
export function localizedHref(pathname:string,query:string,locale:Locale):string{const parts=pathname.split("/");if(parts.length>1&&locales.includes(parts[1] as Locale))parts[1]=locale;else parts.splice(1,0,locale);const path=parts.join("/")||`/${locale}`;return query?`${path}?${query}`:path;}
export function LocaleSwitcher({currentLocale,label}:Props){const pathname=usePathname(),router=useRouter();return <nav aria-label={label} className="locale-switcher">{locales.map(locale=>{const baseHref=localizedHref(pathname,"",locale);return <Link key={locale} href={baseHref} aria-current={locale===currentLocale?"page":undefined} className="locale-link" hrefLang={locale} onClick={event=>{event.preventDefault();const query=window.location.search.replace(/^\?/,"");router.push(localizedHref(pathname,query,locale))}}>{localeLabels[locale]}</Link>})}</nav>}
