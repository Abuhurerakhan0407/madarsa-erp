import type { ConfigurationPreset, LocalizedLabels, TerminologyEntry } from "./model";

const label = (en: string, ur: string, ar: string): LocalizedLabels => ({ en, ur, ar });

const terminology = (
  student: LocalizedLabels,
  students: LocalizedLabels,
  teacher: LocalizedLabels,
  teachers: LocalizedLabels,
  className: LocalizedLabels,
  classes: LocalizedLabels
): readonly TerminologyEntry[] => [
  { conceptKey: "student", singular: student, plural: students },
  { conceptKey: "teacher", singular: teacher, plural: teachers },
  { conceptKey: "class", singular: className, plural: classes }
];

export const configurationPresets: readonly ConfigurationPreset[] = [
  {
    key: "maktab",
    name: label("Maktab", "مکتب", "الكتّاب"),
    terminology: terminology(
      label("Student", "طالب علم", "طالب"),
      label("Students", "طلبہ", "طلاب"),
      label("Ustad", "استاد", "أستاذ"),
      label("Asatiza", "اساتذہ", "أساتذة"),
      label("Group", "جماعت", "حلقة"),
      label("Groups", "جماعتیں", "حلقات")
    ),
    enabledDomains: ["admissions", "attendance", "nazra", "qaida", "fees"],
    defaultAttendanceStatuses: ["present", "absent", "late", "leave"]
  },
  {
    key: "hifz_academy",
    name: label("Hifz Academy", "حفظ اکیڈمی", "أكاديمية التحفيظ"),
    terminology: terminology(
      label("Hifz Student", "طالب حفظ", "طالب حفظ"),
      label("Hifz Students", "طلبہ حفظ", "طلاب الحفظ"),
      label("Hifz Ustad", "استاد حفظ", "أستاذ التحفيظ"),
      label("Hifz Asatiza", "اساتذہ حفظ", "أساتذة التحفيظ"),
      label("Halaqah", "حلقہ", "حلقة"),
      label("Halaqahs", "حلقے", "حلقات")
    ),
    enabledDomains: ["admissions", "attendance", "hifz", "nazra", "qaida", "fees", "parent_portal"],
    defaultAttendanceStatuses: ["present", "absent", "late", "leave", "excused"]
  },
  {
    key: "dars_e_nizami",
    name: label("Dars-e-Nizami", "درس نظامی", "الدرس النظامي"),
    terminology: terminology(
      label("Talib-e-Ilm", "طالب علم", "طالب علم"),
      label("Tulaba", "طلبہ", "طلاب العلم"),
      label("Ustad", "استاد", "أستاذ"),
      label("Asatiza", "اساتذہ", "أساتذة"),
      label("Sanah", "سنہ", "سنة"),
      label("Sanawat", "سنوات", "سنوات")
    ),
    enabledDomains: ["admissions", "attendance", "dars_e_nizami", "exams", "library", "fees"],
    defaultAttendanceStatuses: ["present", "absent", "late", "leave"]
  },
  {
    key: "islamic_school",
    name: label("Islamic School", "اسلامی اسکول", "المدرسة الإسلامية"),
    terminology: terminology(
      label("Student", "طالب علم", "طالب"),
      label("Students", "طلبہ", "طلاب"),
      label("Teacher", "استاد", "معلّم"),
      label("Teachers", "اساتذہ", "معلّمون"),
      label("Class", "کلاس", "صف"),
      label("Classes", "کلاسیں", "صفوف")
    ),
    enabledDomains: ["admissions", "attendance", "academics", "homework", "exams", "fees", "transport"],
    defaultAttendanceStatuses: ["present", "absent", "late", "leave", "half_day"]
  },
  {
    key: "urdu_medium_school",
    name: label("Urdu-medium School", "اردو میڈیم اسکول", "مدرسة أُردية"),
    terminology: terminology(
      label("Student", "طالب علم", "طالب"),
      label("Students", "طلبہ", "طلاب"),
      label("Teacher", "استاد", "معلّم"),
      label("Teachers", "اساتذہ", "معلّمون"),
      label("Class", "جماعت", "صف"),
      label("Classes", "جماعتیں", "صفوف")
    ),
    enabledDomains: ["admissions", "attendance", "academics", "homework", "exams", "fees"],
    defaultAttendanceStatuses: ["present", "absent", "late", "leave"]
  }
] as const;

export function getConfigurationPreset(key: ConfigurationPreset["key"]): ConfigurationPreset {
  const preset = configurationPresets.find((candidate) => candidate.key === key);
  if (!preset) throw new Error(`Unknown configuration preset: ${key}`);
  return preset;
}
