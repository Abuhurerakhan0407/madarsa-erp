import type { SupportedLocale } from "@/lib/i18n/config";

export const JAMIA_CLIENT = {
  name: "Jamia Islamia Uloomul Quraan",
  nameUr: "جامعہ اسلامیہ علوم القرآن",
  shortName: "Jamia Islamia",
  shortNameUr: "جامعہ اسلامیہ",
  descriptor: "Hifz • Arabic Learning • Residential Hostel",
  descriptorUr: "حفظ • عربی تعلیم • رہائشی ہاسٹل",
  year: "2026–27",
  branch: "Main Campus",
  director: "Mufti Nooruddin Azami",
  phone: "9450825657",
  email: "uloomulquran@gmail.com",
  address: "Martinganj Road, Kuriyawan, Phulpur, Uttar Pradesh"
} as const;

export type JamiaOfficeNavKey =
  | "home" | "admissions" | "talaba" | "attendance"
  | "hifz" | "academics" | "hostel" | "portals"
  | "ustadh" | "exams" | "documents" | "reports" | "settings";

type NavItem = {
  key: JamiaOfficeNavKey;
  labels: Record<SupportedLocale, string>;
  href: (locale: SupportedLocale) => string;
};

const nav = (key: JamiaOfficeNavKey, en: string, ur: string, path: string): NavItem => ({
  key, labels: { en, ur }, href: (locale) => `/${locale}${path}`
});

export const JAMIA_OFFICE_NAV: NavItem[] = [
  nav("home", "Home", "ہوم", ""),
  nav("admissions", "Admissions", "داخلہ", "/admissions"),
  nav("talaba", "Talaba", "طلبہ", "/students"),
  nav("attendance", "Attendance", "حاضری", "/attendance"),
  nav("hifz", "Qur'an & Hifz", "قرآن و حفظ", "/quran"),
  nav("academics", "Academics", "اکیڈمکس", "/people-academics"),
  nav("hostel", "Hostel", "ہاسٹل", "/hostel"),
  nav("portals", "Guardian & Ustadh Portal", "گارڈین و اساتذہ پورٹل", "/portals"),
  nav("ustadh", "Ustadh", "اساتذہ", "/staff"),
  nav("exams", "Exams & Results", "امتحانات و نتائج", "/exams"),
  nav("documents", "IDs & Documents", "آئی ڈی و دستاویزات", "/documents"),
  nav("reports", "Reports", "رپورٹس", "/reports"),
  nav("settings", "Settings", "سیٹنگز", "/settings/configuration")
];
