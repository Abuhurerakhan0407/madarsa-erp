import { StudentCreateForm } from "@/components/student-create-form";
import { WorkspacePageHeader } from "@/components/workspace-ui";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getStudentCreateOptions } from "@/lib/students/register";

const copy = {
  en: {
    kicker: "Admissions",
    title: "New Admission",
    body: "Admit a walk-in student in four simple steps: student, guardian, placement, and review.",
    back: "Back to Admissions",
    warning: "The permanent student record is created only after you review and confirm the admission."
  },
  ur: {
    kicker: "داخلہ",
    title: "نیا داخلہ",
    body: "چار آسان مراحل میں طالب علم کا داخلہ کریں: طالب علم، سرپرست، تعلیمی تعیناتی اور جائزہ۔",
    back: "داخلہ پر واپس",
    warning: "مستقل طالب علم ریکارڈ صرف جائزہ اور تصدیق کے بعد بنایا جاتا ہے۔"
  }
} as const;

export default async function NewStudentPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale === "ur" ? "ur" : "en" as SupportedLocale;
  const text = copy[locale];
  const options = await getStudentCreateOptions(locale);
  return <>
    <WorkspacePageHeader
      eyebrow={text.kicker}
      title={text.title}
      description={text.body}
      actions={[{ label: text.back, href: `/${locale}/admissions` }]}
    />
    <div className="workspace-context-strip" data-page-section><p>{text.warning}</p></div>
    <StudentCreateForm locale={locale} sessions={options.sessions} programs={options.programs} groups={options.groups} />
  </>;
}
