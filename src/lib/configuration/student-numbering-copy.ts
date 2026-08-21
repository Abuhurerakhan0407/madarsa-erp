import type { ConfigurationLocale } from "./model";

export const studentNumberingCopy: Record<ConfigurationLocale, {
  kicker: string;
  title: string;
  body: string;
  active: string;
  pattern: string;
  patternHelp: string;
  startValue: string;
  padding: string;
  resetPeriod: string;
  never: string;
  yearly: string;
  session: string;
  preview: string;
  publish: string;
  publishing: string;
  success: string;
  error: string;
  safety: string;
}> = {
  en: {
    kicker: "Permanent identity",
    title: "Student number sequence",
    body: "Publish the governed number rule used when an accepted applicant becomes a student.",
    active: "Active pattern",
    pattern: "Number pattern",
    patternHelp: "Use {SEQ} once. Branch-scoped numbers require {BRANCH}. Session resets require {SESSION}; yearly resets require {YYYY} or {YY}.",
    startValue: "Starting value",
    padding: "Sequence digits",
    resetPeriod: "Reset counter",
    never: "Never",
    yearly: "Every calendar year",
    session: "Every academic session",
    preview: "Example",
    publish: "Publish student numbering",
    publishing: "Publishing safely…",
    success: "Student numbering is published and ready for enrollment conversion.",
    error: "Student numbering could not be published.",
    safety: "Published definitions are immutable. Runtime counters are stored separately and reserved atomically."
  },
  ur: {
    kicker: "مستقل شناخت",
    title: "طالب علم نمبر کی ترتیب",
    body: "وہ باقاعدہ نمبر قاعدہ شائع کریں جو منظور شدہ درخواست گزار کو طالب علم بناتے وقت استعمال ہوگا۔",
    active: "فعال پیٹرن",
    pattern: "نمبر پیٹرن",
    patternHelp: "{SEQ} ایک بار استعمال کریں۔ برانچ نمبر میں {BRANCH} ضروری ہے۔ سیشن ری سیٹ کے لیے {SESSION} اور سالانہ ری سیٹ کے لیے {YYYY} یا {YY} ضروری ہے۔",
    startValue: "ابتدائی نمبر",
    padding: "ہندسوں کی تعداد",
    resetPeriod: "کاؤنٹر ری سیٹ",
    never: "کبھی نہیں",
    yearly: "ہر کیلنڈر سال",
    session: "ہر تعلیمی سیشن",
    preview: "مثال",
    publish: "طالب علم نمبر شائع کریں",
    publishing: "محفوظ طریقے سے شائع ہو رہا ہے…",
    success: "طالب علم نمبر کی ترتیب شائع ہو گئی اور داخلہ تبدیلی کے لیے تیار ہے۔",
    error: "طالب علم نمبر کی ترتیب شائع نہیں ہو سکی۔",
    safety: "شائع شدہ تعریف تبدیل نہیں ہوتی۔ چلتے کاؤنٹر الگ محفوظ ہوتے ہیں اور ایٹمی طور پر ریزرو ہوتے ہیں۔"
  },
  ar: {
    kicker: "هوية دائمة",
    title: "تسلسل رقم الطالب",
    body: "انشر قاعدة الترقيم المعتمدة التي تُستخدم عند تحويل المتقدم المقبول إلى طالب.",
    active: "النمط النشط",
    pattern: "نمط الرقم",
    patternHelp: "استخدم {SEQ} مرة واحدة. أرقام الفروع تتطلب {BRANCH}. إعادة الضبط حسب الجلسة تتطلب {SESSION}، والسنوية تتطلب {YYYY} أو {YY}.",
    startValue: "قيمة البداية",
    padding: "عدد خانات التسلسل",
    resetPeriod: "إعادة ضبط العداد",
    never: "بدون إعادة ضبط",
    yearly: "كل سنة ميلادية",
    session: "كل جلسة دراسية",
    preview: "مثال",
    publish: "نشر ترقيم الطلاب",
    publishing: "جارٍ النشر بأمان…",
    success: "تم نشر ترقيم الطلاب وأصبح جاهزًا لتحويل القبول إلى تسجيل.",
    error: "تعذر نشر ترقيم الطلاب.",
    safety: "التعريفات المنشورة غير قابلة للتعديل. تُحفظ العدادات التشغيلية منفصلة وتُحجز ذريًا."
  }
};
