import Link from "next/link";
import type {Locale} from "@/lib/i18n/config";
import {PrintAction} from "@/components/print-action";
import {examsCopy} from "@/lib/exams/copy";
import {getExamReportCard} from "@/lib/exams/workspace";

function localized(labels:{en?:string;ur?:string;ar?:string},locale:Locale,fallback:string){return labels[locale]||labels.en||fallback;}
const pdfLabel:Record<Locale,string>={en:"Download PDF",ur:"PDF ڈاؤن لوڈ",ar:"تنزيل PDF"};

export default async function ReportCardPage({params,searchParams}:{params:Promise<{locale:string;personId:string}>;searchParams:Promise<{exam?:string}>}){
  const[{locale:rawLocale,personId:rawPersonId},query]=await Promise.all([params,searchParams]);const locale=(rawLocale==="ur"||rawLocale==="ar"?rawLocale:"en") as Locale;const t=examsCopy[locale];const personId=Number(rawPersonId);const examId=Number(query.exam);const selectedExam=Number.isInteger(examId)&&examId>0?examId:null;const card=Number.isInteger(personId)&&personId>0?await getExamReportCard(personId,selectedExam):null;
  const backHref=selectedExam?`/${locale}/exams?view=reports&exam=${selectedExam}`:`/${locale}/exams?view=reports`;
  const pdfHref=selectedExam?`/api/exams/report-card/${personId}/pdf?exam=${selectedExam}`:`/api/exams/report-card/${personId}/pdf`;
  if(!card)return <section className="panel report-card-empty"><h1>{t.reportCard}</h1><p>{t.notAvailable}</p><Link className="action-button" href={backHref}>{t.back}</Link></section>;
  return <div className="report-card-page"><div className="report-card-actions"><Link className="action-button" href={backHref}>{t.back}</Link>{card.issue?.verificationCode?<a className="action-button" href={pdfHref}>{pdfLabel[locale]}</a>:null}<PrintAction label={t.print}/></div><article className="report-card-sheet">
    <header className="report-card-header"><div><p className="state-kicker">{localized(card.exam.labels,locale,t.reportCard)}</p><h1>{t.reportCard}</h1><p>{card.exam.startsOn} → {card.exam.endsOn}</p></div><div className="report-card-grade"><span>{t.grade}</span><strong>{card.result.gradeKey||"—"}</strong></div></header>
    <section className="report-card-student"><div><span>{card.student.studentNumber}</span><strong>{card.student.name}</strong>{card.student.nameNative?<small dir="auto">{card.student.nameNative}</small>:null}</div><div><span>{t.result}</span><strong>{card.result.percentage===null?"—":`${card.result.percentage}%`}</strong><small>{t.outcome}: {card.result.aggregateStatus}</small></div></section>
    <table className="report-card-table"><thead><tr><th>{t.subjects}</th><th>{t.marks}</th><th>{t.maximum}</th><th>{t.grade}</th><th>{t.outcome}</th></tr></thead><tbody>{card.subjects.map((subject,index)=><tr key={`${subject.subjectName}-${index}`}><td>{localized(subject.labels,locale,subject.subjectName)}</td><td>{subject.rawMarks??"—"}</td><td>{subject.maximumMarks}</td><td>{subject.gradeKey||"—"}</td><td>{subject.outcome}</td></tr>)}</tbody></table>
    <section className="report-card-footer"><div><span>{t.promotion}</span><strong>{card.result.promotionRecommendation}</strong></div><div><span>{t.verification}</span><strong className="verification-code">{card.issue?.verificationCode||"—"}</strong><small>Revision {card.issue?.revision??1}</small></div></section>
  </article></div>;
}
