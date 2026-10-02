import type { SupportedLocale } from "@/lib/i18n/config";

const statusLabels: Record<SupportedLocale, Record<string, string>> = {
  en: {
    new: "New",
    contacted: "Contacted",
    qualified: "Qualified",
    lost: "Lost",
    archived: "Archived",
    application_started: "Application started",
    converted: "Converted"
  },
  ur: {
    new: "نیا",
    contacted: "رابطہ ہوا",
    qualified: "اہل",
    lost: "رابطہ ختم",
    archived: "محفوظ شدہ",
    application_started: "درخواست شروع ہوگئی",
    converted: "طالب علم بنا دیا گیا"
  }
};

const channelLabels: Record<SupportedLocale, Record<string, string>> = {
  en: { phone: "Phone", email: "Email", whatsapp: "Legacy messaging", in_person: "In person" },
  ur: { phone: "فون", email: "ای میل", whatsapp: "سابقہ پیغام", in_person: "بالمشافہ" }
};

export const admissionStates = ["draft", "submitted", "verification", "assessment", "decision", "offered", "waitlisted", "rejected", "payment_pending", "enrolled", "expired", "withdrawn"] as const;
export const admissionReviewTypes = ["completeness", "eligibility", "duplicate", "document", "final"] as const;
export const admissionReviewOutcomes = ["pending", "pass", "fail", "needs_information", "overridden"] as const;
export const admissionDecisionOutcomes = ["offered", "waitlisted", "rejected"] as const;

type AdmissionState = (typeof admissionStates)[number];
type AdmissionReviewType = (typeof admissionReviewTypes)[number];
type AdmissionReviewOutcome = (typeof admissionReviewOutcomes)[number];
type AdmissionDecisionOutcome = (typeof admissionDecisionOutcomes)[number];

const applicationStateLabels: Record<SupportedLocale, Record<AdmissionState, string>> = {
  en: { draft: "Draft", submitted: "Submitted", verification: "Verification", assessment: "Assessment", decision: "Decision", offered: "Offered", waitlisted: "Waitlisted", rejected: "Rejected", payment_pending: "Payment pending", enrolled: "Enrolled", expired: "Expired", withdrawn: "Withdrawn" },
  ur: { draft: "مسودہ", submitted: "جمع شدہ", verification: "تصدیق", assessment: "جانچ", decision: "فیصلہ", offered: "پیشکش", waitlisted: "انتظار فہرست", rejected: "مسترد", payment_pending: "ادائیگی زیر التوا", enrolled: "داخل", expired: "میعاد ختم", withdrawn: "واپس لی گئی" }
};

const reviewTypeLabels: Record<SupportedLocale, Record<AdmissionReviewType, string>> = {
  en: { completeness: "Completeness", eligibility: "Eligibility", duplicate: "Duplicate review", document: "Document review", final: "Final review" },
  ur: { completeness: "مکمل ہونے کی جانچ", eligibility: "اہلیت", duplicate: "نقل کی جانچ", document: "دستاویزات کی جانچ", final: "حتمی جائزہ" }
};

const reviewOutcomeLabels: Record<SupportedLocale, Record<AdmissionReviewOutcome, string>> = {
  en: { pending: "Pending", pass: "Passed", fail: "Failed", needs_information: "Needs information", overridden: "Overridden" },
  ur: { pending: "زیر التوا", pass: "کامیاب", fail: "ناکام", needs_information: "مزید معلومات درکار", overridden: "خصوصی منظوری" }
};

const decisionOutcomeLabels: Record<SupportedLocale, Record<AdmissionDecisionOutcome, string>> = {
  en: { offered: "Admission offered", waitlisted: "Waitlisted", rejected: "Rejected" },
  ur: { offered: "داخلہ پیش کیا گیا", waitlisted: "انتظار فہرست", rejected: "مسترد" }
};

export function enquiryStatusLabel(locale: SupportedLocale, status: string): string {
  return statusLabels[locale][status] ?? status;
}

export function enquiryChannelLabel(locale: SupportedLocale, channel: string): string {
  return channelLabels[locale][channel] ?? channel;
}

export function admissionStateLabel(locale: SupportedLocale, state: string): string {
  return applicationStateLabels[locale][state as AdmissionState] ?? state;
}

export function admissionReviewTypeLabel(locale: SupportedLocale, reviewType: string): string {
  return reviewTypeLabels[locale][reviewType as AdmissionReviewType] ?? reviewType;
}

export function admissionReviewOutcomeLabel(locale: SupportedLocale, outcome: string): string {
  return reviewOutcomeLabels[locale][outcome as AdmissionReviewOutcome] ?? outcome;
}

export function admissionDecisionOutcomeLabel(locale: SupportedLocale, outcome: string): string {
  return decisionOutcomeLabels[locale][outcome as AdmissionDecisionOutcome] ?? outcome;
}
