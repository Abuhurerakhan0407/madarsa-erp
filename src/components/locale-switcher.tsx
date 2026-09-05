"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import {localeLabels,locales,type Locale} from "@/lib/i18n/config";
type Props={currentLocale:Locale;label:string};
export function localizedHref(pathname:string,query:string,locale:Locale):string{const parts=pathname.split("/");if(parts.length>1&&locales.includes(parts[1] as Locale))parts[1]=locale;else parts.splice(1,0,locale);const path=parts.join("/")||`/${locale}`;return query?`${path}?${query}`:path;}
export function LocaleSwitcher({currentLocale,label}:Props){const pathname=usePathname();const[query,setQuery]=useState("");useEffect(()=>setQuery(window.location.search.replace(/^\?/,"")),[pathname]);return <nav aria-label={label} className="locale-switcher">{locales.map(locale=><Link key={locale} href={localizedHref(pathname,query,locale)} aria-current={locale===currentLocale?"page":undefined} className="locale-link" hrefLang={locale}>{localeLabels[locale]}</Link>)}</nav>}
