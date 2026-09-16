import { Geist, Geist_Mono, Noto_Naskh_Arabic, Noto_Nastaliq_Urdu } from "next/font/google";
import type { Locale } from "@/lib/i18n/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap"
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false
});

const notoNaskhArabic = Noto_Naskh_Arabic({
  variable: "--font-naskh-arabic",
  subsets: ["arabic"],
  display: "swap",
  preload: false
});

const notoNastaliqUrdu = Noto_Nastaliq_Urdu({
  variable: "--font-nastaliq-urdu",
  subsets: ["arabic"],
  display: "swap",
  preload: false
});

export const latinFontVariables = `${geistSans.variable} ${geistMono.variable}`;

export function getAppFontVariables(locale: Locale): string {
  if (locale === "ur") {
    return `${latinFontVariables} ${notoNaskhArabic.variable} ${notoNastaliqUrdu.variable}`;
  }

  return latinFontVariables;
}

// Public multilingual surfaces can switch language without a route-level locale.
// Non-Latin faces are not preloaded, so English first paint stays lightweight.
export const appFontVariables = `${latinFontVariables} ${notoNaskhArabic.variable} ${notoNastaliqUrdu.variable}`;
