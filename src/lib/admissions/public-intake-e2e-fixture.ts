import type { PublicAdmissionsContext } from "./public-intake-context";

const labels = (en: string, ur: string, ar: string) => ({ en, ur, ar });

export const publicAdmissionsE2EFixture: PublicAdmissionsContext = {
  tenant: {
    id: 900001,
    name: "Abu School",
    slug: "abu-school",
    clientProfile: "full-product"
  },
  branch: {
    id: 900001,
    name: "Main Branch"
  },
  sessions: [
    {
      key: "2026-27",
      labels: labels("2026–27", "2026–27", "2026–27"),
      startsOn: "2026-06-01",
      endsOn: "2027-05-31",
      isDefault: true
    }
  ],
  programs: [
    {
      key: "deeniyat_primary",
      labels: labels("Deeniyat Primary", "دینیات پرائمری", "الدينيات الابتدائية"),
      programType: "custom"
    }
  ],
  groups: [
    {
      key: "course_1_a",
      labels: labels("Course 1 · A", "کورس 1 · الف", "المستوى 1 · أ"),
      sessionKey: "2026-27",
      programKey: "deeniyat_primary"
    }
  ],
  form: {
    versionId: 900001,
    labels: labels("Admission application", "داخلہ فارم", "طلب الالتحاق"),
    sections: [
      {
        key: "student",
        labels: labels("Student", "طالب علم", "الطالب"),
        fields: [
          {
            key: "full_name",
            type: "short_text",
            labels: labels("Student full name", "طالب علم کا مکمل نام", "اسم الطالب الكامل"),
            required: true
          },
          {
            key: "date_of_birth",
            type: "date",
            labels: labels("Date of birth", "تاریخ پیدائش", "تاريخ الميلاد"),
            required: false
          }
        ]
      },
      {
        key: "guardian",
        labels: labels("Guardian", "سرپرست", "ولي الأمر"),
        fields: [
          {
            key: "guardian_name",
            type: "short_text",
            labels: labels("Guardian name", "سرپرست کا نام", "اسم ولي الأمر"),
            required: true
          },
          {
            key: "guardian_phone",
            type: "phone",
            labels: labels("Guardian phone", "سرپرست کا فون", "هاتف ولي الأمر"),
            required: true
          }
        ]
      },
      {
        key: "placement",
        labels: labels("Placement", "کلاس کی تعیین", "التسكين"),
        fields: [
          {
            key: "group_key",
            type: "short_text",
            labels: labels("Class / group", "کلاس / گروپ", "الصف / المجموعة"),
            required: true
          }
        ]
      }
    ]
  },
  workflowVersionId: 900001
};
