import type {Locale} from "@/lib/i18n/config";
import {ExamsResultsWorkspace} from "@/components/exams-results-workspace";
import {examsCopy} from "@/lib/exams/copy";
import {getExamWorkspace} from "@/lib/exams/workspace";

export default async function ExamsPage({params}:{params:Promise<{locale:string}>}){
  const {locale:rawLocale}=await params;const locale=(rawLocale==="ur"||rawLocale==="ar"?rawLocale:"en") as Locale;const t=examsCopy[locale];const data=await getExamWorkspace();
  return <><section className="page-heading" data-page-section><div><p className="state-kicker">{t.kicker}</p><h1>{t.title}</h1><p>{t.body}</p></div></section><ExamsResultsWorkspace locale={locale} data={data}/></>;
}
