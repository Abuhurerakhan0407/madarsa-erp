import Link from "next/link";
import { getEnquiries } from "@/lib/admissions/enquiries";
import { enquiryStatusLabel } from "@/lib/admissions/enquiry-labels";
import type { SupportedLocale } from "@/lib/i18n/config";
import { requireOfficeAudience } from "@/lib/navigation/office-gate";
import { getTenantContext } from "@/lib/tenancy/context";

const copy = {
  en: { kicker: "Admissions · Enquiries", title: "Enquiry follow-up", body: "Capture interest, assign the next action and preserve the path into admission.", add: "New enquiry", back: "Applications", count: "enquiries", empty: "No enquiries yet", next: "Next follow-up", source: "Source", open: "Open enquiry" },
  ur: { kicker: "داخلہ · استفسارات", title: "استفسار اور رابطہ", body: "دلچسپی، اگلی کارروائی اور داخلہ درخواست تک مکمل ریکارڈ محفوظ کریں۔", add: "نیا استفسار", back: "درخواستیں", count: "استفسارات", empty: "ابھی کوئی استفسار نہیں", next: "اگلا رابطہ", source: "ذریعہ", open: "استفسار کھولیں" }
} as const;
const dateLocales: Record<SupportedLocale,string> = { en: "en-IN", ur: "ur-IN" };
const localized = (labels: Record<string,string> | null, locale: SupportedLocale) => labels?.[locale] || labels?.en || "—";

export default async function EnquiriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const raw=(await params).locale; const locale:SupportedLocale=raw==="ur"?"ur":"en"; await requireOfficeAudience(locale); const text = copy[locale]; const workspace = await getTenantContext(); if (!workspace) return null;
  const items = await getEnquiries(workspace);
  return <><section className="page-heading"><div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{text.body}</p></div><div className="quick-actions"><Link className="action-button" href={`/${locale}/admissions`}>{text.back}</Link><Link className="action-button action-button-primary" href={`/${locale}/admissions/enquiries/new`}>{text.add}</Link></div></section>
    <section className="configuration-section" aria-labelledby="enquiries-title"><header className="section-heading"><div><p>{items.length} {text.count}</p><h2 id="enquiries-title">{text.title}</h2></div></header>
    {!items.length ? <div className="empty-state"><p>{text.empty}</p></div> : <div className="configuration-module-grid">{items.map((item) => <article className="configuration-module" key={item.id}><span className="module-state module-state-attention">{enquiryStatusLabel(locale, item.status)}</span><h3>{item.applicantName}</h3><p>{localized(item.programLabels,locale)} · {localized(item.sessionLabels,locale)}</p>{item.source ? <p>{text.source}: {item.source}</p> : null}<p>{text.next}: {item.nextFollowUpAt ? new Intl.DateTimeFormat(dateLocales[locale],{dateStyle:"medium",timeStyle:"short"}).format(new Date(item.nextFollowUpAt)) : "—"}</p><Link className="action-button" href={`/${locale}/admissions/enquiries/${item.id}`}>{text.open}</Link></article>)}</div>}
    </section></>;
}
