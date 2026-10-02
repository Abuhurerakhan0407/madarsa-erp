import { notFound } from "next/navigation";
import { StudentLifecycleCenter } from "@/components/student-lifecycle-center";
import { WorkspacePageHeader } from "@/components/workspace-ui";
import { routing } from "@/i18n/routing";
import type { SupportedLocale } from "@/lib/i18n/config";
import { requireOfficeAudience } from "@/lib/navigation/office-gate";
import { getStudentLifecycleCenter } from "@/lib/students/lifecycle";

const copy = {
  en: {
    kicker: "Students",
    title: "Import Students",
    body: "Upload a validated CSV to create students, guardians, and class links in one controlled import.",
    back: "Back to students",
    csvFile: "CSV file",
    template: "Download sample CSV",
    templateHint: "Required: student name. Optional: Urdu name, DOB, gender, locale, guardian name, relationship, phone, and email. Class placement is selected below.",
    placement: "Class / group",
    joinedOn: "Admission date",
    preview: "Import preview",
    importAction: "Import students",
    importing: "Importing students…",
    valid: "Valid",
    warnings: "Warnings",
    invalid: "Invalid",
    duplicates: "Duplicates",
    rows: "rows",
    row: "Row",
    student: "Student",
    guardian: "Guardian",
    issue: "Issue",
    status: "Status",
    validRow: "Ready",
    warningRow: "Warning",
    invalidRow: "Invalid",
    noGuardian: "No guardian",
    reviewConfirm: "I reviewed this preview and want to import all valid rows.",
    downloadErrors: "Download error CSV",
    summary: "Import result",
    created: "Created",
    linked: "Guardians linked",
    skipped: "Skipped / review",
    failed: "Failed",
    recent: "Recent imports",
    none: "No import jobs yet.",
    chooseCsv: "Choose a CSV file to preview records before importing.",
    csvError: "Unable to read this CSV.",
    importError: "Unable to import students.",
    placementRequired: "Choose a class or group.",
    invalidRowsBlock: "Fix invalid or duplicate rows before importing.",
    success: "Import completed."
  },
  ur: {
    kicker: "طلبہ",
    title: "طلبہ امپورٹ کریں",
    body: "تصدیق شدہ CSV کے ذریعے طلبہ، سرپرست اور کلاس لنکس ایک محفوظ امپورٹ میں بنائیں۔",
    back: "طلبہ پر واپس",
    csvFile: "CSV فائل",
    template: "نمونہ CSV ڈاؤن لوڈ کریں",
    templateHint: "لازمی: طالب علم کا نام۔ اختیاری: اردو نام، تاریخ پیدائش، جنس، زبان، سرپرست نام، رشتہ، فون اور ای میل۔ کلاس نیچے منتخب کریں۔",
    placement: "کلاس / گروپ",
    joinedOn: "داخلہ تاریخ",
    preview: "امپورٹ پری ویو",
    importAction: "طلبہ امپورٹ کریں",
    importing: "طلبہ امپورٹ ہو رہے ہیں…",
    valid: "درست",
    warnings: "تنبیہات",
    invalid: "غلط",
    duplicates: "ڈپلیکیٹس",
    rows: "قطاریں",
    row: "قطار",
    student: "طالب علم",
    guardian: "سرپرست",
    issue: "مسئلہ",
    status: "حالت",
    validRow: "تیار",
    warningRow: "تنبیہ",
    invalidRow: "غلط",
    noGuardian: "سرپرست نہیں",
    reviewConfirm: "میں نے پری ویو دیکھ لیا ہے اور تمام درست قطاریں امپورٹ کرنا چاہتا ہوں۔",
    downloadErrors: "غلطیوں کی CSV ڈاؤن لوڈ کریں",
    summary: "امپورٹ نتیجہ",
    created: "بنائے گئے",
    linked: "سرپرست لنک ہوئے",
    skipped: "روکے گئے / ریویو",
    failed: "ناکام",
    recent: "حالیہ امپورٹس",
    none: "ابھی کوئی امپورٹ جاب نہیں۔",
    chooseCsv: "امپورٹ سے پہلے ریکارڈ دیکھنے کے لیے CSV فائل منتخب کریں۔",
    csvError: "CSV فائل نہیں پڑھی جا سکی۔",
    importError: "طلبہ امپورٹ نہیں ہو سکے۔",
    placementRequired: "کلاس یا گروپ منتخب کریں۔",
    invalidRowsBlock: "امپورٹ سے پہلے غلط یا ڈپلیکیٹ قطاریں درست کریں۔",
    success: "امپورٹ مکمل ہوا۔"
  }
} as const;

type PageProps = { params: Promise<{ locale: string }> };

export default async function StudentLifecyclePage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  if (!routing.locales.includes(rawLocale as SupportedLocale)) notFound();
  const locale: SupportedLocale = rawLocale === "ur" ? "ur" : "en";
  await requireOfficeAudience(locale);
  const data = await getStudentLifecycleCenter();
  const t = copy[locale];
  return (
    <>
      <WorkspacePageHeader
        eyebrow={t.kicker}
        title={t.title}
        description={t.body}
        meta={`${data.students.length} students`}
        actions={[{ label: t.back, href: `/${locale}/students` }]}
      />
      <StudentLifecycleCenter data={data} copy={t} />
    </>
  );
}
