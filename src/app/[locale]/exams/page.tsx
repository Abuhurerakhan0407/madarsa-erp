import type {Locale} from "@/lib/i18n/config";
import {ExamsResultsV2Hub,type ExamsV2View} from "@/components/exams-results-v2-hub";
import {examsCopy} from "@/lib/exams/copy";
import {getExamWorkspace} from "@/lib/exams/workspace";

const views=new Set<ExamsV2View>(["home","create","marks","results","reports","export","analysis"]);

export default async function ExamsPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{view?:string;exam?:string}>}){
  const {locale:rawLocale}=await params;const locale=(rawLocale==="ur"||rawLocale==="ar"?rawLocale:"en") as Locale;const t=examsCopy[locale];
  const search=await searchParams;const requestedView=typeof search.view==="string"?search.view:"home";const view=(views.has(requestedView as ExamsV2View)?requestedView:"home") as ExamsV2View;
  const examId=Number(search.exam);const selectedExamId=Number.isInteger(examId)&&examId>0?examId:null;const data=await getExamWorkspace({examSeriesId:selectedExamId});
  return <><section className="page-heading" data-page-section><div><p className="state-kicker">{t.kicker}</p><h1>{t.title}</h1><p>{t.body}</p></div></section><ExamsResultsV2Hub locale={locale} data={data} view={view}/></>;
}
