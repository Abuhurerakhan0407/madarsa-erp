import Link from "next/link";
import { EnquiryForm } from "@/components/enquiry-form";
import { getEnquiryOptions } from "@/lib/admissions/enquiries";
import type { Locale } from "@/lib/i18n/config";
import { getTenantContext } from "@/lib/tenancy/context";

const copy = { en: { kicker: "Admissions · New enquiry", title: "Capture enquiry", body: "Record only information provided with consent. Duplicate contacts receive a warning and never auto-merge.", back: "Back to enquiries" }, ur: { kicker: "داخلہ · نیا استفسار", title: "استفسار درج کریں", body: "صرف رضامندی سے دی گئی معلومات درج کریں۔ ممکنہ نقل خودکار طور پر ضم نہیں ہوگی۔", back: "استفسارات پر واپس" }, ar: { kicker: "القبول · استفسار جديد", title: "تسجيل استفسار", body: "سجل المعلومات المقدمة بموافقة فقط. لن يتم دمج التطابقات المحتملة تلقائيًا.", back: "العودة للاستفسارات" } } as const;
const localized = (labels: Record<string,string>,locale:Locale) => labels[locale] || labels.en || "—";
export default async function NewEnquiryPage({ params }: { params: Promise<{ locale:string }> }) {
  const locale=(await params).locale as Locale; const text=copy[locale]; const workspace=await getTenantContext(); if(!workspace)return null; const options=await getEnquiryOptions(workspace);
  return <><section className="page-heading"><div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{text.body}</p></div><Link className="action-button" href={`/${locale}/admissions/enquiries`}>{text.back}</Link></section><section className="configuration-section"><EnquiryForm locale={locale} sessions={options.sessions.map(x=>({id:x.id,label:localized(x.labels,locale)}))} programs={options.programs.map(x=>({id:x.id,label:localized(x.labels,locale)}))} /></section></>;
}
