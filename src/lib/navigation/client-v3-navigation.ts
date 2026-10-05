import type { ClientCapabilityProfile } from "@/lib/capabilities/client-profile";
import { isNavItemEnabled } from "@/lib/capabilities/client-profile";
import type { SupportedLocale } from "@/lib/i18n/config";

export type NavigationAudience = "office" | "teacher" | "neutral";
export type ClientV3NavItem = {
  key: string;
  labels: Record<SupportedLocale, string>;
  href: (locale: SupportedLocale) => string;
};
export type ClientV3Navigation = {
  primary: ClientV3NavItem[];
  more: ClientV3NavItem[];
  mobile: ClientV3NavItem[];
};

const item = (
  key: string,
  en: string,
  ur: string,
  path: (locale: SupportedLocale) => string
): ClientV3NavItem => ({ key, labels: { en, ur }, href: path });

const officePrimary: ClientV3NavItem[] = [
  item("home", "Home", "ہوم", (l) => `/${l}`),
  item("admissions", "Admissions", "داخلہ", (l) => `/${l}/admissions`),
  item("students", "Students", "طلبہ", (l) => `/${l}/students`),
  item("attendance", "Attendance", "حاضری", (l) => `/${l}/attendance`),
  item("quran", "Qur'an & Hifz", "قرآن و حفظ", (l) => `/${l}/quran`),
  item("programs", "Programs & Syllabus", "پروگرامز و نصاب", (l) => `/${l}/programs`)
];

const officeMore: ClientV3NavItem[] = [
  item("academics", "Academics, Timetable & Homework", "اکیڈمکس، ٹائم ٹیبل و ہوم ورک", (l) => `/${l}/people-academics`),
  item("lifecycle", "Import Students", "طلبہ امپورٹ کریں", (l) => `/${l}/students/lifecycle`),
  item("hostel", "Hostel Boys", "ہاسٹل بوائز", (l) => `/${l}/hostel`),
  item("portals", "Parent & Teacher Access", "والدین و اساتذہ رسائی", (l) => `/${l}/portals`),
  item("teachers", "Teachers & Staff", "اساتذہ و عملہ", (l) => `/${l}/staff`),
  item("exams", "Exams & Results", "امتحانات و نتائج", (l) => `/${l}/exams`),
  item("documents", "IDs & Documents", "آئی ڈی اور دستاویزات", (l) => `/${l}/documents`),
  item("reports", "Reports & Analytics", "رپورٹس و تجزیات", (l) => `/${l}/reports`),
  item("fees", "Fees & Payments", "فیس و ادائیگیاں", (l) => `/${l}/fees`),
  item("contributions", "Donations & Zakat", "عطیات و زکوٰۃ", (l) => `/${l}/contributions`),
  item("payroll", "Payroll", "تنخواہیں", (l) => `/${l}/payroll`),
  item("access", "Roles & Access", "کردار و رسائی", (l) => `/${l}/access`),
  item("assistant", "AI Assistant", "اے آئی اسسٹنٹ", (l) => `/${l}/assistant`),
  item("settings", "Institution Settings", "ادارہ سیٹنگز", (l) => `/${l}/settings/configuration`)
];

const teacherPrimary: ClientV3NavItem[] = [
  item("home", "Home", "ہوم", (l) => `/${l}`),
  item("my-students", "My Students", "میرے طلبہ", (l) => `/${l}/my-students`),
  item("attendance", "Attendance", "حاضری", (l) => `/${l}/attendance`),
  item("quran", "Qur'an & Hifz", "قرآن و حفظ", (l) => `/${l}/quran`)
];

function enabled(
  items: ClientV3NavItem[],
  profile?: ClientCapabilityProfile
): ClientV3NavItem[] {
  return profile ? items.filter((entry) => isNavItemEnabled(profile, entry.key)) : items;
}

export function getClientV3Navigation(
  audience: NavigationAudience,
  profile?: ClientCapabilityProfile
): ClientV3Navigation {
  if (audience === "teacher") {
    const primary = enabled(teacherPrimary, profile);
    return { primary, more: [], mobile: primary };
  }
  if (audience === "neutral") return { primary: [], more: [], mobile: [] };

  const primary = enabled(officePrimary, profile);
  const more = enabled(officeMore, profile);
  const mobileKeys = new Set(["home", "admissions", "students", "attendance"]);
  const mobile = primary.filter((entry) => mobileKeys.has(entry.key));
  return { primary, more, mobile };
}

export function getSupplementalMobileNavigation(
  navigation: ClientV3Navigation
): ClientV3NavItem[] {
  const quickKeys = new Set(navigation.mobile.map((entry) => entry.key));
  return [...navigation.primary, ...navigation.more].filter((entry) => !quickKeys.has(entry.key));
}