import Link from "next/link";
import type {Locale} from "@/lib/i18n/config";
import {ExamsResultsV2Hub,type ExamsV2View} from "@/components/exams-results-v2-hub";
import {InlineState} from "@/components/workspace-ui";
import {examsCopy} from "@/lib/exams/copy";
import {getExamWorkspace} from "@/lib/exams/workspace";

const views=new Set<ExamsV2View>(["home","create","marks","results","reports","export","analysis"]);
const emptyCopy={
 en:{missing:"No class is ready for exams",missingBody:"Complete the academic year, program and class first. Exams use those same governed academic records.",setup:"Complete institution setup",none:"No exams yet",noneBody:"Create the first exam for an active class, then enter marks from the same workspace.",create:"Create first exam",readonly:"No exams are available yet",readonlyBody:"An office administrator with exam setup permission must create the first exam."},
 ur:{missing:"امتحان کے لیے ابھی کوئی کلاس تیار نہیں",missingBody:"پہلے تعلیمی سال، پروگرام اور کلاس مکمل کریں۔ امتحان انہی محفوظ اکیڈمک ریکارڈز کو استعمال کرتا ہے۔",setup:"ادارے کا سیٹ اپ مکمل کریں",none:"ابھی کوئی امتحان نہیں",noneBody:"فعال کلاس کے لیے پہلا امتحان بنائیں، پھر اسی ورک اسپیس سے نمبر درج کریں۔",create:"پہلا امتحان بنائیں",readonly:"ابھی کوئی امتحان دستیاب نہیں",readonlyBody:"امتحان بنانے کی اجازت رکھنے والا دفتری منتظم پہلا امتحان بنائے گا۔"},
 ar:{missing:"لا يوجد فصل جاهز للاختبارات",missingBody:"أكمل العام الدراسي والبرنامج والفصل أولاً. تستخدم الاختبارات نفس السجلات الأكاديمية المحكومة.",setup:"إكمال إعداد المؤسسة",none:"لا توجد اختبارات بعد",noneBody:"أنشئ أول اختبار لفصل نشط ثم أدخل الدرجات من نفس مساحة العمل.",create:"إنشاء أول اختبار",readonly:"لا توجد اختبارات متاحة بعد",readonlyBody:"يجب على مسؤول المكتب الذي لديه صلاحية إعداد الاختبارات إنشاء أول اختبار."}
} as const;

export default async function ExamsPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{view?:string;exam?:string}>}){
  const {locale:rawLocale}=await params;const locale=(rawLocale==="ur"||rawLocale==="ar"?rawLocale:"en") as Locale;const t=examsCopy[locale];const e=emptyCopy[locale];
  const search=await searchParams;const requestedView=typeof search.view==="string"?search.view:"home";const view=(views.has(requestedView as ExamsV2View)?requestedView:"home") as ExamsV2View;
  const examId=Number(search.exam);const selectedExamId=Number.isInteger(examId)&&examId>0?examId:null;const data=await getExamWorkspace({examSeriesId:selectedExamId});
  const empty=data.exams.length===0;
  const emptyState=empty?(data.setup.groups.length===0?<InlineState title={e.missing} body={e.missingBody} action={<Link className="action-button action-button-primary" href={`/${locale}/setup`}>{e.setup}</Link>}/>:data.setup.canCreate?<InlineState title={e.none} body={e.noneBody} action={<Link className="action-button action-button-primary" href={`/${locale}/exams?view=create`}>{e.create}</Link>}/>:<InlineState title={e.readonly} body={e.readonlyBody}/>):null;
  return <><section className="page-heading" data-page-section><div><p className="state-kicker">{t.kicker}</p><h1>{t.title}</h1><p>{t.body}</p></div></section>{emptyState}<ExamsResultsV2Hub locale={locale} data={data} view={view}/></>;
}
