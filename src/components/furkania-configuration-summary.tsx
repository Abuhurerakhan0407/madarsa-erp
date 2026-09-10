import { furkaniaProfile } from "@/lib/client-profiles/furkania";
import { getFurkaniaReadiness } from "@/lib/client-profiles/furkania-readiness";
import type { ConfigurationLocale } from "@/lib/configuration/model";

type Props = { locale: ConfigurationLocale };

const copy = {
  en: {
    kicker: "Madrasa-e-Furkania",
    title: "Client setup",
    body: "Confirmed client facts are locked here. Unknown operating rules stay editable instead of being guessed.",
    students: "Students",
    curriculum: "Curriculum",
    courses: "Courses",
    shifts: "Daily shifts",
    subjects: "Deeniyat subject groups",
    pending: "Still needs client confirmation",
    timetable: "Exact shift times are required before timetable activation."
  },
  ur: {
    kicker: "مدرسہ فرکانیہ",
    title: "کلائنٹ سیٹ اپ",
    body: "تصدیق شدہ معلومات یہاں محفوظ ہیں۔ غیر تصدیق شدہ عملی اصول اندازے سے طے نہیں کیے جاتے۔",
    students: "طلبہ",
    curriculum: "نصاب",
    courses: "کورسز",
    shifts: "روزانہ اوقات",
    subjects: "دینیات کے بنیادی مضامین",
    pending: "کلائنٹ کی تصدیق ابھی باقی",
    timetable: "ٹائم ٹیبل فعال کرنے سے پہلے ہر شفٹ کا صحیح وقت درکار ہے۔"
  },
  ar: {
    kicker: "مدرسة الفرقانية",
    title: "إعداد العميل",
    body: "تُحفظ هنا المعلومات المؤكدة فقط، وتبقى القواعد التشغيلية غير المؤكدة قابلة للضبط دون افتراضات.",
    students: "الطلاب",
    curriculum: "المنهج",
    courses: "المستويات",
    shifts: "الفترات اليومية",
    subjects: "مجموعات مواد الدينيات",
    pending: "ما زال يحتاج تأكيد العميل",
    timetable: "يلزم تحديد أوقات الفترات بدقة قبل تفعيل الجدول."
  }
} as const;

const display = {
  shifts: {
    en: ["Morning", "Midday", "Evening"],
    ur: ["صبح", "دوپہر", "شام"],
    ar: ["صباح", "ظهر", "مساء"]
  },
  subjects: {
    en: ["Qur’aan", "Hadeeth", "Aqaa’id & Masaa’il", "Islamic Upbringing", "Language"],
    ur: ["قرآن", "حدیث", "عقائد و مسائل", "اسلامی تربیت", "زبان"],
    ar: ["القرآن", "الحديث", "العقائد والمسائل", "التربية الإسلامية", "اللغة"]
  }
} as const;

export function FurkaniaConfigurationSummary({ locale }: Props) {
  const profile = furkaniaProfile;
  const readiness = getFurkaniaReadiness();
  const text = copy[locale];

  return (
    <section className="professional-card" data-page-section aria-labelledby="furkania-client-setup">
      <div className="section-heading">
        <div>
          <p className="state-kicker">{text.kicker}</p>
          <h2 id="furkania-client-setup">{text.title}</h2>
          <p>{text.body}</p>
        </div>
        <span className="module-state module-state-attention">
          {readiness.pending.length} {text.pending}
        </span>
      </div>

      <div className="configuration-detail-grid">
        <article className="configuration-detail-card">
          <span>{text.students}</span>
          <h3>{profile.students.currentCount}</h3>
          <p>~{profile.students.approximateAgeRange.min}–{profile.students.approximateAgeRange.max}</p>
        </article>
        <article className="configuration-detail-card">
          <span>{text.curriculum}</span>
          <h3>Deeniyat Primary</h3>
          <p>{text.courses}: {profile.curriculum.courses.join(", ")}</p>
        </article>
        <article className="configuration-detail-card">
          <span>{text.shifts}</span>
          <h3>{display.shifts[locale].join(" · ")}</h3>
          <p>{text.timetable}</p>
        </article>
      </div>

      <div className="number-preview">
        <small>{text.subjects}</small>
        <strong>{display.subjects[locale].join(" · ")}</strong>
      </div>
    </section>
  );
}
