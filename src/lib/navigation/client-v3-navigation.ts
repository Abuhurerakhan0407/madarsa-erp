import type { Locale } from "@/lib/i18n/config";

export type NavigationAudience = "office" | "teacher" | "neutral";
export type ClientV3NavItem = { key: string; labels: Record<Locale, string>; href: (locale: Locale) => string };
export type ClientV3Navigation = { primary: ClientV3NavItem[]; more: ClientV3NavItem[]; mobile: ClientV3NavItem[] };

const item = (key: string, en: string, ur: string, path: (locale: Locale) => string): ClientV3NavItem => ({ key, labels: { en, ur } as Record<Locale, string>, href: path });

const officePrimary: ClientV3NavItem[] = [
  item("home", "Home", "ہوم", (l) => `/${l}`),
  item("admissions", "Admissions", "داخلہ", (l) => `/${l}/admissions`),
  item("students", "Students", "طلبہ", (l) => `/${l}/students`),
  item("attendance", "Attendance", "حاضری", (l) => `/${l}/attendance`),
  item("quran", "Qur'an & Hifz", "قرآن و حفظ", (l) => `/${l}/quran`),
  item("programs", "Programs", "پروگرامز", (l) => `/${l}/programs`)
];

const officeMore: ClientV3NavItem[] = [
  item("portals", "Parent & Teacher Access", "والدین و اساتذہ رسائی", (l) => `/${l}/portals`),
  item("teachers", "Teachers & Staff", "اساتذہ و عملہ", (l) => `/${l}/staff`),
  item("exams", "Exams & Results", "امتحانات و نتائج", (l) => `/${l}/exams`),
  item("documents", "IDs, Documents & Certificates", "آئی ڈی، دستاویزات و سرٹیفکیٹس", (l) => `/${l}/documents`),
  item("reports", "Reports & Analytics", "رپورٹس و تجزیات", (l) => `/${l}/reports`),
  item("fees", "Fees & Payments", "فیس و ادائیگیاں", (l) => `/${l}/fees`),
  item("contributions", "Donations, Zakat & Sponsorships", "عطیات، زکوٰۃ و کفالت", (l) => `/${l}/contributions`),
  item("payroll", "Payroll", "تنخواہیں", (l) => `/${l}/payroll`),
  item("access", "Roles & Access", "کردار و رسائی", (l) => `/${l}/access`),
  item("assistant", "AI Assistant", "اے آئی اسسٹنٹ", (l) => `/${l}/assistant`),
  item("settings", "Settings", "سیٹنگز", (l) => `/${l}/settings/configuration`)
];

const teacherPrimary: ClientV3NavItem[] = [
  item("home", "Home", "ہوم", (l) => `/${l}`),
  item("my-students", "My Students", "میرے طلبہ", (l) => `/${l}/my-students`),
  item("attendance", "Attendance", "حاضری", (l) => `/${l}/attendance`),
  item("quran", "Qur'an & Hifz", "قرآن و حفظ", (l) => `/${l}/quran`)
];

export function getClientV3Navigation(audience: NavigationAudience): ClientV3Navigation {
  if (audience === "teacher") return { primary: teacherPrimary, more: [], mobile: teacherPrimary };
  if (audience === "neutral") return { primary: [], more: [], mobile: [] };
  return {
    primary: officePrimary,
    more: officeMore,
    mobile: [officePrimary[0], officePrimary[1], officePrimary[2], officePrimary[3]]
  };
}

export function getSupplementalMobileNavigation(navigation: ClientV3Navigation): ClientV3NavItem[] {
  const quickKeys = new Set(navigation.mobile.map((item) => item.key));
  return [...navigation.primary, ...navigation.more].filter((item) => !quickKeys.has(item.key));
}
