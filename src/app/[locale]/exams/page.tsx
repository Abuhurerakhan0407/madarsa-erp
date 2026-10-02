import Link from "next/link";
import type {SupportedLocale} from "@/lib/i18n/config";
import {ExamsResultsV2Hub,type ExamsV2View} from "@/components/exams-results-v2-hub";
import {InlineState} from "@/components/workspace-ui";
import {examsCopy,examStateLabel} from "@/lib/exams/copy";
import {getExamWorkspace} from "@/lib/exams/workspace";
import {getExamActionAvailability} from "@/lib/exams/state";
import styles from "./page.module.css";

const views=new Set<ExamsV2View>(["home","create","marks","results","reports","export","analysis"]);
const emptyCopy={
 en:{missing:"No class is ready for exams",missingBody:"Complete the academic year, program and class first. Exams use those same governed academic records.",setup:"Complete institution setup",none:"No exams yet",noneBody:"Create the first exam for an active class, then enter marks from the same workspace.",create:"Create first exam",readonly:"No exams are available yet",readonlyBody:"An office administrator with exam setup permission must create the first exam."},
 ur:{missing:"امتحان کے لیے ابھی کوئی کلاس تیار نہیں",missingBody:"پہلے تعلیمی سال، پروگرام اور کلاس مکمل کریں۔ امتحان انہی محفوظ اکیڈمک ریکارڈز کو استعمال کرتا ہے۔",setup:"ادارے کا سیٹ اپ مکمل کریں",none:"ابھی کوئی امتحان نہیں",noneBody:"فعال کلاس کے لیے پہلا امتحان بنائیں، پھر اسی ورک اسپیس سے نمبر درج کریں۔",create:"پہلا امتحان بنائیں",readonly:"ابھی کوئی امتحان دستیاب نہیں",readonlyBody:"امتحان بنانے کی اجازت رکھنے والا دفتری منتظم پہلا امتحان بنائے گا۔"}
} as const;
const contextCopy={
 en:{selected:"Selected exam",activeBody:"This is the active exam for the actions below.",publishedBody:"Results are published. Marks are locked; use results and report cards as the primary actions.",marks:"Enter Marks",results:"View Results",reports:"Report Cards",export:"Export",analysis:"Analysis",reviewMarks:"Review / Moderate Marks"},
 ur:{selected:"منتخب امتحان",activeBody:"نیچے دیے گئے کام اسی منتخب امتحان پر ہوں گے۔",publishedBody:"نتائج جاری ہو چکے ہیں۔ نمبر مقفل ہیں؛ اب نتائج اور رپورٹ کارڈ بنیادی کام ہیں۔",marks:"نمبر درج کریں",results:"نتائج دیکھیں",reports:"رپورٹ کارڈ",export:"ایکسپورٹ",analysis:"تجزیہ",reviewMarks:"نمبر دیکھیں / تصحیح کریں"}
} as const;

export default async function ExamsPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{view?:string;exam?:string}>}){
  const {locale:rawLocale}=await params;const locale:SupportedLocale=rawLocale==="ur"?"ur":"en";const t=examsCopy[locale];const e=emptyCopy[locale];const c=contextCopy[locale];
  const search=await searchParams;const requestedView=typeof search.view==="string"?search.view:"home";const view=(views.has(requestedView as ExamsV2View)?requestedView:"home") as ExamsV2View;
  const examId=Number(search.exam);const selectedExamId=Number.isInteger(examId)&&examId>0?examId:null;const data=await getExamWorkspace({examSeriesId:selectedExamId});
  const empty=data.exams.length===0;const selectedExam=data.exam;const isPublished=selectedExam?.state==="results_published";const complete=data.summary.marksExpected>0&&data.summary.marksRecorded>=data.summary.marksExpected;const availability=selectedExam?getExamActionAvailability({state:selectedExam.state,resultState:data.latestResult?.state??null,canRead:data.canRead,canEnter:data.canEnter,canModerate:data.canModerate,canApprove:data.canApprove,canPublish:data.canPublish,marksComplete:complete,analysisAvailable:data.analysis?.available===true}):null;
  const shellClass=[styles.shell,selectedExam?styles.hasSelected:"",isPublished?styles.published:""].filter(Boolean).join(" ");
  const selectedLabel=selectedExam?(locale==="ur"?selectedExam.labels.ur||selectedExam.labels.en||selectedExam.label:selectedExam.labels.en||selectedExam.label):"";
  const emptyState=empty?(data.setup.groups.length===0?<InlineState title={e.missing} body={e.missingBody} action={<Link className="action-button action-button-primary" href={`/${locale}/setup`}>{e.setup}</Link>}/>:data.setup.canCreate?<InlineState title={e.none} body={e.noneBody} action={<Link className="action-button action-button-primary" href={`/${locale}/exams?view=create`}>{e.create}</Link>}/>:<InlineState title={e.readonly} body={e.readonlyBody}/>):null;
  const selectedContext=selectedExam?<section className={`professional-card ${styles.contextCard}`} data-testid="exam-selected-context"><div className="section-heading"><div><p className="state-kicker">{c.selected}</p><h2>{selectedLabel}</h2><p>{isPublished?c.publishedBody:c.activeBody}</p></div><span className="status-pill">{examStateLabel(selectedExam.state,t)}</span></div><div className={styles.contextActions}>{availability?.reports?<Link className="action-button action-button-primary" href={`/${locale}/exams?view=reports&exam=${selectedExam.id}`}>{c.reports}</Link>:availability?.enterMarks?<Link className="action-button action-button-primary" href={`/${locale}/exams?view=marks&exam=${selectedExam.id}`}>{c.marks}</Link>:availability?.reviewMarks?<Link className="action-button action-button-primary" href={`/${locale}/exams?view=marks&exam=${selectedExam.id}`}>{c.reviewMarks}</Link>:null}<Link className="action-button" href={`/${locale}/exams?view=results&exam=${selectedExam.id}`}>{c.results}</Link>{availability?.analysis?<Link className="action-button" href={`/${locale}/exams?view=analysis&exam=${selectedExam.id}`}>{c.analysis}</Link>:null}{availability?.exportResults?<Link className="action-button" href={`/${locale}/exams?view=export&exam=${selectedExam.id}`}>{c.export}</Link>:null}</div></section>:null;
  return <div className={shellClass}><section className="page-heading" data-page-section><div><p className="state-kicker">{t.kicker}</p><h1>{t.title}</h1><p>{t.body}</p></div></section>{emptyState}{selectedContext}<ExamsResultsV2Hub locale={locale} data={data} view={view}/></div>;
}
