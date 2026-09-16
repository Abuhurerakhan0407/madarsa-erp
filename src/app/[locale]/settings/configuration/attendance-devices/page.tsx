import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendanceDeviceCenterView } from "@/components/attendance-device-center";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/i18n/config";
import { getAttendanceDeviceCenter } from "@/lib/attendance/device-bridge";

const copy = {
  en: {
    kicker: "Institution Configuration",
    title: "Attendance & Biometric Devices",
    body: "Configure biometric attendance terminals, mappings, credential rotation and ingest diagnostics here. Daily attendance stays focused on people and attendance outcomes.",
    back: "Back to Institution Configuration",
    register: "Register device",
    deviceKey: "External device key",
    deviceLabel: "Device label",
    modality: "Modality",
    biometric: "Biometric",
    vendor: "Vendor",
    model: "Model",
    create: "Create device",
    creating: "Creating…",
    rotate: "Rotate token",
    rotating: "Rotating…",
    tokenTitle: "Device ingest token",
    tokenWarning: "Copy this token now. Only its hash is stored, so the full token will not be shown again.",
    mappings: "Device user mappings",
    externalSubject: "Device user ID",
    subjectType: "Subject type",
    subject: "Student / employee",
    map: "Save mapping",
    mapping: "Saving mapping…",
    students: "Students",
    staff: "Staff",
    events: "Recent device events",
    apply: "Apply attendance",
    applying: "Applying…",
    unmapped: "Unmapped device user",
    noEvents: "No biometric device events received yet.",
    noDevices: "No biometric attendance devices registered yet.",
    configured: "Configured biometric devices",
    lastSeen: "Last seen",
    status: "Status",
    active: "Active",
    disabled: "Disabled",
    received: "Received",
    applied: "Applied",
    failed: "Failed",
    presence: "Presence",
    checkIn: "Check in",
    checkOut: "Check out",
    error: "Unable to update the biometric device bridge."
  },
  ur: {
    kicker: "ادارہ کنفیگریشن",
    title: "حاضری اور بایومیٹرک ڈیوائسز",
    body: "بایومیٹرک حاضری ٹرمینلز، میپنگ، کریڈینشل روٹیشن اور ان جیسٹ ڈائیگناسٹکس یہاں کنفیگر کریں۔ روزانہ حاضری لوگوں اور حاضری کے نتائج پر مرکوز رہے گی۔",
    back: "ادارہ کنفیگریشن پر واپس",
    register: "ڈیوائس رجسٹر کریں",
    deviceKey: "بیرونی ڈیوائس کلید",
    deviceLabel: "ڈیوائس نام",
    modality: "قسم",
    biometric: "بایومیٹرک",
    vendor: "وینڈر",
    model: "ماڈل",
    create: "ڈیوائس بنائیں",
    creating: "ڈیوائس بن رہی ہے…",
    rotate: "ٹوکن تبدیل کریں",
    rotating: "ٹوکن تبدیل ہو رہا ہے…",
    tokenTitle: "ڈیوائس ان جیسٹ ٹوکن",
    tokenWarning: "یہ ٹوکن ابھی کاپی کریں۔ صرف اس کا ہیش محفوظ ہوگا، مکمل ٹوکن دوبارہ نہیں دکھایا جائے گا۔",
    mappings: "ڈیوائس یوزر میپنگ",
    externalSubject: "ڈیوائس یوزر ID",
    subjectType: "صارف کی قسم",
    subject: "طالب علم / ملازم",
    map: "میپنگ محفوظ کریں",
    mapping: "میپنگ محفوظ ہو رہی ہے…",
    students: "طلبہ",
    staff: "ملازمین",
    events: "حالیہ ڈیوائس ایونٹس",
    apply: "حاضری لگائیں",
    applying: "حاضری لگ رہی ہے…",
    unmapped: "غیر میپ شدہ ڈیوائس یوزر",
    noEvents: "ابھی کوئی بایومیٹرک ڈیوائس ایونٹ موصول نہیں ہوا۔",
    noDevices: "ابھی کوئی بایومیٹرک حاضری ڈیوائس رجسٹر نہیں۔",
    configured: "رجسٹر شدہ بایومیٹرک ڈیوائسز",
    lastSeen: "آخری رابطہ",
    status: "حالت",
    active: "فعال",
    disabled: "غیر فعال",
    received: "موصول",
    applied: "درج شدہ",
    failed: "ناکام",
    presence: "حاضری",
    checkIn: "داخلہ",
    checkOut: "اخراج",
    error: "بایومیٹرک ڈیوائس برج اپ ڈیٹ نہیں ہو سکا۔"
  },
  ar: {
    kicker: "إعداد المؤسسة",
    title: "الحضور وأجهزة البيومتري",
    body: "اضبط أجهزة الحضور البيومترية والربط وتدوير بيانات الاعتماد وتشخيص الاستقبال هنا. تبقى شاشة الحضور اليومية مركزة على الأشخاص ونتائج الحضور.",
    back: "العودة إلى إعداد المؤسسة",
    register: "تسجيل جهاز",
    deviceKey: "مفتاح الجهاز الخارجي",
    deviceLabel: "اسم الجهاز",
    modality: "النوع",
    biometric: "بيومتري",
    vendor: "المورّد",
    model: "الطراز",
    create: "إنشاء الجهاز",
    creating: "جارٍ إنشاء الجهاز…",
    rotate: "تدوير الرمز",
    rotating: "جارٍ تدوير الرمز…",
    tokenTitle: "رمز استقبال الجهاز",
    tokenWarning: "انسخ هذا الرمز الآن. يتم تخزين تجزئته فقط ولن يظهر الرمز الكامل مرة أخرى.",
    mappings: "ربط مستخدمي الجهاز",
    externalSubject: "معرف المستخدم في الجهاز",
    subjectType: "نوع الشخص",
    subject: "الطالب / الموظف",
    map: "حفظ الربط",
    mapping: "جارٍ حفظ الربط…",
    students: "الطلاب",
    staff: "الموظفون",
    events: "أحداث الأجهزة الأخيرة",
    apply: "تطبيق الحضور",
    applying: "جارٍ تطبيق الحضور…",
    unmapped: "مستخدم جهاز غير مربوط",
    noEvents: "لم تصل أحداث من أجهزة البيومتري بعد.",
    noDevices: "لا توجد أجهزة حضور بيومترية مسجلة بعد.",
    configured: "أجهزة البيومتري المسجلة",
    lastSeen: "آخر اتصال",
    status: "الحالة",
    active: "نشط",
    disabled: "معطل",
    received: "مستلم",
    applied: "مطبق",
    failed: "فشل",
    presence: "حضور",
    checkIn: "دخول",
    checkOut: "خروج",
    error: "تعذر تحديث جسر أجهزة البيومتري."
  }
} as const;

export default async function AttendanceDevicesConfigurationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!routing.locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const text = copy[locale];
  const data = await getAttendanceDeviceCenter();

  return <>
    <section className="page-heading" data-page-section>
      <div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{text.body}</p></div>
      <Link className="secondary-button" href={`/${locale}/settings/configuration`}>{text.back}</Link>
    </section>
    <AttendanceDeviceCenterView data={data} copy={text} locale={locale} />
  </>;
}
