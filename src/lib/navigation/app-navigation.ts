import type { ClientCapabilityProfile } from "../capabilities/client-profile";
import { isNavItemEnabled } from "../capabilities/client-profile";
import type { SupportedLocale } from "../i18n/config";

export type AppNavItem = { key: string; labels: Record<SupportedLocale, string>; href: (locale: SupportedLocale) => string; };
export type AppNavGroup = { key: string; labels: Record<SupportedLocale, string>; items: AppNavItem[]; };

export const APP_NAV_GROUPS: AppNavGroup[] = [
  { key: "daily", labels: { en: "Daily work", ur: "روزمرہ کام" }, items: [
    { key: "overview", labels: { en: "Overview", ur: "جائزہ" }, href: (locale) => `/${locale}` },
    { key: "admissions", labels: { en: "Admissions", ur: "داخلہ" }, href: (locale) => `/${locale}/admissions` },
    { key: "students", labels: { en: "Students", ur: "طلبہ" }, href: (locale) => `/${locale}/students` },
    { key: "programs", labels: { en: "Programs & Syllabus", ur: "پروگرامز و نصاب" }, href: (locale) => `/${locale}/programs` },
    { key: "academics", labels: { en: "Academics, Timetable & Homework", ur: "اکیڈمکس، ٹائم ٹیبل و ہوم ورک" }, href: (locale) => `/${locale}/people-academics` },
    { key: "attendance", labels: { en: "Attendance", ur: "حاضری" }, href: (locale) => `/${locale}/attendance` },
    { key: "quran", labels: { en: "Qur'an & Hifz", ur: "قرآن و حفظ" }, href: (locale) => `/${locale}/quran` },
    { key: "exams", labels: { en: "Exams & Results", ur: "امتحانات و نتائج" }, href: (locale) => `/${locale}/exams` }
  ]},
  { key: "people", labels: { en: "People & access", ur: "افراد و رسائی" }, items: [
    { key: "portals", labels: { en: "Parent & Teacher Access", ur: "والدین و اساتذہ رسائی" }, href: (locale) => `/${locale}/portals` },
    { key: "staff", labels: { en: "Teachers & Staff", ur: "اساتذہ و عملہ" }, href: (locale) => `/${locale}/staff` },
    { key: "payroll", labels: { en: "Payroll", ur: "تنخواہیں" }, href: (locale) => `/${locale}/payroll` }
  ]},
  { key: "office", labels: { en: "Office & setup", ur: "دفتر و سیٹ اپ" }, items: [
    { key: "fees", labels: { en: "Fees & Payments", ur: "فیس و ادائیگیاں" }, href: (locale) => `/${locale}/fees` },
    { key: "donations", labels: { en: "Donations, Zakat & Sponsorships", ur: "عطیات، زکوٰۃ و کفالت" }, href: (locale) => `/${locale}/contributions` },
    { key: "operations", labels: { en: "Import, Promotion & Renewal", ur: "امپورٹ، پروموشن و رینیول" }, href: (locale) => `/${locale}/students/lifecycle` },
    { key: "certificates", labels: { en: "IDs, Documents & Certificates", ur: "آئی ڈی، دستاویزات و سرٹیفکیٹس" }, href: (locale) => `/${locale}/documents` },
    { key: "reports", labels: { en: "Reports & Analytics", ur: "رپورٹس و تجزیات" }, href: (locale) => `/${locale}/reports` },
    { key: "configuration", labels: { en: "Institution Settings", ur: "ادارہ سیٹنگز" }, href: (locale) => `/${locale}/settings/configuration` },
    { key: "ai", labels: { en: "AI Assistant", ur: "اے آئی اسسٹنٹ" }, href: (locale) => `/${locale}/assistant` },
    { key: "branches", labels: { en: "Roles & Access", ur: "کردار و رسائی" }, href: (locale) => `/${locale}/access` }
  ]}
];

export function getVisibleNavigation(profile: ClientCapabilityProfile): AppNavGroup[] {
  return APP_NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => isNavItemEnabled(profile, item.key)) })).filter((group) => group.items.length > 0);
}
export function findNavItem(key: string): AppNavItem | undefined { return APP_NAV_GROUPS.flatMap((group) => group.items).find((item) => item.key === key); }
