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

const applicationStateLabels: Record<Locale, Record<string, string>> = {
  en: { submitted: "Submitted", verification: "Verification", assessment: "Assessment", decision: "Decision", offered: "Offered", waitlisted: "Waitlisted", payment_pending: "Payment pending", enrolled: "Enrolled", rejected: "Rejected", expired: "Expired", withdrawn: "Withdrawn" },
  ur: { submitted: "جمع شدہ", verification: "تصدیق", assessment: "جانچ", decision: "فیصلہ", offered: "پیشکش", waitlisted: "انتظار فہرست", payment_pending: "ادائیگی زیر التوا", enrolled: "داخل", rejected: "مسترد", expired: "میعاد ختم", withdrawn: "واپس لی گئی" },
  ar: { submitted: "مُقدّم", verification: "التحقق", assessment: "التقييم", decision: "القرار", offered: "تم العرض", waitlisted: "قائمة الانتظار", payment_pending: "الدفع معلّق", enrolled: "مسجّل", rejected: "مرفوض", expired: "منتهي", withdrawn: "منسحب" }
};

export function enquiryStatusLabel(locale: Locale, status: string): string {
  return statusLabels[locale][status] ?? status;
}

export function enquiryChannelLabel(locale: Locale, channel: string): string {
  return channelLabels[locale][channel] ?? channel;
}

export function admissionStateLabel(locale: Locale, state: string): string {
  return applicationStateLabels[locale][state] ?? state;
}
