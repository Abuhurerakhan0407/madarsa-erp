import Link from "next/link";
import type {Locale} from "@/lib/i18n/config";
import {AttendanceV2Workspace} from "@/components/attendance-v2-workspace";
import {InlineState} from "@/components/workspace-ui";
import {getAttendanceWorkspace,getDefaultAttendanceDate} from "@/lib/attendance/workspace";
import {validateAttendanceDate} from "@/lib/attendance/model";

const copy={
 en:{kicker:"Daily attendance",title:"Mark Attendance",body:"Choose a class, mark everyone present, change only the exceptions, then save.",students:"Students",teachers:"Teachers",config:"Attendance devices",empty:"No classes are ready for attendance",emptyBody:"Create an academic year and class, then enroll students before starting daily attendance.",setup:"Complete institution setup"},
 ur:{kicker:"روزانہ حاضری",title:"حاضری درج کریں",body:"کلاس منتخب کریں، سب کو حاضر نشان لگائیں، صرف مستثنیٰ طلبہ تبدیل کریں، پھر محفوظ کریں۔",students:"طلبہ",teachers:"اساتذہ",config:"حاضری ڈیوائسز",empty:"حاضری کے لیے ابھی کوئی کلاس تیار نہیں",emptyBody:"روزانہ حاضری شروع کرنے سے پہلے تعلیمی سال اور کلاس بنائیں اور طلبہ شامل کریں۔",setup:"ادارے کا سیٹ اپ مکمل کریں"},
 ar:{kicker:"الحضور اليومي",title:"تسجيل الحضور",body:"اختر الفصل، علّم الجميع حاضرين، غيّر الاستثناءات فقط، ثم احفظ.",students:"الطلاب",teachers:"المعلمون",config:"أجهزة الحضور",empty:"لا توجد فصول جاهزة للحضور",emptyBody:"أنشئ العام الدراسي والفصل ثم سجّل الطلاب قبل بدء الحضور اليومي.",setup:"إكمال إعداد المؤسسة"}
} as const;

function positive(value:unknown):number|null{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:null;}

export default async function AttendancePage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{date?:string;group?:string;q?:string;page?:string}>}){
 const{locale:raw}=await params;const query=await searchParams;const locale=(raw==="ur"||raw==="ar"?raw:"en") as Locale;const defaultDate=await getDefaultAttendanceDate();const date=validateAttendanceDate(query.date)??defaultDate;const groupId=positive(query.group);const search=(query.q??"").trim().slice(0,160);const page=Math.max(1,Math.min(Number(query.page)||1,100000));const data=await getAttendanceWorkspace({date,groupId,search,page,pageSize:100,locale});const t=copy[locale];
 return <>
  <section className="page-heading" data-page-section><div><p className="state-kicker">{t.kicker}</p><h1>{t.title}</h1><p>{t.body}</p></div><time dateTime={date}>{date}</time></section>
  <nav className="quick-actions" aria-label="Attendance audience" data-page-section><span className="action-button action-button-primary" aria-current="page">{t.students}</span>{data.capabilities.canViewStaff?<Link className="secondary-button" href={`/${locale}/staff/attendance?date=${encodeURIComponent(date)}`}>{t.teachers}</Link>:null}{data.emergency.canManage?<Link className="secondary-button" href={`/${locale}/settings/configuration/attendance-devices`}>{t.config}</Link>:null}</nav>
  {data.groups.length===0?<InlineState title={t.empty} body={t.emptyBody} action={<Link className="action-button action-button-primary" href={`/${locale}/setup`}>{t.setup}</Link>}/>:<AttendanceV2Workspace locale={locale} data={data} search={search}/>} 
 </>;
}
