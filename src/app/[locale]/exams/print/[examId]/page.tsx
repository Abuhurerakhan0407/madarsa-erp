import Link from "next/link";
import {PrintAction} from "@/components/print-action";
import type {Locale} from "@/lib/i18n/config";
import {examStateLabel,examsCopy} from "@/lib/exams/copy";
import {getExamWorkspace} from "@/lib/exams/workspace";

const copy={
 en:{kicker:"Bulk Print / Export",title:"Exam result register",back:"Back to exam",print:"Print / Save PDF",number:"Student number",student:"Student",percentage:"Percentage",result:"Result",grade:"Grade",rank:"Rank",unavailable:"Results unavailable",missingExam:"This exam is not available in the active branch.",marksOpen:"Marks are still open. Complete the marks workflow and calculate results before opening this register.",pending:"A calculated result register is not available for this exam state yet."},
 ur:{kicker:"بلک پرنٹ / ایکسپورٹ",title:"امتحانی نتیجہ رجسٹر",back:"امتحان پر واپس",print:"پرنٹ / PDF محفوظ کریں",number:"طالب علم نمبر",student:"طالب علم",percentage:"فیصد",result:"نتیجہ",grade:"گریڈ",rank:"درجہ",unavailable:"نتائج دستیاب نہیں",missingExam:"یہ امتحان فعال برانچ میں دستیاب نہیں ہے۔",marksOpen:"نمبر ابھی کھلے ہیں۔ یہ رجسٹر کھولنے سے پہلے نمبر مکمل کر کے نتائج بنائیں۔",pending:"اس امتحانی حالت کے لیے حساب شدہ نتیجہ رجسٹر ابھی دستیاب نہیں ہے۔"},
 ar:{kicker:"طباعة / تصدير جماعي",title:"سجل نتائج الاختبار",back:"العودة إلى الاختبار",print:"طباعة / حفظ PDF",number:"رقم الطالب",student:"الطالب",percentage:"النسبة",result:"النتيجة",grade:"التقدير",rank:"الترتيب",unavailable:"النتائج غير متاحة",missingExam:"هذا الاختبار غير متاح في الفرع النشط.",marksOpen:"الدرجات ما زالت مفتوحة. أكمل إدخال الدرجات واحسب النتائج قبل فتح هذا السجل.",pending:"لا يتوفر سجل نتائج محسوب لهذه الحالة بعد."}
} as const;
const resultValue:Record<Locale,Record<string,string>>={
 en:{pass:"Pass",fail:"Fail",incomplete:"Incomplete",withheld:"Withheld",exempt:"Exempt"},
 ur:{pass:"کامیاب",fail:"ناکام",incomplete:"نامکمل",withheld:"روکا گیا",exempt:"مستثنیٰ"},
 ar:{pass:"ناجح",fail:"راسب",incomplete:"غير مكتمل",withheld:"محجوب",exempt:"معفى"}
};
function resultLabel(value:string,locale:Locale){return resultValue[locale][value]??value.replaceAll('_',' ');}

export default async function ExamBulkPrintPage({params}:{params:Promise<{locale:string;examId:string}>}){
 const{locale:raw,examId:rawId}=await params;const locale=(raw==="ur"||raw==="ar"?raw:"en") as Locale;const t=copy[locale];const examId=Number(rawId);const data=Number.isInteger(examId)&&examId>0?await getExamWorkspace({examSeriesId:examId}):null;
 if(!data?.exam)return <section className="panel report-card-empty"><h1>{t.unavailable}</h1><p>{t.missingExam}</p><Link className="action-button" href={`/${locale}/exams`}>{t.back}</Link></section>;
 if(!data.analysis?.available){const reason=data.exam.state==="marks_open"?t.marksOpen:t.pending;return <section className="panel report-card-empty"><p className="state-kicker">{examStateLabel(data.exam.state,examsCopy[locale])}</p><h1>{t.unavailable}</h1><p>{data.exam.label} · {data.exam.startsOn} → {data.exam.endsOn}</p><p>{reason}</p><Link className="action-button" href={`/${locale}/exams?view=results&exam=${data.exam.id}`}>{t.back}</Link></section>;}
 return <div className="report-card-page"><div className="report-card-actions"><Link className="action-button" href={`/${locale}/exams?view=export&exam=${examId}`}>{t.back}</Link><PrintAction label={t.print}/></div><article className="report-card-sheet"><header className="report-card-header"><div><p className="state-kicker">{t.kicker}</p><h1>{data.exam.label}</h1><p>{data.exam.sessionLabel} · {data.exam.programLabel} · {data.exam.groupLabel??"—"}</p></div><div className="report-card-grade"><span>{examsCopy[locale].average}</span><strong>{data.analysis.summary.average??"—"}%</strong></div></header><table className="report-card-table"><thead><tr><th>{t.number}</th><th>{t.student}</th><th>{t.percentage}</th><th>{t.result}</th><th>{t.grade}</th>{data.exam.rankingEnabled?<th>{t.rank}</th>:null}</tr></thead><tbody>{data.analysis.students.map(student=><tr key={student.studentPersonId}><td data-label={t.number}>{student.studentNumber}</td><td data-label={t.student}>{student.studentName}</td><td data-label={t.percentage}>{student.percentage===null?"—":`${student.percentage}%`}</td><td data-label={t.result}>{resultLabel(student.aggregateStatus,locale)}</td><td data-label={t.grade}>{student.gradeKey??"—"}</td>{data.exam?.rankingEnabled?<td data-label={t.rank}>{student.rankValue??"—"}</td>:null}</tr>)}</tbody></table></article></div>;
}
