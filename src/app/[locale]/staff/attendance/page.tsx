import Link from "next/link";
import type {Locale} from "@/lib/i18n/config";
import {getHrAttendance} from "@/lib/hr/workspace";
import {HrAttendanceV2Workspace} from "@/components/hr-attendance-v2-workspace";

const copy={en:{kicker:"Attendance V2",title:"Teacher Attendance",body:"Biometric-first teacher/staff attendance. Manual controls appear only inside audited emergency windows.",students:"Students",teachers:"Teachers",date:"Attendance date"},ur:{kicker:"حاضری V2",title:"اساتذہ کی حاضری",body:"بایومیٹرک فرسٹ اساتذہ/عملہ حاضری۔ دستی کنٹرول صرف آڈٹ شدہ ہنگامی ونڈو میں ظاہر ہوتے ہیں۔",students:"طلبہ",teachers:"اساتذہ",date:"حاضری کی تاریخ"},ar:{kicker:"الحضور V2",title:"حضور المعلمين",body:"حضور المعلمين/الموظفين يعتمد على البيومتري. تظهر الأدوات اليدوية فقط داخل نافذة طارئة مدققة.",students:"الطلاب",teachers:"المعلمون",date:"تاريخ الحضور"}} as const;

export default async function StaffAttendancePage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{date?:string;q?:string}>}){const{locale:raw}=await params;const query=await searchParams;const locale=(raw==="ur"||raw==="ar"?raw:"en") as Locale;const date=/^\d{4}-\d{2}-\d{2}$/.test(query.date??"")?query.date:undefined;const data=await getHrAttendance({date,search:(query.q??"").trim().slice(0,160)});const t=copy[locale];return <>
 <section className="page-heading" data-page-section><div><p className="state-kicker">{t.kicker}</p><h1>{t.title}</h1><p>{t.body}</p></div><form><label className="field-label">{t.date}<input className="text-field" type="date" name="date" defaultValue={data.date}/></label><button className="action-button" type="submit">Go</button></form></section>
 <nav className="quick-actions" aria-label="Attendance audience" data-page-section><Link className="secondary-button" href={`/${locale}/attendance?date=${encodeURIComponent(data.date)}`}>{t.students}</Link><span className="action-button action-button-primary" aria-current="page">{t.teachers}</span></nav>
 <HrAttendanceV2Workspace locale={locale} data={data}/>
 </>;}
