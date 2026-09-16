import Link from "next/link";
import { InlineState, WorkspacePageHeader } from "@/components/workspace-ui";
import { getAdmissionsInbox } from "@/lib/admissions/inbox";
import { admissionStateLabel } from "@/lib/admissions/enquiry-labels";
import type { Locale } from "@/lib/i18n/config";
import { getStudentRegister } from "@/lib/students/register";
import { getTenantContext } from "@/lib/tenancy/context";

const labels = {
  en: {
    title: "Admissions",
    subtitle: "Admit walk-in students or review online applications.",
    newAdmission: "+ New Admission",
    recentTab: "Recent / Walk-in Admissions",
    onlineTab: "Online Applications",
    recentTitle: "Recently admitted students",
    recentBody: "Open a student profile or start another walk-in admission.",
    noRecent: "No students have been admitted yet.",
    noRecentBody: "Use New Admission to add the first walk-in student.",
    recentError: "Unable to load recent admissions",
    recentErrorBody: "The student register could not be loaded. Your records have not been changed.",
    retry: "Retry",
    studentNumber: "Student number",
    applications: "Online applications",
    empty: "No online applications waiting",
    emptyBody: "New applications submitted through the public form will appear here.",
    reference: "Reference",
    review: "Open application",
    publicForm: "Public application form",
    enquiries: "Enquiries",
    count: "applications"
  },
  ur: {
    title: "داخلہ",
    subtitle: "واک اِن طالب علم کا داخلہ کریں یا آن لائن درخواستوں کا جائزہ لیں۔",
    newAdmission: "+ نیا داخلہ",
    recentTab: "حالیہ / واک اِن داخلے",
    onlineTab: "آن لائن درخواستیں",
    recentTitle: "حال ہی میں داخل کیے گئے طلبہ",
    recentBody: "طالب علم پروفائل کھولیں یا نیا واک اِن داخلہ شروع کریں۔",
    noRecent: "ابھی کوئی طالب علم داخل نہیں کیا گیا۔",
    noRecentBody: "پہلا واک اِن طالب علم شامل کرنے کے لیے نیا داخلہ استعمال کریں۔",
    recentError: "حالیہ داخلے لوڈ نہیں ہو سکے",
    recentErrorBody: "طلبہ رجسٹر لوڈ نہیں ہو سکا۔ آپ کے ریکارڈ میں کوئی تبدیلی نہیں کی گئی۔",
    retry: "دوبارہ کوشش کریں",
    studentNumber: "طالب علم نمبر",
    applications: "آن لائن درخواستیں",
    empty: "کوئی آن لائن درخواست منتظر نہیں",
    emptyBody: "عوامی فارم سے جمع ہونے والی نئی درخواستیں یہاں نظر آئیں گی۔",
    reference: "حوالہ",
    review: "درخواست کھولیں",
    publicForm: "عوامی درخواست فارم",
    enquiries: "استفسارات",
    count: "درخواستیں"
  },
  ar: {
    title: "القبول",
    subtitle: "اقبل الطلاب الحضوريين أو راجع الطلبات الإلكترونية.",
    newAdmission: "+ قبول جديد",
    recentTab: "القبول الحديث / الحضوري",
    onlineTab: "الطلبات الإلكترونية",
    recentTitle: "الطلاب المقبولون حديثًا",
    recentBody: "افتح ملف الطالب أو ابدأ قبولًا حضوريًا جديدًا.",
    noRecent: "لم يتم قبول أي طالب حتى الآن.",
    noRecentBody: "استخدم قبول جديد لإضافة أول طالب حضوري.",
    recentError: "تعذر تحميل القبول الحديث",
    recentErrorBody: "تعذر تحميل سجل الطلاب. لم يتم تغيير سجلاتك.",
    retry: "إعادة المحاولة",
    studentNumber: "رقم الطالب",
    applications: "الطلبات الإلكترونية",
    empty: "لا توجد طلبات إلكترونية منتظرة",
    emptyBody: "ستظهر هنا الطلبات الجديدة المرسلة من النموذج العام.",
    reference: "المرجع",
    review: "فتح الطلب",
    publicForm: "نموذج الطلب العام",
    enquiries: "الاستفسارات",
    count: "طلبات"
  }
} as const;

const statusLabels: Record<Locale, Record<string, string>> = {
  en: { active: "Active", paused: "Paused", transferred: "Transferred", completed: "Completed", withdrawn: "Withdrawn", alumni: "Alumni", archived: "Archived" },
  ur: { active: "فعال", paused: "عارضی طور پر رکا", transferred: "منتقل", completed: "مکمل", withdrawn: "دستبردار", alumni: "فارغ / سابق", archived: "آرکائیو" },
  ar: { active: "نشط", paused: "موقوف مؤقتًا", transferred: "منقول", completed: "مكتمل", withdrawn: "منسحب", alumni: "خريج / سابق", archived: "مؤرشف" }
};

