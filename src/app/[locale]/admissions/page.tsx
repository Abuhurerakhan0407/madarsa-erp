import { AdmissionDraftList } from "@/components/admission-draft-list";
import { WorkspacePageHeader } from "@/components/workspace-ui";
import { listStaffAdmissionDrafts } from "@/lib/admissions/staff-drafts";
import type { SupportedLocale } from "@/lib/i18n/config";
import { requireOfficeAudience } from "@/lib/navigation/office-gate";
import { getTenantContext } from "@/lib/tenancy/context";

const copy = {
  en: {
    kicker: "Admissions",
    title: "Admissions",
    subtitle: "Create new admissions and resume saved drafts without mixing them with historical applications.",
    create: "Create Admission",
    enquiries: "Enquiries",
    drafts: "Draft Applications",
    draftBody: "Incomplete staff admissions are saved here so work can continue safely after interruption.",
    count: "drafts",
    unknownProgram: "Program not selected",
    unknownSession: "Academic year not selected"
  },
  ur: {
    kicker: "داخلہ",
    title: "داخلہ",
    subtitle: "نئے داخلے بنائیں اور محفوظ ڈرافٹس جاری رکھیں، بغیر تاریخی درخواستوں کی بھیڑ کے۔",
    create: "داخلہ بنائیں",
    enquiries: "استفسارات",
    drafts: "داخلہ ڈرافٹس",
    draftBody: "نامکمل عملہ داخلے یہاں محفوظ رہتے ہیں تاکہ رکاوٹ کے بعد محفوظ طریقے سے کام جاری رکھا جا سکے۔",
    count: "ڈرافٹس",
    unknownProgram: "پروگرام منتخب نہیں",
    unknownSession: "تعلیمی سال منتخب نہیں"
  }
} as const;

function localized(
  labels: Record<string, string> | null,
  locale: SupportedLocale,
  fallback: string
): string {
  return labels?.[locale] || labels?.en || fallback;
}

type AdmissionsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdmissionsPage({ params }: AdmissionsPageProps) {
  const rawLocale = (await params).locale;
  const locale: SupportedLocale = rawLocale === "ur" ? "ur" : "en";
  await requireOfficeAudience(locale);

  const workspace = await getTenantContext();
  if (!workspace) return null;

  const text = copy[locale];
  const drafts = await listStaffAdmissionDrafts(workspace);
  const items = drafts.map((draft) => ({
    id: draft.id,
    applicantName: draft.applicantName,
    program: localized(draft.programLabels, locale, text.unknownProgram),
    session: localized(draft.sessionLabels, locale, text.unknownSession),
    updatedAt: draft.updatedAt
  }));

  return (
    <>
      <WorkspacePageHeader
        eyebrow={text.kicker}
        title={text.title}
        description={text.subtitle}
        meta={`${items.length} ${text.count}`}
        actions={[
          {
            label: text.create,
            href: `/${locale}/students/new`,
            kind: "primary"
          },
          {
            label: text.enquiries,
            href: `/${locale}/admissions/enquiries`
          }
        ]}
      />

      <section
        className="workspace-task-section"
        aria-labelledby="admission-drafts-title"
        data-page-section
      >
        <header className="workspace-section-heading">
          <p>{items.length} {text.count}</p>
          <h2 id="admission-drafts-title">{text.drafts}</h2>
          <span>{text.draftBody}</span>
        </header>

        <AdmissionDraftList locale={locale} initialItems={items} />
      </section>
    </>
  );
}
