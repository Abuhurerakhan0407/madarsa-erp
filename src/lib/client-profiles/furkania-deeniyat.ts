export const furkaniaDeeniyatProgram = {
  key: "deeniyat_primary",
  labels: {
    en: "Deeniyat Primary",
    ur: "دینیات پرائمری",
    ar: "الدينيات الابتدائية"
  },
  descriptions: {
    en: "Madrasa-e-Furkania Deeniyat Primary curriculum for Courses 1–5 using Hinglish books.",
    ur: "مدرسہ فرکانیہ کے لیے ہنگلش کتابوں کے ساتھ دینیات پرائمری کورس 1–5۔",
    ar: "منهج الدينيات الابتدائي لمدرسة الفرقانية للمستويات 1–5 باستخدام كتب هينغليش."
  },
  programType: "custom" as const,
  bookMedium: "hinglish" as const,
  entryRules: {
    age4To5Course: 1
  },
  // We intentionally do not use the generic `deeniyat` template because its
  // seeded subjects do not match the confirmed five-family Deeniyat structure.
  templateKey: "blank_custom" as const
} as const;

export const furkaniaDeeniyatLevels = [1, 2, 3, 4, 5].map((course) => ({
  key: `course_${course}`,
  sequence: course,
  labels: {
    en: `Course ${course}`,
    ur: `کورس ${course}`,
    ar: `المستوى ${course}`
  }
})) as readonly {
  key: string;
  sequence: number;
  labels: { en: string; ur: string; ar: string };
}[];

export const furkaniaDeeniyatSubjects = [
  {
    key: "quraan",
    labels: { en: "Qur’aan", ur: "قرآن", ar: "القرآن" },
    subjectType: "quran" as const,
    progressMethod: "completion" as const,
    unitStructure: "lesson" as const
  },
  {
    key: "hadeeth",
    labels: { en: "Hadeeth", ur: "حدیث", ar: "الحديث" },
    subjectType: "traditional" as const,
    progressMethod: "completion" as const,
    unitStructure: "lesson" as const
  },
  {
    key: "aqaaid_and_masaail",
    labels: { en: "Aqaa’id & Masaa’il", ur: "عقائد و مسائل", ar: "العقائد والمسائل" },
    subjectType: "traditional" as const,
    progressMethod: "completion" as const,
    unitStructure: "lesson" as const
  },
  {
    key: "islamic_upbringing",
    labels: { en: "Islamic Upbringing", ur: "اسلامی تربیت", ar: "التربية الإسلامية" },
    subjectType: "traditional" as const,
    progressMethod: "rating" as const,
    unitStructure: "topic" as const
  },
  {
    key: "language",
    labels: { en: "Language", ur: "زبان", ar: "اللغة" },
    subjectType: "language" as const,
    progressMethod: "completion" as const,
    unitStructure: "lesson" as const
  }
] as const;

export const furkaniaShiftKeys = ["morning", "midday", "evening"] as const;

export type FurkaniaDeeniyatSubject = (typeof furkaniaDeeniyatSubjects)[number];
