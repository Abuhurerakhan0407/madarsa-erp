import type { ClientCapabilityProfile } from "../capabilities/client-profile";
import { isNavItemEnabled } from "../capabilities/client-profile";
import type { Locale } from "../i18n/config";

export type AppNavItem = { key: string; labels: Record<Locale, string>; href: (locale: Locale) => string; };
export type AppNavGroup = { key: string; labels: Record<Locale, string>; items: AppNavItem[]; };

export const APP_NAV_GROUPS: AppNavGroup[] = [
  { key: "daily", labels: { en: "Daily work", ur: "روزمرہ کام", ar: "العمل اليومي" }, items: [
    { key: "overview", labels: { en: "Overview", ur: "جائزہ", ar: "نظرة عامة" }, href: (locale) => `/${locale}` },
    { key: "admissions", labels: { en: "Admissions", ur: "داخلہ", ar: "القبول" }, href: (locale) => `/${locale}/admissions` },
    { key: "students", labels: { en: "Students", ur: "طلبہ", ar: "الطلاب" }, href: (locale) => `/${locale}/students` },
    { key: "programs", labels: { en: "Programs & Syllabus", ur: "پروگرامز و نصاب", ar: "البرامج والمنهج" }, href: (locale) => `/${locale}/programs` },
    { key: "academics", labels: { en: "Academics & Timetable", ur: "اکیڈمکس و ٹائم ٹیبل", ar: "الأكاديميات والجدول" }, href: (locale) => `/${locale}/people-academics` },
    { key: "attendance", labels: { en: "Attendance", ur: "حاضری", ar: "الحضور" }, href: (locale) => `/${locale}/attendance` },
    { key: "quran", labels: { en: "Qur'an & Hifz", ur: "قرآن و حفظ", ar: "القرآن والحفظ" }, href: (locale) => `/${locale}/quran` },
    { key: "exams", labels: { en: "Exams & Results", ur: "امتحانات و نتائج", ar: "الاختبارات والنتائج" }, href: (locale) => `/${locale}/exams` }
  ]},
  { key: "people", labels: { en: "People & access", ur: "افراد و رسائی", ar: "الأشخاص والوصول" }, items: [
    { key: "portals", labels: { en: "Parent & Teacher Access", ur: "والدین و اساتذہ رسائی", ar: "وصول أولياء الأمور والمعلمين" }, href: (locale) => `/${locale}/portals` },
    { key: "staff", labels: { en: "Teachers", ur: "اساتذہ", ar: "المعلمون" }, href: (locale) => `/${locale}/staff` },
    { key: "payroll", labels: { en: "Payroll", ur: "پے رول", ar: "كشف الرواتب" }, href: (locale) => `/${locale}/payroll` }
  ]},
  { key: "office", labels: { en: "Office & setup", ur: "دفتر و سیٹ اپ", ar: "المكتب والإعداد" }, items: [
    { key: "fees", labels: { en: "Fees & Payments", ur: "فیس و ادائیگیاں", ar: "الرسوم والمدفوعات" }, href: (locale) => `/${locale}/fees` },
    { key: "donations", labels: { en: "Contributions", ur: "عطیات", ar: "المساهمات" }, href: (locale) => `/${locale}/contributions` },
    { key: "operations", labels: { en: "Import, Promotion & Renewal", ur: "امپورٹ، پروموشن و رینیول", ar: "الاستيراد والترفيع والتجديد" }, href: (locale) => `/${locale}/students/lifecycle` },
    { key: "certificates", labels: { en: "IDs & Documents", ur: "ID و دستاویزات", ar: "الهويات والمستندات" }, href: (locale) => `/${locale}/documents` },
    { key: "reports", labels: { en: "Reports & Analytics", ur: "رپورٹس و اینالیٹکس", ar: "التقارير والتحليلات" }, href: (locale) => `/${locale}/reports` },
    { key: "configuration", labels: { en: "Institution Configuration", ur: "ادارہ کنفیگریشن", ar: "تهيئة المؤسسة" }, href: (locale) => `/${locale}/settings/configuration` },
    { key: "ai", labels: { en: "AI Assistant", ur: "AI معاون", ar: "مساعد الذكاء الاصطناعي" }, href: (locale) => `/${locale}/demo/ai` },
    { key: "branches", labels: { en: "Roles & Access", ur: "رولز و رسائی", ar: "الأدوار والوصول" }, href: (locale) => `/${locale}/access` }
  ]}
];

export function getVisibleNavigation(profile: ClientCapabilityProfile): AppNavGroup[] {
  return APP_NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => isNavItemEnabled(profile, item.key)) })).filter((group) => group.items.length > 0);
}
export function findNavItem(key: string): AppNavItem | undefined { return APP_NAV_GROUPS.flatMap((group) => group.items).find((item) => item.key === key); }
