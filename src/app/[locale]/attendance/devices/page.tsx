import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendanceDeviceCenterView } from "@/components/attendance-device-center";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/i18n/config";
import { getAttendanceDeviceCenter } from "@/lib/attendance/device-bridge";

const copy = {
  en: { kicker: "Attendance integration", title: "Device bridge", body: "Register biometric or NFC terminals, map device user IDs, receive scans, and reconcile them into governed attendance. The ERP does not store fingerprint or face templates.", back: "Back to attendance", register: "Register device", deviceKey: "External device key", deviceLabel: "Device label", modality: "Modality", vendor: "Vendor", model: "Model", create: "Create device", rotate: "Rotate token", tokenTitle: "Device ingest token", tokenWarning: "Copy this token now. Only its hash is stored, so the full token will not be shown again.", mappings: "Device user mappings", externalSubject: "Device user ID", subjectType: "Subject type", subject: "Student / employee", map: "Save mapping", students: "Students", staff: "Staff", events: "Recent device events", apply: "Apply attendance", unmapped: "Unmapped device user", noEvents: "No device events received yet.", noDevices: "No attendance devices registered yet.", configured: "Configured devices", lastSeen: "Last seen", status: "Status", error: "Unable to update device bridge." },
  ur: { kicker: "حاضری انضمام", title: "ڈیوائس برج", body: "بایومیٹرک یا NFC ٹرمینل رجسٹر کریں، ڈیوائس یوزر IDs میپ کریں، اسکین وصول کریں اور انہیں باقاعدہ حاضری میں شامل کریں۔ ERP فنگرپرنٹ یا چہرے کے ٹیمپلیٹس محفوظ نہیں کرتا۔", back: "حاضری پر واپس", register: "ڈیوائس رجسٹر کریں", deviceKey: "بیرونی ڈیوائس کلید", deviceLabel: "ڈیوائس نام", modality: "قسم", vendor: "وینڈر", model: "ماڈل", create: "ڈیوائس بنائیں", rotate: "ٹوکن تبدیل کریں", tokenTitle: "ڈیوائس ان جیسٹ ٹوکن", tokenWarning: "یہ ٹوکن ابھی کاپی کریں۔ صرف اس کا ہیش محفوظ ہوگا، مکمل ٹوکن دوبارہ نہیں دکھایا جائے گا۔", mappings: "ڈیوائس یوزر میپنگ", externalSubject: "ڈیوائس یوزر ID", subjectType: "صارف کی قسم", subject: "طالب علم / ملازم", map: "میپنگ محفوظ کریں", students: "طلبہ", staff: "ملازمین", events: "حالیہ ڈیوائس ایونٹس", apply: "حاضری لگائیں", unmapped: "غیر میپ شدہ ڈیوائس یوزر", noEvents: "ابھی کوئی ڈیوائس ایونٹ موصول نہیں ہوا۔", noDevices: "ابھی کوئی حاضری ڈیوائس رجسٹر نہیں۔", configured: "رجسٹر شدہ ڈیوائسز", lastSeen: "آخری رابطہ", status: "حالت", error: "ڈیوائس برج اپ ڈیٹ نہیں ہو سکا۔" },
  ar: { kicker: "تكامل الحضور", title: "جسر الأجهزة", body: "سجّل أجهزة البصمة أو NFC، واربط معرفات المستخدمين، واستقبل عمليات المسح ثم راجعها داخل نظام الحضور المحكوم. لا يخزن النظام قوالب البصمة أو الوجه.", back: "العودة للحضور", register: "تسجيل جهاز", deviceKey: "مفتاح الجهاز الخارجي", deviceLabel: "اسم الجهاز", modality: "النوع", vendor: "المورّد", model: "الطراز", create: "إنشاء الجهاز", rotate: "تدوير الرمز", tokenTitle: "رمز استقبال الجهاز", tokenWarning: "انسخ هذا الرمز الآن. يتم تخزين تجزئته فقط ولن يظهر الرمز الكامل مرة أخرى.", mappings: "ربط مستخدمي الجهاز", externalSubject: "معرف المستخدم في الجهاز", subjectType: "نوع الشخص", subject: "الطالب / الموظف", map: "حفظ الربط", students: "الطلاب", staff: "الموظفون", events: "أحداث الأجهزة الأخيرة", apply: "تطبيق الحضور", unmapped: "مستخدم جهاز غير مربوط", noEvents: "لم تصل أحداث من الأجهزة بعد.", noDevices: "لا توجد أجهزة حضور مسجلة بعد.", configured: "الأجهزة المسجلة", lastSeen: "آخر اتصال", status: "الحالة", error: "تعذر تحديث جسر الأجهزة." }
} as const;

export default async function AttendanceDevicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!routing.locales.includes(rawLocale as Locale)) notFound();
  const locale = rawLocale as Locale;
  const text = copy[locale];
  const data = await getAttendanceDeviceCenter();
  return <>
    <section className="page-heading" data-page-section><div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{text.body}</p></div><Link className="secondary-button" href={`/${locale}/attendance`}>{text.back}</Link></section>
    <AttendanceDeviceCenterView data={data} copy={text} />
  </>;
}