const dateLocales: Record<Locale, string> = { en: "en-IN", ur: "ur-IN", ar: "ar-SA" };

function localized(value: Record<string, string> | null, locale: Locale): string {
  return value?.[locale] || value?.en || "—";
}

type AdmissionsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function AdmissionsPage({ params, searchParams }: AdmissionsPageProps) {
  const [{ locale: rawLocale }, query, workspace] = await Promise.all([params, searchParams, getTenantContext()]);
  const locale = rawLocale as Locale;
  const text = labels[locale];
  if (!workspace) return null;

  const view = query.view === "online" ? "online" : "recent";
  const [items, recentState] = await Promise.all([
    getAdmissionsInbox(workspace),
    getStudentRegister({ locale, page: 1, pageSize: 10 })
      .then((data) => ({ data, error: false as const }))
      .catch(() => ({ data: null, error: true as const }))
  ]);
  const recent = recentState.data;
  const publicHref = `/apply/${workspace.tenantSlug}?lang=${locale}`;

  return (
    <>
      <WorkspacePageHeader
        title={text.title}
        description={text.subtitle}
        actions={[{ label: text.newAdmission, href: `/${locale}/students/new`, kind: "primary" }]}
      />

      <nav className="quick-actions" aria-label={text.title} data-page-section>
        <Link className={`action-button ${view === "recent" ? "action-button-primary" : ""}`} href={`/${locale}/admissions`}>{text.recentTab}</Link>
        <Link className={`action-button ${view === "online" ? "action-button-primary" : ""}`} href={`/${locale}/admissions?view=online`}>{text.onlineTab}</Link>
      </nav>

      {view === "recent" ? (
        <section className="workspace-task-section" aria-labelledby="recent-admissions-title" data-page-section>
          <header className="workspace-section-heading">
            <p>{text.recentBody}</p>
            <h2 id="recent-admissions-title">{text.recentTitle}</h2>
          </header>
          {recentState.error ? (
            <InlineState title={text.recentError} body={text.recentErrorBody} action={<Link className="action-button" href={`/${locale}/admissions`}>{text.retry}</Link>} />
          ) : !recent || recent.rows.length === 0 ? (
            <InlineState title={text.noRecent} body={text.noRecentBody} />
          ) : (
            <div className="workspace-record-list">
              {recent.rows.map((student) => (
                <Link className="workspace-record-row" href={`/${locale}/students/${student.personId}`} key={student.personId} prefetch>
                  <div className="workspace-record-main">
                    <span className="module-state module-state-complete">{statusLabels[locale][student.status] ?? student.status}</span>
                    <strong>{student.name}</strong>
                    <small>{student.program} · {student.group}</small>
                  </div>
                  <div className="workspace-record-meta">
                    <span>{text.studentNumber}: <code>{student.studentNumber}</code></span>
                    {student.joinedOn ? <time dateTime={student.joinedOn}>{new Intl.DateTimeFormat(dateLocales[locale], { dateStyle: "medium" }).format(new Date(`${student.joinedOn}T00:00:00`))}</time> : null}
                  </div>
                  <span className="workspace-record-action">→</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="workspace-context-strip" data-page-section>
            <div><strong>{text.onlineTab}</strong><span>{items.length} {text.count}</span></div>
            <div className="quick-actions">
              <Link className="action-button" href={publicHref}>{text.publicForm}</Link>
              <Link className="action-button" href={`/${locale}/admissions/enquiries`}>{text.enquiries}</Link>
            </div>
          </section>

          <section className="workspace-task-section" aria-labelledby="online-applications-title" data-page-section>
            <header className="workspace-section-heading"><h2 id="online-applications-title">{text.applications}</h2></header>
            {items.length === 0 ? (
              <InlineState title={text.empty} body={text.emptyBody} />
            ) : (
              <div className="workspace-record-list">
                {items.map((item) => (
                  <Link className="workspace-record-row" href={`/${locale}/admissions/${item.id}`} key={item.id} prefetch>
                    <div className="workspace-record-main">
                      <span className="module-state module-state-attention">{admissionStateLabel(locale, item.state)}</span>
                      <strong>{item.applicantName}</strong>
                      <small>{localized(item.programLabels, locale)}</small>
                    </div>
                    <div className="workspace-record-meta">
                      <span>{text.reference}: <code>{item.trackingId.slice(0, 8)}</code></span>
                      {item.submittedAt ? <time dateTime={item.submittedAt}>{new Intl.DateTimeFormat(dateLocales[locale], { dateStyle: "medium" }).format(new Date(item.submittedAt))}</time> : null}
                    </div>
                    <span className="workspace-record-action">{text.review} →</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
