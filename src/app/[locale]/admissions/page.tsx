import Link from "next/link";
import { InlineState, WorkspacePageHeader } from "@/components/workspace-ui";
import { getAdmissionsInbox } from "@/lib/admissions/inbox";
import { admissionStateLabel } from "@/lib/admissions/enquiry-labels";
import type { SupportedLocale } from "@/lib/i18n/config";
import { requireOfficeAudience } from "@/lib/navigation/office-gate";
import { getTenantContext } from "@/lib/tenancy/context";

const labels = {
  en: {
    kicker: "Admissions operations",
    title: "Admissions inbox",
    subtitle: "Review applications submitted through your institution's published admission form.",
    publicTitle: "Published application form",
    publicBody: "Share the public form with applicants. New submissions arrive in this inbox automatically.",
    openForm: "Open public form",
    applications: "Submitted applications",
    count: "applications",
    empty: "No applications yet",
    emptyBody: "New submitted applications will appear here automatically.",
    submitted: "Admissions workflow",
    reference: "Reference",
    review: "Review application",
    enquiries: "Enquiries and follow-ups"
  },
  ur: {
    kicker: "داخلہ آپریشنز",
    title: "داخلہ درخواستیں",
    subtitle: "ادارے کے شائع شدہ داخلہ فارم کے ذریعے موصول ہونے والی درخواستیں دیکھیں۔",
    publicTitle: "شائع شدہ درخواست فارم",
    publicBody: "عوامی فارم درخواست گزاروں کے ساتھ شیئر کریں۔ نئی درخواستیں خودکار طور پر اس ان باکس میں آئیں گی۔",
    openForm: "عوامی فارم کھولیں",
    applications: "جمع شدہ درخواستیں",
    count: "درخواستیں",
    empty: "ابھی کوئی درخواست نہیں",
    emptyBody: "نئی جمع شدہ درخواستیں خودکار طور پر یہاں ظاہر ہوں گی۔",
    submitted: "داخلہ ورک فلو",
    reference: "حوالہ",
    review: "درخواست کا جائزہ لیں",
    enquiries: "استفسارات اور رابطے"
  }
} as const;

const dateLocales: Record<SupportedLocale, string> = {
  en: "en-IN",
  ur: "ur-IN"
};

function localized(value: Record<string, string> | null, locale: SupportedLocale): string {
  return value?.[locale] || value?.en || "—";
}

type AdmissionsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdmissionsPage({ params }: AdmissionsPageProps) {
  const { locale: rawLocale } = await params;
  const locale: SupportedLocale = rawLocale === "ur" ? "ur" : "en";
  await requireOfficeAudience(locale);
  const text = labels[locale];
  const workspace = await getTenantContext();
  if (!workspace) return null;

  const items = await getAdmissionsInbox(workspace);
  const publicHref = `/apply/${workspace.tenantSlug}?lang=${locale}`;

  return (
    <>
      <WorkspacePageHeader
        eyebrow={text.kicker}
        title={text.title}
        description={text.subtitle}
        meta={`${items.length} ${text.count}`}
        actions={[
          { label: text.enquiries, href: `/${locale}/admissions/enquiries` },
          { label: text.openForm, href: publicHref, kind: "primary" }
        ]}
      />

      <section className="workspace-context-strip" data-page-section>
        <div>
          <strong>{text.publicTitle}</strong>
          <span>{workspace.tenantName}</span>
        </div>
        <p>{text.publicBody}</p>
      </section>

      <section className="workspace-task-section" aria-labelledby="admissions-list-title" data-page-section>
        <header className="workspace-section-heading">
          <p>{text.submitted}</p>
          <h2 id="admissions-list-title">{text.applications}</h2>
        </header>

        {items.length === 0 ? (
          <InlineState title={text.empty} body={text.emptyBody} />
        ) : (
          <div className="workspace-record-list">
            {items.map((item) => (
              <Link className="workspace-record-row" href={`/${locale}/admissions/${item.id}`} key={item.id} prefetch>
                <div className="workspace-record-main">
                  <span className="module-state module-state-attention">{admissionStateLabel(locale, item.state)}</span>
                  <strong>{item.applicantName}</strong>
                  <small>{localized(item.programLabels, locale)} · {localized(item.sessionLabels, locale)}</small>
                </div>
                <div className="workspace-record-meta">
                  <span>{text.reference}: <code>{item.trackingId.slice(0, 8)}</code></span>
                  {item.submittedAt ? (
                    <time dateTime={item.submittedAt}>
                      {new Intl.DateTimeFormat(dateLocales[locale], {
                        dateStyle: "medium",
                        timeStyle: "short"
                      }).format(new Date(item.submittedAt))}
                    </time>
                  ) : null}
                </div>
                <span className="workspace-record-action">{text.review} →</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
