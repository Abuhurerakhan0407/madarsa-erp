import Link from "next/link";
import { getAdmissionsInbox } from "@/lib/admissions/inbox";
import { admissionStateLabel } from "@/lib/admissions/enquiry-labels";
import type { Locale } from "@/lib/i18n/config";
import { getTenantContext } from "@/lib/tenancy/context";

const labels = {
  en: {
    kicker: "Admissions · Live intake",
    title: "Admissions inbox",
    subtitle: "Review applications submitted through your institution's published admission form.",
    publicTitle: "Public application link",
    publicBody: "Share this link with applicants. It uses the currently published admission form and workflow.",
    openForm: "Open public form",
    applications: "Submitted applications",
    count: "applications",
    empty: "No applications yet",
    emptyBody: "New submitted applications will appear here automatically.",
    submitted: "Admissions workflow",
    reference: "Reference",
    review: "Review application"
    , enquiries: "Enquiries and follow-ups"
  },
  ur: {
    kicker: "داخلہ · براہ راست درخواستیں",
    title: "داخلہ درخواستیں",
    subtitle: "ادارے کے شائع شدہ داخلہ فارم کے ذریعے موصول ہونے والی درخواستیں دیکھیں۔",
    publicTitle: "عوامی درخواست لنک",
    publicBody: "یہ لنک درخواست گزاروں کے ساتھ شیئر کریں۔ یہ موجودہ شائع شدہ داخلہ فارم اور ورک فلو استعمال کرتا ہے۔",
    openForm: "عوامی فارم کھولیں",
    applications: "جمع شدہ درخواستیں",
    count: "درخواستیں",
    empty: "ابھی کوئی درخواست نہیں",
    emptyBody: "نئی جمع شدہ درخواستیں خودکار طور پر یہاں ظاہر ہوں گی۔",
    submitted: "داخلہ ورک فلو",
    reference: "حوالہ",
    review: "درخواست کا جائزہ لیں"
    , enquiries: "استفسارات اور رابطے"
  },
  ar: {
    kicker: "القبول · الطلبات المباشرة",
    title: "صندوق طلبات القبول",
    subtitle: "راجع الطلبات المقدمة من خلال نموذج القبول المنشور للمؤسسة.",
    publicTitle: "رابط طلب الالتحاق العام",
    publicBody: "شارك هذا الرابط مع المتقدمين. يستخدم نموذج القبول ومسار العمل المنشورين حاليًا.",
    openForm: "فتح النموذج العام",
    applications: "الطلبات المقدمة",
    count: "طلبات",
    empty: "لا توجد طلبات حتى الآن",
    emptyBody: "ستظهر الطلبات الجديدة هنا تلقائيًا.",
    submitted: "مسار القبول",
    reference: "المرجع",
    review: "مراجعة الطلب"
    , enquiries: "الاستفسارات والمتابعة"
  }
} as const;

const dateLocales: Record<Locale, string> = {
  en: "en-IN",
  ur: "ur-IN",
  ar: "ar-SA"
};

function localized(value: Record<string, string> | null, locale: Locale): string {
  return value?.[locale] || value?.en || "—";
}

type AdmissionsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdmissionsPage({ params }: AdmissionsPageProps) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  const text = labels[locale];
  const workspace = await getTenantContext();
  if (!workspace) return null;

  const items = await getAdmissionsInbox(workspace);
  const publicHref = `/apply/${workspace.tenantSlug}?lang=${locale}`;

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="state-kicker">{text.kicker}</p>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>
      </section>

      <section className="configuration-banner">
        <div>
          <span>{text.publicTitle}</span>
          <h2>{workspace.tenantName}</h2>
          <p>{text.publicBody}</p>
        </div>
        <Link className="action-button action-button-primary" href={publicHref} target="_blank" rel="noreferrer">
          {text.openForm}
        </Link>
        <Link className="action-button" href={`/${locale}/admissions/enquiries`}>{text.enquiries}</Link>
      </section>

      <section className="configuration-section" aria-labelledby="admissions-list-title">
        <header className="section-heading">
          <div>
            <p>{text.submitted}</p>
            <h2 id="admissions-list-title">{text.applications}</h2>
          </div>
          <span>{items.length} {text.count}</span>
        </header>

        {items.length === 0 ? (
          <div className="empty-state">
            <h3>{text.empty}</h3>
            <p>{text.emptyBody}</p>
          </div>
        ) : (
          <div className="configuration-module-grid">
            {items.map((item) => (
              <article className="configuration-module" key={item.id}>
                <span className="module-state module-state-attention">{admissionStateLabel(locale, item.state)}</span>
                <h3>{item.applicantName}</h3>
                <p>{localized(item.programLabels, locale)} · {localized(item.sessionLabels, locale)}</p>
                <p>{text.reference}: <code>{item.trackingId.slice(0, 8)}</code></p>
                {item.submittedAt ? (
                  <small>
                    {new Intl.DateTimeFormat(dateLocales[locale], {
                      dateStyle: "medium",
                      timeStyle: "short"
                    }).format(new Date(item.submittedAt))}
                  </small>
                ) : null}
                <p>
                  <Link className="action-button" href={`/${locale}/admissions/${item.id}`}>
                    {text.review}
                  </Link>
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
