import Link from "next/link";
import type {Metadata} from "next";
import type {Locale} from "@/lib/i18n/config";
import {getTeachersWorkspace} from "@/lib/teachers/workspace";
import {TeachersWorkspaceView} from "@/components/teachers-workspace";
import {InlineState,WorkspacePageHeader} from "@/components/workspace-ui";

export const metadata:Metadata={title:"Teachers | Ilmgaah"};

const copy={
 en:{eyebrow:"Teachers",title:"Teacher workspace",body:"Manage the teaching staff who deliver classes and daily learning work.",empty:"No teachers yet",emptyBody:"Add the first teacher so classes, attendance and teaching assignments can be connected to a real staff record.",add:"Add first teacher",filtered:"No teachers match these filters",clear:"Clear filters"},
 ur:{eyebrow:"اساتذہ",title:"اساتذہ ورک اسپیس",body:"کلاسیں اور روزانہ تدریسی کام کرنے والے اساتذہ کا انتظام کریں۔",empty:"ابھی کوئی استاد نہیں",emptyBody:"پہلا استاد شامل کریں تاکہ کلاس، حاضری اور تدریسی اسائنمنٹس حقیقی اسٹاف ریکارڈ سے منسلک ہوں۔",add:"پہلا استاد شامل کریں",filtered:"ان فلٹرز میں کوئی استاد نہیں ملا",clear:"فلٹر ختم کریں"},
 ar:{eyebrow:"المعلمون",title:"مساحة المعلمين",body:"أدر طاقم التدريس الذي يقدم الفصول والعمل التعليمي اليومي.",empty:"لا يوجد معلمون بعد",emptyBody:"أضف أول معلم لربط الفصول والحضور والتكليفات التعليمية بسجل موظف فعلي.",add:"إضافة أول معلم",filtered:"لا يوجد معلمون مطابقون لهذه التصفية",clear:"مسح التصفية"}
} as const;

export default async function StaffPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{q?:string;state?:string}>}){
 const {locale:raw}=await params;const query=await searchParams;const locale=(raw==="ur"||raw==="ar"?raw:"en") as Locale;const search=(query.q??"").trim().slice(0,160);const state=["active","on_leave","suspended"].includes(query.state??"")?query.state??"":"";const data=await getTeachersWorkspace({search,state});const t=copy[locale];const filtered=Boolean(search||state);
 if(data.teachers.length===0)return <><WorkspacePageHeader eyebrow={t.eyebrow} title={t.title} description={t.body}/><InlineState title={filtered?t.filtered:t.empty} body={filtered?t.clear:t.emptyBody} action={filtered?<Link className="action-button" href={`/${locale}/staff`}>{t.clear}</Link>:data.canManage?<Link className="action-button action-button-primary" href={`/${locale}/staff/new`}>{t.add}</Link>:undefined}/></>;
 return <TeachersWorkspaceView locale={locale} data={data} search={search} state={state}/>;
}
