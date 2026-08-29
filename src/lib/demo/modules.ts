import type { Locale } from "@/lib/i18n/config";

export type DemoModuleId =
  | "admissions"
  | "students"
  | "attendance"
  | "quran"
  | "fees"
  | "exams"
  | "portals"
  | "donations"
  | "hostel"
  | "staff"
  | "library"
  | "certificates"
  | "reports"
  | "whatsapp"
  | "ai"
  | "branches"
  | "configuration";

export type LocalizedText = Record<Locale, string>;

export type DemoMetric = {
  label: LocalizedText;
  value: string;
  note?: LocalizedText;
};

export type DemoTable = {
  columns: LocalizedText[];
  rows: string[][];
};

export type DemoModule = {
  id: DemoModuleId;
  code: string;
  title: LocalizedText;
  description: LocalizedText;
  metrics: DemoMetric[];
  workflow: LocalizedText[];
  features: LocalizedText[];
  table: DemoTable;
  liveHref?: (locale: Locale) => string;
  liveLabel?: LocalizedText;
};

const l = (en: string, ur: string, ar: string): LocalizedText => ({ en, ur, ar });

const metric = (
  label: LocalizedText,
  value: string,
  note?: LocalizedText
): DemoMetric => ({ label, value, note });

const table = (columns: LocalizedText[], rows: string[][]): DemoTable => ({
  columns,
  rows
});

export function localize(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text.en;
}

export const demoUiCopy = {
  demoData: l("Scripted demo data", "اسکرپٹڈ ڈیمو ڈیٹا", "بيانات تجريبية"),
  scenario: l("4,000-student institution scenario", "4,000 طلبہ کے ادارے کا منظرنامہ", "سيناريو مؤسسة تضم 4,000 طالب"),
  workflow: l("How this module works", "یہ ماڈیول کیسے کام کرتا ہے", "كيف تعمل هذه الوحدة"),
  activity: l("Sample operational activity", "نمونہ عملی سرگرمی", "نشاط تشغيلي تجريبي"),
  capabilities: l("Included capabilities", "شامل صلاحیتیں", "القدرات المشمولة"),
  liveSample: l("Open live working sample", "حقیقی ورکنگ نمونہ کھولیں", "فتح النموذج العملي"),
  backToModules: l("All ERP modules", "تمام ERP ماڈیولز", "جميع وحدات ERP"),
  moduleHubTitle: l("Complete Madrasa ERP demo", "مکمل مدرسہ ERP ڈیمو", "عرض ERP متكامل للمدرسة"),
  moduleHubBody: l(
    "A presentation-ready view of the full product vision. Admissions and student conversion have live working flows; the remaining modules use realistic fictional data so a client can understand the complete system before every backend workflow is finished.",
    "مکمل پروڈکٹ وژن کا پریزنٹیشن کے لیے تیار منظر۔ داخلہ اور طالب علم کنورژن کے حقیقی ورکنگ فلو موجود ہیں، جبکہ باقی ماڈیولز حقیقت پسندانہ فرضی ڈیٹا کے ساتھ مکمل نظام دکھاتے ہیں۔",
    "عرض جاهز لتقديم رؤية المنتج كاملة. مسارات القبول وتحويل الطالب تعمل فعلياً، بينما تستخدم الوحدات الأخرى بيانات واقعية افتراضية لشرح النظام الكامل."
  )
};

