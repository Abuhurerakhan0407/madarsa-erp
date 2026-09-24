import Link from "next/link";
import type {SupportedLocale} from "@/lib/i18n/config";
import {AttendanceV2Workspace} from "@/components/attendance-v2-workspace";
import {getAttendanceWorkspace,getDefaultAttendanceDate} from "@/lib/attendance/workspace";
import {validateAttendanceDate} from "@/lib/attendance/model";

const copy={
 en:{kicker:"Attendance V2",title:"Attendance & Biometrics",body:"Biometric-first daily attendance with device-source visibility, trends, governed corrections, and temporary audited emergency manual windows.",students:"Students",teachers:"Teachers",config:"Attendance device configuration",export:"Export CSV",reports:"Reports & Analytics"},
 ur:{kicker:"حاضری V2",title:"حاضری و بایومیٹرکس",body:"ڈیوائس سورس، رجحانات، محفوظ اصلاحات اور آڈٹ شدہ عارضی ہنگامی دستی ونڈوز کے ساتھ بایومیٹرک فرسٹ حاضری۔",students:"طلبہ",teachers:"اساتذہ",config:"حاضری ڈیوائس کنفیگریشن",export:"CSV ایکسپورٹ",reports:"رپورٹس و تجزیات"}
} as const;

export default async function AttendancePage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{date?:string;q?:string;page?:string}>}){
 const{locale:raw}=await params;const query=await searchParams;const locale:SupportedLocale=raw==="ur"?"ur":"en";const defaultDate=await getDefaultAttendanceDate();const date=validateAttendanceDate(query.date)??defaultDate;const search=(query.q??"").trim().slice(0,160);const page=Math.max(1,Math.min(Number(query.page)||1,100000));const data=await getAttendanceWorkspace({date,search,page,pageSize:50,locale});const t=copy[locale];
 return <>
  <section className="page-heading" data-page-section><div><p className="state-kicker">{t.kicker}</p><h1>{t.title}</h1><p>{t.body}</p></div><time dateTime={date}>{date}</time></section>
  <nav className="quick-actions attendance-page-actions" aria-label="Attendance audience and exports" data-page-section>
   <span className="action-button action-button-primary" aria-current="page">{t.students}</span>
   {data.capabilities.canViewStaff?<Link className="secondary-button" href={`/${locale}/staff/attendance?date=${encodeURIComponent(date)}`}>{t.teachers}</Link>:null}
   <a className="secondary-button" href={`/api/attendance/export?date=${encodeURIComponent(date)}&locale=${locale}`} download>{t.export}</a>
   <Link className="secondary-button" href={`/${locale}/reports`}>{t.reports}</Link>
   {data.emergency.canManage?<Link className="secondary-button" href={`/${locale}/settings/configuration/attendance-devices`}>{t.config}</Link>:null}
  </nav>
  <AttendanceV2Workspace locale={locale} data={data} search={search}/>
 </>;
}
