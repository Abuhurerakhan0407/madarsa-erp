import type { Locale } from "@/lib/i18n/config";
import { QuranHifzWorkspace } from "@/components/quran-hifz-workspace";
import { getQuranHifzWorkspace } from "@/lib/quran/workspace";

const copy = {
  en: { kicker:"Qur'an learning",title:"Qur'an, Hifz & Revision",body:"Record Sabaq, Sabqi, Manzil, Nazra and Tajweed against each student's permanent learning history." },
  ur: { kicker:"قرآنی تعلیم",title:"قرآن، حفظ اور دَور",body:"ہر طالب علم کی مستقل تعلیمی تاریخ میں سبق، سبقی، منزل، ناظرہ اور تجوید درج کریں۔" },
  ar: { kicker:"تعلم القرآن",title:"القرآن والحفظ والمراجعة",body:"سجّل السبق والسبقي والمنزل والنظرة والتجويد ضمن السجل التعليمي الدائم لكل طالب." }
} as const;

export default async function QuranPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{q?:string;page?:string}>}){
  const {locale:rawLocale}=await params;const query=await searchParams;
  const locale=(rawLocale==="ur"||rawLocale==="ar"?rawLocale:"en") as Locale;
  const search=(query.q??"").trim().slice(0,160);const page=Math.max(1,Math.min(Number(query.page)||1,100000));
  const data=await getQuranHifzWorkspace({search,page,pageSize:40});const text=copy[locale];
  return <><section className="page-heading" data-page-section><div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{text.body}</p></div>{data.localDate?<time dateTime={data.localDate}>{data.localDate}</time>:null}</section><QuranHifzWorkspace locale={locale} data={data} search={search}/></>;
}