export const demoModules: DemoModule[] = [
  {
    id: "admissions",
    code: "AD",
    title: l("Admissions & Enquiries", "داخلہ و انکوائریز", "القبول والاستفسارات"),
    description: l(
      "Lead capture, application intake, follow-ups, review, decision, waitlist and admission-to-student conversion.",
      "لیڈ کیپچر، درخواست، فالو اپ، ریویو، فیصلہ، ویٹ لسٹ اور داخلہ سے طالب علم کنورژن۔",
      "التقاط الاستفسارات وطلبات القبول والمتابعة والمراجعة والقرار وقائمة الانتظار وتحويل المقبول إلى طالب."
    ),
    metrics: [
      metric(l("Open enquiries", "اوپن انکوائریز", "الاستفسارات المفتوحة"), "236"),
      metric(l("Applications", "درخواستیں", "الطلبات"), "96"),
      metric(l("Awaiting review", "ریویو کے منتظر", "بانتظار المراجعة"), "38"),
      metric(l("Admitted this month", "اس ماہ داخل", "المقبولون هذا الشهر"), "27")
    ],
    workflow: [
      l("Enquiry captured", "انکوائری درج", "تسجيل الاستفسار"),
      l("Application submitted", "درخواست جمع", "تقديم الطلب"),
      l("Review & decision", "ریویو اور فیصلہ", "المراجعة والقرار"),
      l("Student record created", "طالب علم ریکارڈ بنا", "إنشاء سجل الطالب")
    ],
    features: [
      l("Public multilingual admission form", "کثیر لسانی پبلک داخلہ فارم", "نموذج قبول عام متعدد اللغات"),
      l("Enquiry pipeline and follow-up reminders", "انکوائری پائپ لائن اور فالو اپ ریمائنڈرز", "مسار الاستفسارات وتذكيرات المتابعة"),
      l("Document checklist, review and decision trail", "دستاویز چیک لسٹ، ریویو اور فیصلہ ریکارڈ", "قائمة المستندات وسجل المراجعة والقرار"),
      l("Waitlist and seat-capacity handling", "ویٹ لسٹ اور نشست کی گنجائش", "قائمة الانتظار وإدارة السعة"),
      l("Governed student-number creation", "منظم طالب علم نمبر", "إنشاء رقم طالب محكوم")
    ],
    table: table(
      [l("Applicant", "درخواست گزار", "المتقدم"), l("Program", "پروگرام", "البرنامج"), l("Stage", "مرحلہ", "المرحلة"), l("Next action", "اگلا قدم", "الإجراء التالي")],
      [
        ["Zaid Ansari", "Dars-e-Nizami", "Review", "Document check"],
        ["Ayaan Siddiqui", "Hifz", "Accepted", "Student conversion"],
        ["Maryam Khan", "Nazra", "Application", "Guardian call"],
        ["Hamza Qureshi", "Qaida", "Enquiry", "Send application"]
      ]
    ),
    liveHref: (locale) => `/${locale}/admissions`,
    liveLabel: l("Open live admissions workflow", "حقیقی داخلہ ورک فلو کھولیں", "فتح مسار القبول الفعلي")
  },
  {
    id: "students",
    code: "ST",
    title: l("Student Information System", "اسٹوڈنٹ انفارمیشن سسٹم", "نظام معلومات الطلاب"),
    description: l(
      "One governed student record across programs, branches, guardians, documents, enrolments and academic history.",
      "پروگرام، شاخ، سرپرست، دستاویزات، انرولمنٹ اور تعلیمی تاریخ کے لیے ایک منظم طالب علم ریکارڈ۔",
      "سجل طالب موحد للفروع والبرامج وأولياء الأمور والمستندات والتسجيل والتاريخ الأكاديمي."
    ),
    metrics: [
      metric(l("Active students", "فعال طلبہ", "الطلاب النشطون"), "4,000"),
      metric(l("Guardians", "سرپرست", "أولياء الأمور"), "3,180"),
      metric(l("Academic groups", "تعلیمی گروپس", "المجموعات الأكاديمية"), "128"),
      metric(l("Programs", "پروگرامز", "البرامج"), "18")
    ],
    workflow: [
      l("Create profile", "پروفائل بنائیں", "إنشاء الملف"),
      l("Link guardians", "سرپرست لنک کریں", "ربط ولي الأمر"),
      l("Assign program & group", "پروگرام و گروپ دیں", "تعيين البرنامج والمجموعة"),
      l("Track history", "تاریخ محفوظ کریں", "تتبع السجل")
    ],
    features: [
      l("Student profile, ID and admission history", "طالب علم پروفائل، ID اور داخلہ تاریخ", "ملف الطالب والهوية وتاريخ القبول"),
      l("Guardian relationships and pickup permissions", "سرپرست تعلقات اور پک اپ اجازت", "علاقات ولي الأمر وصلاحيات الاستلام"),
      l("Program, level, group and concurrent enrolment", "پروگرام، لیول، گروپ اور متعدد انرولمنٹ", "البرنامج والمستوى والمجموعة والتسجيل المتزامن"),
      l("Custom fields and document vault", "کسٹم فیلڈز اور دستاویز والٹ", "حقول مخصصة وخزنة مستندات"),
      l("Transfer, withdrawal and alumni history", "ٹرانسفر، ودڈراول اور سابق طلبہ تاریخ", "سجل النقل والانسحاب والخريجين")
    ],
    table: table(
      [l("Student", "طالب علم", "الطالب"), l("Program", "پروگرام", "البرنامج"), l("Group", "گروپ", "المجموعة"), l("Status", "حالت", "الحالة")],
      [
        ["Ayaan Siddiqui", "Hifz", "Hifz-04", "Active"],
        ["Zaid Ansari", "Dars-e-Nizami", "Aalim-02", "Active"],
        ["Maryam Khan", "Nazra", "Nazra-07", "Active"],
        ["Hamza Qureshi", "Qaida", "Qaida-05", "Active"]
      ]
    ),
    liveHref: (locale) => `/${locale}/people-academics`,
    liveLabel: l("Open live student structure", "حقیقی طالب علم اسٹرکچر کھولیں", "فتح هيكل الطلاب الفعلي")
  },
  {
    id: "attendance",
    code: "AT",
    title: l("Attendance & Biometrics", "حاضری و بایومیٹرکس", "الحضور والقياسات الحيوية"),
    description: l(
      "Student and staff attendance with manual, NFC and biometric capture plus instant absence alerts.",
      "طلبہ اور عملہ حاضری، مینوئل، NFC اور بایومیٹرک کیپچر کے ساتھ فوری غیر حاضری الرٹس۔",
      "حضور الطلاب والموظفين يدوياً وعبر NFC والأجهزة الحيوية مع تنبيهات غياب فورية."
    ),
    metrics: [
      metric(l("Present today", "آج حاضر", "الحاضرون اليوم"), "3,784"),
      metric(l("Attendance rate", "حاضری شرح", "نسبة الحضور"), "94.6%"),
      metric(l("Staff present", "عملہ حاضر", "الموظفون الحاضرون"), "176/182"),
      metric(l("Devices online", "آن لائن ڈیوائسز", "الأجهزة المتصلة"), "8/8")
    ],
    workflow: [
      l("Capture entry", "انٹری کیپچر", "تسجيل الدخول"),
      l("Match student/staff", "طالب علم/عملہ میچ", "مطابقة الطالب/الموظف"),
      l("Apply attendance rule", "حاضری رول لگائیں", "تطبيق قاعدة الحضور"),
      l("Send parent alert", "والدین الرٹ بھیجیں", "إرسال تنبيه لولي الأمر")
    ],
    features: [
      l("Daily student and teacher attendance", "روزانہ طالب علم و استاد حاضری", "حضور يومي للطلاب والمعلمين"),
      l("NFC, biometric and manual attendance", "NFC، بایومیٹرک اور مینوئل حاضری", "حضور NFC والبيومتري واليدوي"),
      l("Late, excused, half-day and correction workflow", "لیٹ، اجازت، ہاف ڈے اور تصحیح ورک فلو", "تأخر وعذر ونصف يوم ومسار تصحيح"),
      l("Class, Salah and hostel attendance views", "کلاس، نماز اور ہاسٹل حاضری", "حضور الصف والصلاة والسكن"),
      l("WhatsApp absence notifications", "واٹس ایپ غیر حاضری نوٹیفکیشن", "إشعارات غياب عبر واتساب")
    ],
    table: table(
      [l("Group", "گروپ", "المجموعة"), l("Present", "حاضر", "حاضر"), l("Absent", "غائب", "غائب"), l("Rate", "شرح", "النسبة")],
      [
        ["Hifz-04", "34", "2", "94%"],
        ["Aalim-02", "41", "1", "98%"],
        ["Nazra-07", "38", "3", "93%"],
        ["Qaida-05", "29", "2", "94%"]
      ]
    )
  },
  {
    id: "quran",
    code: "QH",
    title: l("Qur'an, Hifz, Nazra & Qaida", "قرآن، حفظ، ناظرہ و قاعدہ", "القرآن والحفظ والنظرة والقاعدة"),
    description: l(
      "Purpose-built Qur'an learning records for Sabaq, Sabqi, Manzil, Nazra, Qaida, Tajweed and Dars-e-Nizami progress.",
      "سبق، سبقی، منزل، ناظرہ، قاعدہ، تجوید اور درس نظامی کی پیش رفت کے لیے خصوصی قرآن ریکارڈ۔",
      "سجلات متخصصة للسبق والسبقي والمنزل والنظرة والقاعدة والتجويد وتقدم الدرس النظامي."
    ),
    metrics: [
      metric(l("Hifz students", "حفظ طلبہ", "طلاب الحفظ"), "684"),
      metric(l("Nazra students", "ناظرہ طلبہ", "طلاب النظرة"), "1,146"),
      metric(l("Qaida students", "قاعدہ طلبہ", "طلاب القاعدة"), "732"),
      metric(l("Revision due", "ریویژن واجب", "مراجعة مستحقة"), "47")
    ],
    workflow: [
      l("Log today's Sabaq", "آج کا سبق درج", "تسجيل سبق اليوم"),
      l("Record Sabqi", "سبقی درج", "تسجيل السبقي"),
      l("Review Manzil", "منزل ریویو", "مراجعة المنزل"),
      l("Flag weak areas", "کمزور حصے نشان زد", "تحديد المواضع الضعيفة")
    ],
    features: [
      l("Sabaq, Sabqi and Manzil tracking", "سبق، سبقی اور منزل ٹریکنگ", "تتبع السبق والسبقي والمنزل"),
      l("Surah, ayah, page and para-level progress", "سورہ، آیت، صفحہ اور پارہ پیش رفت", "تقدم حسب السورة والآية والصفحة والجزء"),
      l("Nazra, Qaida and Tajweed assessments", "ناظرہ، قاعدہ اور تجوید اسیسمنٹ", "تقييمات النظرة والقاعدة والتجويد"),
      l("Hifz milestones, tests and weak-para flags", "حفظ سنگ میل، ٹیسٹ اور کمزور پارہ", "مراحل الحفظ والاختبارات وتنبيهات الأجزاء الضعيفة"),
      l("Parent-visible Qur'an progress", "والدین کو قرآن پیش رفت", "تقدم القرآن ظاهر لولي الأمر")
    ],
    table: table(
      [l("Student", "طالب علم", "الطالب"), l("Sabaq", "سبق", "السبق"), l("Sabqi", "سبقی", "السبقي"), l("Manzil", "منزل", "المنزل")],
      [
        ["Ayaan Siddiqui", "Juz 14 · p.282", "Juz 13", "Juz 8"],
        ["Hamza Farooqi", "Juz 21 · p.418", "Juz 20", "Juz 12"],
        ["Yusuf Shaikh", "Juz 7 · p.141", "Juz 6", "Juz 3"],
        ["Rayyan Khan", "Juz 29 · p.574", "Juz 28", "Juz 20"]
      ]
    )
  },
  {
    id: "fees",
    code: "FA",
    title: l("Fees & Accounting", "فیس و اکاؤنٹنگ", "الرسوم والمحاسبة"),
    description: l(
      "Fee plans, invoices, concessions, receipts, dues, online collection and double-entry institutional accounting.",
      "فیس پلان، انوائس، رعایت، رسید، بقایا، آن لائن وصولی اور ڈبل انٹری اکاؤنٹنگ۔",
      "خطط الرسوم والفواتير والخصومات والإيصالات والمستحقات والتحصيل الإلكتروني والمحاسبة المزدوجة."
    ),
    metrics: [
      metric(l("Collected this month", "اس ماہ وصول", "المحصل هذا الشهر"), "₹18.6L"),
      metric(l("Outstanding", "بقایا", "المستحق"), "₹3.2L"),
      metric(l("Collection rate", "وصولی شرح", "نسبة التحصيل"), "85.3%"),
      metric(l("Receipts issued", "رسیدیں جاری", "الإيصالات الصادرة"), "1,842")
    ],
    workflow: [
      l("Assign fee plan", "فیس پلان دیں", "تعيين خطة الرسوم"),
      l("Generate invoice", "انوائس بنائیں", "إنشاء فاتورة"),
      l("Collect / reconcile", "وصول / ریکنسائل", "التحصيل / المطابقة"),
      l("Post to ledger", "لیجر میں پوسٹ", "الترحيل إلى الدفتر")
    ],
    features: [
      l("Program-wise fee structures and instalments", "پروگرام کے مطابق فیس اور اقساط", "هياكل رسوم وأقساط حسب البرنامج"),
      l("Sibling discounts, scholarships and concessions", "بہن بھائی رعایت، اسکالرشپ اور کنسیشن", "خصومات الإخوة والمنح"),
      l("Cash, UPI, bank and online payment records", "کیش، UPI، بینک اور آن لائن ادائیگی", "سجلات النقد وUPI والبنك والدفع الإلكتروني"),
      l("Automatic dues and WhatsApp reminders", "خودکار بقایا اور واٹس ایپ ریمائنڈر", "مستحقات وتذكيرات واتساب تلقائية"),
      l("Double-entry accounts, vouchers and audit trail", "ڈبل انٹری اکاؤنٹس، واؤچر اور آڈٹ ٹریل", "محاسبة مزدوجة وسندات وسجل تدقيق")
    ],
    table: table(
      [l("Fee head", "فیس ہیڈ", "بند الرسوم"), l("Billed", "بل", "المفوتر"), l("Collected", "وصول", "المحصل"), l("Due", "بقایا", "المستحق")],
      [
        ["Tuition", "₹12.8L", "₹11.4L", "₹1.4L"],
        ["Hostel", "₹5.2L", "₹4.3L", "₹0.9L"],
        ["Books", "₹1.7L", "₹1.5L", "₹0.2L"],
        ["Exam", "₹1.1L", "₹0.9L", "₹0.2L"]
      ]
    )
  },
  {
    id: "exams",
    code: "EX",
    title: l("Exams, Results & Report Cards", "امتحانات، نتائج و رپورٹ کارڈ", "الاختبارات والنتائج وكشوف الدرجات"),
    description: l(
      "Exam planning, marks entry, configurable grading, moderation, result publishing and multilingual report cards.",
      "امتحان پلاننگ، نمبر اندراج، کسٹم گریڈنگ، موڈریشن، نتائج اور کثیر لسانی رپورٹ کارڈ۔",
      "تخطيط الاختبارات وإدخال الدرجات والتقييم القابل للتخصيص والمراجعة ونشر النتائج وكشوف متعددة اللغات."
    ),
    metrics: [
      metric(l("Exam groups", "امتحانی گروپس", "مجموعات الاختبار"), "12"),
      metric(l("Results entered", "نتائج درج", "النتائج المدخلة"), "3,648"),
      metric(l("Published", "شائع", "المنشور"), "3,211"),
      metric(l("Pass rate", "کامیابی شرح", "نسبة النجاح"), "91.4%")
    ],
    workflow: [
      l("Create exam", "امتحان بنائیں", "إنشاء الاختبار"),
      l("Enter / import marks", "نمبر درج / امپورٹ", "إدخال / استيراد الدرجات"),
      l("Moderate & lock", "موڈریٹ اور لاک", "المراجعة والإقفال"),
      l("Publish report cards", "رپورٹ کارڈ جاری", "نشر كشوف النتائج")
    ],
    features: [
      l("Custom subjects, papers and grading scales", "کسٹم مضامین، پیپر اور گریڈنگ", "مواد وأوراق ومقاييس تقييم مخصصة"),
      l("Written, oral, Hifz and Tajweed assessments", "تحریری، زبانی، حفظ اور تجوید اسیسمنٹ", "تقييمات تحريرية وشفوية وحفظ وتجويد"),
      l("Marks import, moderation and locking", "نمبر امپورٹ، موڈریشن اور لاک", "استيراد الدرجات والمراجعة والإقفال"),
      l("Multilingual report cards and rank rules", "کثیر لسانی رپورٹ کارڈ اور رینک رولز", "كشوف متعددة اللغات وقواعد الترتيب"),
      l("Parent portal and WhatsApp result alerts", "پورٹل اور واٹس ایپ رزلٹ الرٹس", "تنبيهات النتائج عبر البوابة وواتساب")
    ],
    table: table(
      [l("Exam", "امتحان", "الاختبار"), l("Program", "پروگرام", "البرنامج"), l("Entered", "درج", "مدخل"), l("Status", "حالت", "الحالة")],
      [
        ["Term 1", "Dars-e-Nizami", "1,204/1,260", "Moderation"],
        ["Hifz Monthly", "Hifz", "648/684", "Publishing"],
        ["Nazra Assessment", "Nazra", "1,102/1,146", "Open"],
        ["Qaida Level Test", "Qaida", "694/732", "Open"]
      ]
    )
  },
  {
    id: "portals",
    code: "PO",
    title: l("Parent, Student, Teacher & Admin Portals", "والدین، طالب علم، استاد و ایڈمن پورٹلز", "بوابات ولي الأمر والطالب والمعلم والإدارة"),
    description: l(
      "Role-specific experiences that expose only the information each person is authorised to see.",
      "ہر کردار کے لیے مخصوص پورٹل جو صرف مجاز معلومات دکھائے۔",
      "تجارب مخصصة لكل دور تعرض فقط المعلومات المصرح بها."
    ),
    metrics: [
      metric(l("Parent accounts", "والدین اکاؤنٹس", "حسابات أولياء الأمور"), "2,908"),
      metric(l("Student accounts", "طالب علم اکاؤنٹس", "حسابات الطلاب"), "3,420"),
      metric(l("Teacher accounts", "استاد اکاؤنٹس", "حسابات المعلمين"), "182"),
      metric(l("Portal activity today", "آج پورٹل سرگرمی", "نشاط البوابة اليوم"), "6,214")
    ],
    workflow: [
      l("Verify relationship", "تعلق ویریفائی", "التحقق من العلاقة"),
      l("Assign role", "رول دیں", "تعيين الدور"),
      l("Apply permissions", "اجازت لگائیں", "تطبيق الصلاحيات"),
      l("Show scoped dashboard", "محدود ڈیش بورڈ", "عرض لوحة محددة")
    ],
    features: [
      l("Parent attendance, fees, Hifz and result view", "والدین کے لیے حاضری، فیس، حفظ اور نتائج", "عرض الحضور والرسوم والحفظ والنتائج لولي الأمر"),
      l("Student timetable, progress and documents", "طالب علم ٹائم ٹیبل، پیش رفت اور دستاویزات", "جدول الطالب وتقدمه ومستنداته"),
      l("Teacher classes, attendance and marks entry", "استاد کلاس، حاضری اور نمبر اندراج", "صفوف المعلم والحضور وإدخال الدرجات"),
      l("Admin approvals, finance and reporting", "ایڈمن منظوری، فنانس اور رپورٹس", "موافقات الإدارة والمالية والتقارير"),
      l("Branch and relationship-scoped access", "برانچ اور تعلق کے مطابق رسائی", "وصول مقيد بالفرع والعلاقة")
    ],
    table: table(
      [l("Portal", "پورٹل", "البوابة"), l("Active users", "فعال صارفین", "المستخدمون النشطون"), l("Top use", "اہم استعمال", "الاستخدام الأهم"), l("Health", "حالت", "الصحة")],
      [
        ["Parent", "2,908", "Attendance & fees", "Healthy"],
        ["Student", "3,420", "Progress & timetable", "Healthy"],
        ["Teacher", "182", "Attendance & marks", "Healthy"],
        ["Admin", "34", "Approvals & reports", "Healthy"]
      ]
    )
  },
  {
    id: "donations",
    code: "DN",
    title: l("Donations, Zakat & Sponsorships", "عطیات، زکوٰۃ و کفالت", "التبرعات والزكاة والكفالات"),
    description: l(
      "Fund-aware donation accounting for general sadaqah, Zakat, campaigns, donor history and student sponsorships.",
      "عام صدقہ، زکوٰۃ، مہمات، ڈونر تاریخ اور طالب علم کفالت کے لیے فنڈ بیسڈ اکاؤنٹنگ۔",
      "محاسبة تبرعات حسب الصندوق للصدقات والزكاة والحملات وسجل المتبرعين وكفالة الطلاب."
    ),
    metrics: [
      metric(l("Donations this month", "اس ماہ عطیات", "تبرعات هذا الشهر"), "₹7.4L"),
      metric(l("Zakat fund", "زکوٰۃ فنڈ", "صندوق الزكاة"), "₹3.1L"),
      metric(l("Active sponsors", "فعال کفیل", "الكفلاء النشطون"), "186"),
      metric(l("Sponsored students", "کفالت شدہ طلبہ", "الطلاب المكفولون"), "241")
    ],
    workflow: [
      l("Receive donation", "عطیہ وصول", "استلام التبرع"),
      l("Allocate fund", "فنڈ مختص", "تخصيص الصندوق"),
      l("Issue receipt", "رسید جاری", "إصدار إيصال"),
      l("Report utilisation", "استعمال رپورٹ", "تقرير الاستخدام")
    ],
    features: [
      l("Zakat, Sadaqah and unrestricted funds", "زکوٰۃ، صدقہ اور عام فنڈ", "صناديق الزكاة والصدقة وغير المقيدة"),
      l("Donor CRM and donation history", "ڈونر CRM اور عطیہ تاریخ", "إدارة المتبرعين وسجل التبرعات"),
      l("Student sponsorship plans and renewals", "طالب علم کفالت پلان اور رینیول", "خطط كفالة الطلاب وتجديدها"),
      l("Campaign targets and utilisation tracking", "مہم ہدف اور استعمال ٹریکنگ", "أهداف الحملات وتتبع الاستخدام"),
      l("Receipts, acknowledgements and audit trail", "رسید، شکریہ اور آڈٹ ٹریل", "إيصالات وشكر وسجل تدقيق")
    ],
    table: table(
      [l("Fund", "فنڈ", "الصندوق"), l("Opening", "ابتدائی", "الافتتاحي"), l("Received", "وصول", "المستلم"), l("Available", "دستیاب", "المتاح")],
      [
        ["Zakat", "₹8.8L", "₹3.1L", "₹10.2L"],
        ["Sadaqah", "₹4.2L", "₹2.2L", "₹5.1L"],
        ["Student Sponsorship", "₹6.4L", "₹1.4L", "₹6.9L"],
        ["General", "₹2.1L", "₹0.7L", "₹2.4L"]
      ]
    )
  },
  {
    id: "hostel",
    code: "HO",
    title: l("Hostel, Mess & Residential Operations", "ہاسٹل، میس و رہائشی آپریشنز", "السكن والإعاشة والعمليات الداخلية"),
    description: l(
      "Residential student allocation, rooms, mess attendance, gate passes, health notes, visitors and hostel fees.",
      "رہائشی طلبہ، کمرے، میس حاضری، گیٹ پاس، صحت نوٹس، وزیٹر اور ہاسٹل فیس۔",
      "توزيع الطلاب المقيمين والغرف وحضور الوجبات وتصاريح الخروج والملاحظات الصحية والزوار ورسوم السكن."
    ),
    metrics: [
      metric(l("Residents", "رہائشی طلبہ", "المقيمون"), "612"),
      metric(l("Occupied beds", "استعمال شدہ بیڈ", "الأسرة المشغولة"), "612/660"),
      metric(l("Meals today", "آج کھانے", "وجبات اليوم"), "1,806"),
      metric(l("Open gate passes", "اوپن گیٹ پاس", "تصاريح خروج مفتوحة"), "14")
    ],
    workflow: [
      l("Allocate room", "کمرہ مختص", "تخصيص الغرفة"),
      l("Track daily presence", "روزانہ موجودگی", "تتبع الوجود اليومي"),
      l("Manage mess & gate pass", "میس اور گیٹ پاس", "إدارة الوجبات والتصريح"),
      l("Reconcile hostel fee", "ہاسٹل فیس ریکنسائل", "مطابقة رسوم السكن")
    ],
    features: [
      l("Room, bed and warden allocation", "کمرہ، بیڈ اور وارڈن", "تخصيص الغرف والأسرة والمشرفين"),
      l("Hostel and Salah attendance", "ہاسٹل اور نماز حاضری", "حضور السكن والصلاة"),
      l("Mess roster, meals and dietary notes", "میس روسٹر، کھانے اور غذائی نوٹس", "جدول الوجبات والملاحظات الغذائية"),
      l("Gate pass, visitor and pickup approvals", "گیٹ پاس، وزیٹر اور پک اپ منظوری", "تصاريح الخروج والزوار والاستلام"),
      l("Health log and hostel fee linkage", "ہیلتھ لاگ اور ہاسٹل فیس لنک", "السجل الصحي وربط رسوم السكن")
    ],
    table: table(
      [l("Block", "بلاک", "المبنى"), l("Beds", "بیڈ", "الأسرة"), l("Occupied", "استعمال", "المشغول"), l("Warden", "وارڈن", "المشرف")],
      [
        ["A", "180", "174", "Maulana Imran"],
        ["B", "160", "149", "Maulana Yusuf"],
        ["C", "140", "132", "Maulana Salman"],
        ["D", "180", "157", "Maulana Farooq"]
      ]
    )
  },
  {
    id: "staff",
    code: "HR",
    title: l("HR, Staff & Payroll", "HR، عملہ و پے رول", "الموارد البشرية والموظفون والرواتب"),
    description: l(
      "Teacher and staff profiles, roles, attendance, workload, leave, payroll and document compliance.",
      "استاد و عملہ پروفائل، رول، حاضری، ورک لوڈ، چھٹی، پے رول اور دستاویز تعمیل۔",
      "ملفات المعلمين والموظفين والأدوار والحضور وعبء العمل والإجازات والرواتب والامتثال."
    ),
    metrics: [
      metric(l("Total staff", "کل عملہ", "إجمالي الموظفين"), "214"),
      metric(l("Teachers", "اساتذہ", "المعلمون"), "182"),
      metric(l("On leave", "چھٹی پر", "في إجازة"), "9"),
      metric(l("Payroll this month", "اس ماہ پے رول", "رواتب هذا الشهر"), "₹12.8L")
    ],
    workflow: [
      l("Create staff profile", "عملہ پروفائل", "إنشاء ملف الموظف"),
      l("Assign role & classes", "رول اور کلاس", "تعيين الدور والصفوف"),
      l("Capture attendance", "حاضری کیپچر", "تسجيل الحضور"),
      l("Run payroll", "پے رول چلائیں", "تشغيل الرواتب")
    ],
    features: [
      l("Teacher and non-teaching staff records", "استاد اور غیر تدریسی عملہ ریکارڈ", "سجلات المعلمين وغير التدريسيين"),
      l("Roles, permissions and branch assignments", "رول، اجازت اور برانچ", "الأدوار والصلاحيات وتعيين الفروع"),
      l("Biometric-linked staff attendance", "بایومیٹرک لنکڈ عملہ حاضری", "حضور موظفين مرتبط بالبيومتري"),
      l("Leave, workload and timetable allocation", "چھٹی، ورک لوڈ اور ٹائم ٹیبل", "الإجازات وعبء العمل والجدول"),
      l("Payroll, payslips and salary history", "پے رول، پے سلپ اور تنخواہ تاریخ", "الرواتب وكشوفها وسجلها")
    ],
    table: table(
      [l("Role", "رول", "الدور"), l("Staff", "عملہ", "الموظفون"), l("Present", "حاضر", "حاضر"), l("Load", "لوڈ", "العبء")],
      [
        ["Hifz Teachers", "42", "41", "88%"],
        ["Dars-e-Nizami", "68", "65", "91%"],
        ["Nazra / Qaida", "54", "52", "86%"],
        ["Administration", "50", "47", "79%"]
      ]
    )
  },
  {
    id: "library",
    code: "LB",
    title: l("Library", "لائبریری", "المكتبة"),
    description: l(
      "Catalogue, accession, issue/return, fines, member history and stock visibility across branches.",
      "کیٹلاگ، ایکسیشن، اجراء/واپسی، جرمانہ، ممبر تاریخ اور برانچ اسٹاک۔",
      "الفهرس والتسجيل والإعارة والإرجاع والغرامات وسجل الأعضاء والمخزون عبر الفروع."
    ),
    metrics: [
      metric(l("Books", "کتب", "الكتب"), "14,820"),
      metric(l("Issued", "جاری", "المعار"), "1,204"),
      metric(l("Overdue", "اوور ڈیو", "المتأخر"), "43"),
      metric(l("Members", "ممبرز", "الأعضاء"), "2,930")
    ],
    workflow: [
      l("Catalogue item", "کتاب درج", "فهرسة المادة"),
      l("Issue to member", "ممبر کو جاری", "إعارة للعضو"),
      l("Track due date", "تاریخ واپسی", "تتبع موعد الإرجاع"),
      l("Return / fine", "واپسی / جرمانہ", "إرجاع / غرامة")
    ],
    features: [
      l("ISBN/accession and category catalogue", "ISBN/ایکسیشن اور کیٹیگری کیٹلاگ", "فهرس ISBN والتسجيل والتصنيف"),
      l("Student and staff issue/return", "طالب علم و عملہ اجراء/واپسی", "إعارة وإرجاع للطلاب والموظفين"),
      l("Overdue reminders and fine rules", "اوور ڈیو ریمائنڈر اور جرمانہ رول", "تذكيرات التأخير وقواعد الغرامة"),
      l("Branch-wise inventory", "برانچ کے مطابق اسٹاک", "مخزون حسب الفرع"),
      l("Usage and circulation reports", "استعمال اور سرکولیشن رپورٹس", "تقارير الاستخدام والتداول")
    ],
    table: table(
      [l("Category", "کیٹیگری", "التصنيف"), l("Titles", "عنوان", "العناوين"), l("Copies", "نسخ", "النسخ"), l("Issued", "جاری", "المعار")],
      [
        ["Tafsir", "486", "1,940", "212"],
        ["Hadith", "392", "1,608", "176"],
        ["Fiqh", "514", "2,216", "284"],
        ["Arabic / Urdu", "1,208", "5,614", "418"]
      ]
    )
  },
  {
    id: "certificates",
    code: "DC",
    title: l("Documents, IDs & Certificates", "دستاویزات، ID و سرٹیفکیٹس", "المستندات والهويات والشهادات"),
    description: l(
      "Template-driven IDs, admission letters, receipts, certificates and versioned student documents.",
      "ٹیمپلیٹ بیسڈ ID، داخلہ خط، رسید، سرٹیفکیٹ اور ورژن شدہ طالب علم دستاویزات۔",
      "هويات وخطابات قبول وإيصالات وشهادات مبنية على قوالب مع مستندات طلاب بإصدارات."
    ),
    metrics: [
      metric(l("Documents generated", "دستاویزات تیار", "المستندات المنشأة"), "6,482"),
      metric(l("Student IDs", "طالب علم ID", "هويات الطلاب"), "3,944"),
      metric(l("Certificates", "سرٹیفکیٹس", "الشهادات"), "728"),
      metric(l("Pending verification", "ویریفکیشن باقی", "بانتظار التحقق"), "31")
    ],
    workflow: [
      l("Choose template", "ٹیمپلیٹ منتخب", "اختيار القالب"),
      l("Merge governed data", "ڈیٹا مرج", "دمج البيانات"),
      l("Review & approve", "ریویو اور منظوری", "المراجعة والموافقة"),
      l("Generate PDF / print", "PDF / پرنٹ", "إنشاء PDF / طباعة")
    ],
    features: [
      l("Student and staff ID cards", "طالب علم اور عملہ ID کارڈ", "بطاقات هوية للطلاب والموظفين"),
      l("Admission and bonafide letters", "داخلہ اور بونافائیڈ خطوط", "خطابات القبول والإثبات"),
      l("Hifz, exam and completion certificates", "حفظ، امتحان اور تکمیل سرٹیفکیٹ", "شهادات الحفظ والاختبارات والإتمام"),
      l("Fee and donation receipts", "فیس اور عطیہ رسید", "إيصالات الرسوم والتبرعات"),
      l("Versioned private document vault", "ورژن شدہ نجی دستاویز والٹ", "خزنة مستندات خاصة بإصدارات")
    ],
    table: table(
      [l("Template", "ٹیمپلیٹ", "القالب"), l("Generated", "تیار", "تم إنشاؤه"), l("Language", "زبان", "اللغة"), l("Status", "حالت", "الحالة")],
      [
        ["Student ID", "3,944", "EN / UR", "Active"],
        ["Hifz Certificate", "284", "AR / UR", "Active"],
        ["Bonafide Letter", "612", "EN", "Active"],
        ["Donation Receipt", "1,104", "EN / UR", "Active"]
      ]
    )
  },
  {
    id: "reports",
    code: "RP",
    title: l("Reports & Management Analytics", "رپورٹس و مینجمنٹ اینالیٹکس", "التقارير وتحليلات الإدارة"),
    description: l(
      "Operational, academic and financial dashboards for owners, principals, accountants and trustees.",
      "مالک، پرنسپل، اکاؤنٹنٹ اور ٹرسٹی کے لیے آپریشنل، تعلیمی اور مالی ڈیش بورڈ۔",
      "لوحات تشغيلية وأكاديمية ومالية للمالكين والمديرين والمحاسبين والأمناء."
    ),
    metrics: [
      metric(l("Saved reports", "محفوظ رپورٹس", "التقارير المحفوظة"), "24"),
      metric(l("Scheduled exports", "شیڈول ایکسپورٹ", "التصديرات المجدولة"), "9"),
      metric(l("Dashboard viewers", "ڈیش بورڈ صارفین", "مشاهدو اللوحة"), "31"),
      metric(l("Board pack", "بورڈ پیک", "حزمة المجلس"), "Ready")
    ],
    workflow: [
      l("Choose dataset", "ڈیٹا سیٹ منتخب", "اختيار مجموعة البيانات"),
      l("Filter & compare", "فلٹر اور موازنہ", "التصفية والمقارنة"),
      l("Save dashboard", "ڈیش بورڈ محفوظ", "حفظ اللوحة"),
      l("Export / schedule", "ایکسپورٹ / شیڈول", "تصدير / جدولة")
    ],
    features: [
      l("Attendance, fee and admission dashboards", "حاضری، فیس اور داخلہ ڈیش بورڈ", "لوحات الحضور والرسوم والقبول"),
      l("Hifz and academic progress analytics", "حفظ اور تعلیمی پیش رفت اینالیٹکس", "تحليلات الحفظ والتقدم الأكاديمي"),
      l("Donation and fund utilisation reports", "عطیہ اور فنڈ استعمال رپورٹ", "تقارير التبرعات واستخدام الصناديق"),
      l("Branch and cohort comparisons", "برانچ اور گروپ موازنہ", "مقارنات الفروع والمجموعات"),
      l("PDF, Excel and scheduled reports", "PDF، Excel اور شیڈول رپورٹس", "تقارير PDF وExcel ومجدولة")
    ],
    table: table(
      [l("Report", "رپورٹ", "التقرير"), l("Audience", "صارف", "الجمهور"), l("Frequency", "فریکوئنسی", "التكرار"), l("Status", "حالت", "الحالة")],
      [
        ["Owner overview", "Trustees", "Weekly", "Scheduled"],
        ["Fee ageing", "Accounts", "Daily", "Scheduled"],
        ["Hifz progress", "Academic head", "Weekly", "Ready"],
        ["Hostel occupancy", "Warden", "Daily", "Ready"]
      ]
    )
  },
  {
    id: "whatsapp",
    code: "WA",
    title: l("WhatsApp Automation", "واٹس ایپ آٹومیشن", "أتمتة واتساب"),
    description: l(
      "Meta WhatsApp Cloud API workflows for attendance alerts, fee reminders, admissions, results and parent support.",
      "Meta WhatsApp Cloud API کے ذریعے حاضری الرٹ، فیس ریمائنڈر، داخلہ، نتائج اور والدین سپورٹ۔",
      "مسارات Meta WhatsApp Cloud API لتنبيهات الحضور وتذكير الرسوم والقبول والنتائج ودعم أولياء الأمور."
    ),
    metrics: [
      metric(l("Messages this month", "اس ماہ پیغامات", "رسائل هذا الشهر"), "12,482"),
      metric(l("Delivery rate", "ڈیلیوری شرح", "نسبة التسليم"), "98.2%"),
      metric(l("Automations", "آٹومیشنز", "الأتمتة"), "14"),
      metric(l("Parent replies", "والدین جوابات", "ردود أولياء الأمور"), "1,306")
    ],
    workflow: [
      l("Event occurs", "ایونٹ ہوتا ہے", "حدوث حدث"),
      l("Choose approved template", "منظور ٹیمپلیٹ", "اختيار قالب معتمد"),
      l("Personalise message", "پیغام ذاتی بنائیں", "تخصيص الرسالة"),
      l("Send & track response", "بھیجیں اور جواب ٹریک", "الإرسال وتتبع الرد")
    ],
    features: [
      l("Absence and late-arrival alerts", "غیر حاضری اور لیٹ الرٹس", "تنبيهات الغياب والتأخر"),
      l("Fee due and payment confirmation messages", "فیس بقایا اور ادائیگی تصدیق", "رسائل استحقاق الرسوم وتأكيد الدفع"),
      l("Admission follow-up and document reminders", "داخلہ فالو اپ اور دستاویز ریمائنڈر", "متابعة القبول وتذكير المستندات"),
      l("Exam result and announcement broadcasts", "نتائج اور اعلان براڈکاسٹ", "بث النتائج والإعلانات"),
      l("Human handoff and conversation history", "انسانی ہینڈ آف اور گفتگو تاریخ", "تحويل للموظف وسجل المحادثة")
    ],
    table: table(
      [l("Automation", "آٹومیشن", "الأتمتة"), l("Triggered", "ٹرگر", "التشغيل"), l("Delivered", "ڈیلیور", "تم التسليم"), l("Reply", "جواب", "الرد")],
      [
        ["Attendance absence", "284", "279", "42"],
        ["Fee reminder", "1,042", "1,018", "186"],
        ["Admission follow-up", "96", "94", "31"],
        ["Result published", "3,211", "3,156", "204"]
      ]
    )
  },
  {
    id: "ai",
    code: "AI",
    title: l("AI Assistant & Intelligence", "AI معاون و انٹیلیجنس", "مساعد الذكاء الاصطناعي والذكاء التشغيلي"),
    description: l(
      "A governed assistant for natural-language reporting, operational summaries, parent support drafts and Hifz insights.",
      "قدرتی زبان رپورٹس، آپریشن سمری، والدین سپورٹ ڈرافٹ اور حفظ ان سائٹس کے لیے منظم AI معاون۔",
      "مساعد محكوم للتقارير باللغة الطبيعية والملخصات التشغيلية ومسودات دعم أولياء الأمور ورؤى الحفظ."
    ),
    metrics: [
      metric(l("Questions today", "آج سوالات", "الأسئلة اليوم"), "137"),
      metric(l("Reports drafted", "رپورٹس ڈرافٹ", "التقارير المصاغة"), "28"),
      metric(l("Cases flagged", "کیس نشان زد", "الحالات المعلّمة"), "39"),
      metric(l("Time saved", "وقت بچت", "الوقت الموفر"), "18.4h")
    ],
    workflow: [
      l("Ask in plain language", "سادہ زبان میں پوچھیں", "اسأل بلغة طبيعية"),
      l("Respect role permissions", "رول اجازت لاگو", "احترام صلاحيات الدور"),
      l("Analyse governed data", "منظم ڈیٹا تجزیہ", "تحليل البيانات المحكومة"),
      l("Show answer with sources", "سورس کے ساتھ جواب", "عرض الإجابة مع المصادر")
    ],
    features: [
      l("Ask questions across attendance, fees and admissions", "حاضری، فیس اور داخلہ پر سوال", "أسئلة عبر الحضور والرسوم والقبول"),
      l("Daily owner and principal summaries", "روزانہ مالک اور پرنسپل سمری", "ملخصات يومية للمالك والمدير"),
      l("Hifz slowdown and revision-risk insights", "حفظ سست روی اور ریویژن رسک", "رؤى بطء الحفظ ومخاطر المراجعة"),
      l("Draft parent replies and notices", "والدین جواب اور نوٹس ڈرافٹ", "صياغة ردود وإشعارات أولياء الأمور"),
      l("Permission-aware, read-only by default", "اجازت کے مطابق، ڈیفالٹ ریڈ اونلی", "واعٍ بالصلاحيات وقراءة فقط افتراضياً")
    ],
    table: table(
      [l("Insight", "ان سائٹ", "الرؤية"), l("Area", "علاقہ", "المجال"), l("Cases", "کیس", "الحالات"), l("Suggested action", "تجویز", "الإجراء المقترح")],
      [
        ["Revision risk rising", "Hifz", "16", "Review Manzil plan"],
        ["3+ fee reminders", "Fees", "11", "Call guardian"],
        ["Attendance below 80%", "Attendance", "8", "Counsellor follow-up"],
        ["Admission stalled", "Admissions", "4", "Document reminder"]
      ]
    )
  },
  {
    id: "branches",
    code: "BR",
    title: l("Multi-Branch, Roles & Permissions", "ملٹی برانچ، رولز و اجازت", "تعدد الفروع والأدوار والصلاحيات"),
    description: l(
      "Institution-wide control with branch isolation, granular RBAC, staff scope, approvals and audit history.",
      "برانچ آئسولیشن، باریک RBAC، عملہ اسکوپ، منظوری اور آڈٹ تاریخ کے ساتھ ادارہ کنٹرول۔",
      "تحكم مؤسسي مع عزل الفروع وصلاحيات دقيقة ونطاق الموظفين والموافقات وسجل التدقيق."
    ),
    metrics: [
      metric(l("Branches", "برانچز", "الفروع"), "3"),
      metric(l("Roles", "رولز", "الأدوار"), "12"),
      metric(l("Permission policies", "اجازت پالیسیاں", "سياسات الصلاحية"), "46"),
      metric(l("Audit events today", "آج آڈٹ ایونٹس", "أحداث التدقيق اليوم"), "824")
    ],
    workflow: [
      l("Create branch", "برانچ بنائیں", "إنشاء فرع"),
      l("Define role", "رول بنائیں", "تعريف الدور"),
      l("Set data scope", "ڈیٹا اسکوپ", "تحديد نطاق البيانات"),
      l("Audit every action", "ہر ایکشن آڈٹ", "تدقيق كل إجراء")
    ],
    features: [
      l("Branch-scoped student and finance data", "برانچ کے مطابق طالب علم و فنانس ڈیٹا", "بيانات طلاب ومالية حسب الفرع"),
      l("Granular role-based access control", "باریک رول بیسڈ رسائی", "تحكم دقيق قائم على الأدوار"),
      l("Maker-checker approvals for sensitive actions", "حساس کام کے لیے منظوری ورک فلو", "موافقات ثنائية للإجراءات الحساسة"),
      l("User session and audit-log history", "صارف سیشن اور آڈٹ لاگ", "سجل جلسات المستخدم والتدقيق"),
      l("Head-office cross-branch reporting", "ہیڈ آفس کراس برانچ رپورٹ", "تقارير مركزية عبر الفروع")
    ],
    table: table(
      [l("Branch", "برانچ", "الفرع"), l("Students", "طلبہ", "الطلاب"), l("Staff", "عملہ", "الموظفون"), l("Status", "حالت", "الحالة")],
      [
        ["Central Campus", "2,180", "106", "Active"],
        ["North Campus", "1,020", "58", "Active"],
        ["Residential Campus", "800", "50", "Active"]
      ]
    )
  },
  {
    id: "configuration",
    code: "CF",
    title: l("Institution Configuration", "ادارہ کنفیگریشن", "تهيئة المؤسسة"),
    description: l(
      "Configurable terminology, academic models, workflows, grading, numbering, calendars, languages and document rules.",
      "کسٹم اصطلاحات، تعلیمی ماڈل، ورک فلو، گریڈنگ، نمبرنگ، کیلنڈر، زبانیں اور دستاویز رولز۔",
      "مصطلحات ونماذج أكاديمية ومسارات عمل وتقييم وترقيم وتقويمات ولغات وقواعد مستندات قابلة للتخصيص."
    ),
    metrics: [
      metric(l("Languages", "زبانیں", "اللغات"), "3"),
      metric(l("Calendars", "کیلنڈر", "التقاويم"), "Hijri + Gregorian"),
      metric(l("Config domains", "کنفیگ ڈومین", "مجالات الإعداد"), "17"),
      metric(l("Published versions", "شائع ورژنز", "الإصدارات المنشورة"), "9")
    ],
    workflow: [
      l("Start from preset", "پری سیٹ سے شروع", "البدء من إعداد مسبق"),
      l("Customise safely", "محفوظ کسٹمائز", "تخصيص آمن"),
      l("Review impact", "اثر ریویو", "مراجعة الأثر"),
      l("Publish version", "ورژن شائع", "نشر الإصدار")
    ],
    features: [
      l("English, Urdu and Arabic with RTL/LTR", "انگریزی، اردو، عربی RTL/LTR", "الإنجليزية والأردية والعربية مع RTL/LTR"),
      l("Hijri and Gregorian calendars", "ہجری اور گریگورین کیلنڈر", "التقويم الهجري والميلادي"),
      l("Maktab, Hifz, Nazra, Qaida and Dars-e-Nizami presets", "مکتب، حفظ، ناظرہ، قاعدہ اور درس نظامی پری سیٹس", "إعدادات للمكتب والحفظ والنظرة والقاعدة والدرس النظامي"),
      l("Custom terminology, grading and workflows", "کسٹم اصطلاحات، گریڈنگ اور ورک فلو", "مصطلحات وتقييم ومسارات عمل مخصصة"),
      l("Configurable numbering and document templates", "نمبرنگ اور دستاویز ٹیمپلیٹ", "ترقيم وقوالب مستندات قابلة للتخصيص")
    ],
    table: table(
      [l("Area", "علاقہ", "المجال"), l("Current setup", "موجودہ سیٹ اپ", "الإعداد الحالي"), l("Versioned", "ورژن", "بإصدارات"), l("Status", "حالت", "الحالة")],
      [
        ["Languages", "EN · UR · AR", "Yes", "Published"],
        ["Calendar", "Hijri + Gregorian", "Yes", "Published"],
        ["Student numbering", "Branch + year + sequence", "Yes", "Published"],
        ["Admission workflow", "Enquiry → Student", "Yes", "Published"]
      ]
    ),
    liveHref: (locale) => `/${locale}/settings/configuration`,
    liveLabel: l("Open live configuration engine", "حقیقی کنفیگریشن انجن کھولیں", "فتح محرك التهيئة الفعلي")
  }
];

export function getDemoModule(id: string): DemoModule | undefined {
  return demoModules.find((module) => module.id === id);
}
