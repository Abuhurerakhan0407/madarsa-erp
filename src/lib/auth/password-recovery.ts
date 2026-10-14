import type { SupportedLocale } from "@/lib/i18n/config";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPassword(value: string): boolean {
  return (
    value.length >= PASSWORD_MIN_LENGTH &&
    value.length <= PASSWORD_MAX_LENGTH &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

export const recoveryCopy = {
  en: {
    productLine: "Hifz • Arabic • Residential Hostel",
    connected: "One calm workspace for the madrasa",
    presentationTitle: "Jamia Islamia Uloomul Quraan",
    presentationBody:
      "Admissions, Talaba, attendance, Hifz, Ustadhs, hostel and Guardian Portal in one clear workspace.",
    secure: "Secure Jamia access",
    email: "Email address",
    forgotTitle: "Reset your password",
    forgotBody: "Enter your email address to receive a secure link to reset your password.",
    forgotSubmit: "Send recovery link",
    forgotSubmitting: "Sending recovery link…",
    forgotSuccess:
      "If an account exists for this email address, a password recovery link has been sent. Please check your inbox and spam folder.",
    backToSignIn: "Back to sign in",
    resetTitle: "Set new password",
    resetBody: "Choose a new strong password for your institution account.",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    resetSubmit: "Update password",
    resetSubmitting: "Updating password…",
    resetSuccess:
      "Your password has been reset successfully. You may now continue to your workspace.",
    continueToApp: "Continue to workspace",
    passwordsMismatch: "Passwords do not match.",
    passwordRequirements:
      "Use 12–128 characters with uppercase, lowercase, number, and symbol.",
    emailRequired: "Enter a valid email address.",
    linkExpiredTitle: "Link expired or invalid",
    linkExpiredBody:
      "This password recovery link is invalid or has already expired. Please request a new recovery link.",
    requestNewLink: "Request new recovery link",
    rateLimited: "Too many attempts. Please wait a moment and try again.",
    genericError: "Unable to complete request. Please try again.",
    language: "Language"
  },
  ur: {
    productLine: "حفظ • عربی • رہائشی ہاسٹل",
    connected: "مدرسے کے لیے ایک سادہ ورک اسپیس",
    presentationTitle: "جامعہ اسلامیہ علوم القرآن",
    presentationBody:
      "داخلہ، طلبہ، حاضری، حفظ، اساتذہ، ہاسٹل اور گارڈین پورٹل ایک ہی واضح ورک اسپیس میں۔",
    secure: "جامعہ کی محفوظ رسائی",
    email: "ای میل",
    forgotTitle: "اپنا پاس ورڈ ری سیٹ کریں",
    forgotBody: "محفوظ پاس ورڈ ری سیٹ لنک حاصل کرنے کے لیے اپنا ای میل درج کریں۔",
    forgotSubmit: "ریکوری لنک بھیجیں",
    forgotSubmitting: "ریکوری لنک بھیجا جا رہا ہے…",
    forgotSuccess:
      "اگر اس ای میل کے لیے کوئی اکاؤنٹ موجود ہے تو پاس ورڈ ری سیٹ کا لنک بھیج دیا گیا ہے۔ براہ کرم اپنا ان باکس اور اسپام چیک کریں۔",
    backToSignIn: "سائن اِن پر واپس جائیں",
    resetTitle: "نیا پاس ورڈ درج کریں",
    resetBody: "اپنے ادارے کے اکاؤنٹ کے لیے ایک نیا مضبوط پاس ورڈ منتخب کریں۔",
    newPassword: "نیا پاس ورڈ",
    confirmPassword: "نئے پاس ورڈ کی تصدیق",
    resetSubmit: "پاس ورڈ تبدیل کریں",
    resetSubmitting: "پاس ورڈ تبدیل ہو رہا ہے…",
    resetSuccess:
      "آپ کا پاس ورڈ کامیابی سے تبدیل ہو گیا ہے۔ اب آپ ورک اسپیس تک رسائی حاصل کر سکتے ہیں۔",
    continueToApp: "ورک اسپیس پر جائیں",
    passwordsMismatch: "دونوں پاس ورڈ یکساں نہیں ہیں۔",
    passwordRequirements:
      "پاس ورڈ 12 سے 128 حروف کا ہو اور اس میں بڑا حرف، چھوٹا حرف، نمبر اور علامت شامل ہو۔",
    emailRequired: "درست ای میل درج کریں۔",
    linkExpiredTitle: "لنک کی میعاد ختم یا غلط ہے",
    linkExpiredBody:
      "پاس ورڈ ریکوری کا یہ لنک غلط ہے یا اس کی میعاد ختم ہو چکی ہے۔ براہ کرم نیا ریکوری لنک حاصل کریں۔",
    requestNewLink: "نیا ریکوری لنک حاصل کریں",
    rateLimited: "بہت زیادہ کوششیں ہوئیں۔ کچھ دیر بعد دوبارہ کوشش کریں۔",
    genericError: "درخواست مکمل نہیں ہو سکی۔ دوبارہ کوشش کریں۔",
    language: "زبان"
  }
} as const;

export function getRecoveryErrorMessage(message: string, locale: SupportedLocale): string {
  const text = recoveryCopy[locale];
  const normalized = message.toLowerCase();
  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("email rate")
  ) {
    return text.rateLimited;
  }
  if (
    normalized.includes("expired") ||
    normalized.includes("invalid") ||
    normalized.includes("otp") ||
    normalized.includes("token")
  ) {
    return text.linkExpiredBody;
  }
  return message.trim() || text.genericError;
}
