import type { ConfigurationLocale } from "./model";

export type PresetActionLabels = {
  apply: string;
  applying: string;
  applied: string;
  failed: string;
};

export const presetActionLabels: Record<ConfigurationLocale, PresetActionLabels> = {
  en: {
    apply: "Create draft configuration",
    applying: "Creating drafts…",
    applied: "Draft terminology and attendance created.",
    failed: "Could not create preset drafts."
  },
  ur: {
    apply: "ڈرافٹ ترتیبات بنائیں",
    applying: "ڈرافٹس بن رہے ہیں…",
    applied: "اصطلاحات اور حاضری کے ڈرافٹس بن گئے۔",
    failed: "پری سیٹ ڈرافٹس نہیں بن سکے۔"
  },
  ar: {
    apply: "إنشاء إعدادات مسودة",
    applying: "جارٍ إنشاء المسودات…",
    applied: "تم إنشاء مسودات المصطلحات والحضور.",
    failed: "تعذر إنشاء مسودات الإعداد المسبق."
  }
};
