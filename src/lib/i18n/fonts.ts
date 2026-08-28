import { Geist, Geist_Mono, Noto_Naskh_Arabic, Noto_Nastaliq_Urdu } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap"
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap"
});

const notoNaskhArabic = Noto_Naskh_Arabic({
  variable: "--font-naskh-arabic",
  subsets: ["arabic"],
  display: "swap"
});

const notoNastaliqUrdu = Noto_Nastaliq_Urdu({
  variable: "--font-nastaliq-urdu",
  subsets: ["arabic"],
  display: "swap"
});

export const appFontVariables = `${geistSans.variable} ${geistMono.variable} ${notoNaskhArabic.variable} ${notoNastaliqUrdu.variable}`;
