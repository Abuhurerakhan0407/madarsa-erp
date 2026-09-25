import { notFound } from "next/navigation";
import {
  StudentCreateForm,
  type StaffAdmissionFormDraft
} from "@/components/student-create-form-v3";
import { WorkspacePageHeader } from "@/components/workspace-ui";
import { getStaffAdmissionDraft } from "@/lib/admissions/staff-drafts";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getStudentCreateOptions } from "@/lib/students/register";
import { getTenantContext } from "@/lib/tenancy/context";

const copy = {
  en: {
    kicker: "Admissions",
    title: "Create Admission",
    body: "Create a student and guardian through a guided, resumable admission flow.",
    back: "Back to Admissions",
    warning:
      "Each completed step is saved securely as a draft. The permanent student, guardian link and enrollment are created only after final confirmation."
  },
  ur: {
    kicker: "داخلہ",
    title: "داخلہ بنائیں",
    body: "رہنمائی والے محفوظ داخلہ عمل کے ذریعے طالب علم اور سرپرست بنائیں۔",
    back: "داخلہ پر واپس",
    warning:
      "ہر مکمل مرحلہ محفوظ ڈرافٹ کے طور پر محفوظ ہوتا ہے۔ مستقل طالب علم، سرپرست لنک اور اندراج صرف آخری تصدیق کے بعد بنتے ہیں۔"
  }
} as const;

type NewStudentPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ draft?: string }>;
};

export default async function NewStudentPage({
  params,
  searchParams
}: NewStudentPageProps) {
  const rawLocale = (await params).locale;
  const locale: SupportedLocale = rawLocale === "ur" ? "ur" : "en";
  const text = copy[locale];
  const workspace = await getTenantContext();
  if (!workspace) return null;

  const options = await getStudentCreateOptions(locale);
  const draftValue = (await searchParams).draft;
  let initialDraft: StaffAdmissionFormDraft | null = null;

  if (draftValue) {
    const draftId = Number(draftValue);
    if (!Number.isSafeInteger(draftId) || draftId <= 0) notFound();

    const draft = await getStaffAdmissionDraft(workspace, draftId);
    if (!draft) notFound();

    const groupId =
      options.groups.find(
        (group) =>
          group.key === draft.groupKey &&
          group.sessionId === draft.sessionId &&
          group.programId === draft.programId
      )?.id ?? null;

    initialDraft = {
      id: draft.id,
      preferredLocale: draft.preferredLocale,
      sessionId: draft.sessionId,
      programId: draft.programId,
      groupId,
      displayName: draft.displayName,
      nameNative: draft.nameNative,
      dateOfBirth: draft.dateOfBirth,
      gender: draft.gender,
      joinedOn: draft.joinedOn,
      guardianName: draft.guardianName,
      guardianEmail: draft.guardianEmail,
      guardianPhone: draft.guardianPhone,
      guardianRelationship: draft.guardianRelationship,
      medicalSummary: draft.medicalSummary,
      accessibilityNeeds: draft.accessibilityNeeds,
      pickupRestrictions: draft.pickupRestrictions,
      photoBound: draft.photoBound
    };
  }

  return (
    <>
      <WorkspacePageHeader
        eyebrow={text.kicker}
        title={text.title}
        description={text.body}
        actions={[{ label: text.back, href: `/${locale}/admissions` }]}
      />
      <div className="workspace-context-strip" data-page-section>
        <p>{text.warning}</p>
      </div>
      <StudentCreateForm
        locale={locale}
        sessions={options.sessions}
        programs={options.programs}
        groups={options.groups}
        initialDraft={initialDraft}
      />
    </>
  );
}
