import type { Locale } from "@/lib/i18n/config";

const statusLabels: Record<Locale, Record<string, string>> = {
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
  },
  ar: {
    new: "جديد",
    contacted: "تم التواصل",
    qualified: "مؤهل",
    lost: "غير متابع",
    archived: "مؤرشف",
    application_started: "بدأ طلب القبول",
    converted: "تم التحويل إلى طالب"
  }
};

const channelLabels: Record<Locale, Record<string, string>> = {
  en: { phone: "Phone", email: "Email", whatsapp: "WhatsApp", in_person: "In person" },
  ur: { phone: "فون", email: "ای میل", whatsapp: "واٹس ایپ", in_person: "بالمشافہ" },
  ar: { phone: "هاتف", email: "بريد إلكتروني", whatsapp: "واتساب", in_person: "حضوري" }
};

export const admissionStates = ["draft", "submitted", "verification", "assessment", "decision", "offered", "waitlisted", "rejected", "payment_pending", "enrolled", "expired", "withdrawn"] as const;
export const admissionReviewTypes = ["completeness", "eligibility", "duplicate", "document", "final"] as const;
export const admissionReviewOutcomes = ["pending", "pass", "fail", "needs_information", "overridden"] as const;
export const admissionDecisionOutcomes = ["offered", "waitlisted", "rejected"] as const;

type AdmissionState = (typeof admissionStates)[number];
type AdmissionReviewType = (typeof admissionReviewTypes)[number];
type AdmissionReviewOutcome = (typeof admissionReviewOutcomes)[number];
type AdmissionDecisionOutcome = (typeof admissionDecisionOutcomes)[number];

const applicationStateLabels: Record<Locale, Record<AdmissionState, string>> = {
  en: { draft: "Draft", submitted: "Submitted", verification: "Verification", assessment: "Assessment", decision: "Decision", offered: "Offered", waitlisted: "Waitlisted", rejected: "Rejected", payment_pending: "Payment pending", enrolled: "Enrolled", expired: "Expired", withdrawn: "Withdrawn" },
  ur: { draft: "مسودہ", submitted: "جمع شدہ", verification: "تصدیق", assessment: "جانچ", decision: "فیصلہ", offered: "پیشکش", waitlisted: "انتظار فہرست", rejected: "مسترد", payment_pending: "ادائیگی زیر التوا", enrolled: "داخل", expired: "میعاد ختم", withdrawn: "واپس لی گئی" },
  ar: { draft: "مسودة", submitted: "مُقدّم", verification: "التحقق", assessment: "التقييم", decision: "القرار", offered: "تم العرض", waitlisted: "قائمة الانتظار", rejected: "مرفوض", payment_pending: "الدفع معلّق", enrolled: "مسجّل", expired: "منتهي", withdrawn: "منسحب" }
};

const reviewTypeLabels: Record<Locale, Record<AdmissionReviewType, string>> = {
  en: { completeness: "Completeness", eligibility: "Eligibility", duplicate: "Duplicate review", document: "Document review", final: "Final review" },
  ur: { completeness: "مکمل ہونے کی جانچ", eligibility: "اہلیت", duplicate: "نقل کی جانچ", document: "دستاویزات کی جانچ", final: "حتمی جائزہ" },
  ar: { completeness: "اكتمال الطلب", eligibility: "الأهلية", duplicate: "مراجعة التكرار", document: "مراجعة المستندات", final: "المراجعة النهائية" }
};

const reviewOutcomeLabels: Record<Locale, Record<AdmissionReviewOutcome, string>> = {
  en: { pending: "Pending", pass: "Passed", fail: "Failed", needs_information: "Needs information", overridden: "Overridden" },
  ur: { pending: "زیر التوا", pass: "کامیاب", fail: "ناکام", needs_information: "مزید معلومات درکار", overridden: "خصوصی منظوری" },
  ar: { pending: "قيد الانتظار", pass: "ناجح", fail: "غير ناجح", needs_information: "يحتاج معلومات", overridden: "تم التجاوز" }
};

const decisionOutcomeLabels: Record<Locale, Record<AdmissionDecisionOutcome, string>> = {
  en: { offered: "Admission offered", waitlisted: "Waitlisted", rejected: "Rejected" },
  ur: { offered: "داخلہ پیش کیا گیا", waitlisted: "انتظار فہرست", rejected: "مسترد" },
  ar: { offered: "تم عرض القبول", waitlisted: "قائمة الانتظار", rejected: "مرفوض" }
};

export function enquiryStatusLabel(locale: Locale, status: string): string {
  return statusLabels[locale][status] ?? status;
}

export function enquiryChannelLabel(locale: Locale, channel: string): string {
  return channelLabels[locale][channel] ?? channel;
}

export function admissionStateLabel(locale: Locale, state: string): string {
  return applicationStateLabels[locale][state as AdmissionState] ?? state;
}

export function admissionReviewTypeLabel(locale: Locale, reviewType: string): string {
  return reviewTypeLabels[locale][reviewType as AdmissionReviewType] ?? reviewType;
}

export function admissionReviewOutcomeLabel(locale: Locale, outcome: string): string {
  return reviewOutcomeLabels[locale][outcome as AdmissionReviewOutcome] ?? outcome;
}

export function admissionDecisionOutcomeLabel(locale: Locale, outcome: string): string {
  return decisionOutcomeLabels[locale][outcome as AdmissionDecisionOutcome] ?? outcome;
}
