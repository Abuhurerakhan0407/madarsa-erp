"use client";

import {useRouter} from "next/navigation";
import {useState} from "react";
import type {SupportedLocale} from "@/lib/i18n/config";
import type {TeacherRow} from "@/lib/teachers/workspace";

const copy={
 en:{kicker:"Safe profile edit",title:"Edit teacher",body:"Payroll, contract and private HR fields are intentionally not exposed here.",name:"Name",native:"Name in Urdu",email:"Email",phone:"Phone",designation:"Designation",joined:"Joining date",save:"Save teacher",saving:"Saving…",success:"Teacher profile updated.",error:"Unable to update teacher."},
 ur:{kicker:"محفوظ پروفائل ترمیم",title:"استاد کی معلومات میں ترمیم",body:"تنخواہ، معاہدہ اور نجی HR معلومات جان بوجھ کر یہاں ظاہر نہیں کی جاتیں۔",name:"نام",native:"اردو نام",email:"ای میل",phone:"فون",designation:"عہدہ",joined:"تاریخ شمولیت",save:"استاد کی معلومات محفوظ کریں",saving:"محفوظ ہو رہا ہے…",success:"استاد کی معلومات اپ ڈیٹ ہو گئیں۔",error:"استاد کی معلومات اپ ڈیٹ نہیں ہو سکیں۔"}
} as const;

export function TeacherProfileForm({teacher,locale="en"}:{teacher:TeacherRow;locale?:SupportedLocale}){
 const router=useRouter();const[busy,setBusy]=useState(false);const[error,setError]=useState<string|null>(null);const[ok,setOk]=useState(false);const text=copy[locale];
 async function submit(form:HTMLFormElement){
  if(busy)return;
  setBusy(true);setError(null);setOk(false);const fd=new FormData(form);
  try{
   const response=await fetch("/api/teachers/update",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({employmentId:teacher.employmentId,displayName:String(fd.get("displayName")||""),nameNative:String(fd.get("nameNative")||""),email:String(fd.get("email")||""),phone:String(fd.get("phone")||""),designation:String(fd.get("designation")||""),joinedOn:String(fd.get("joinedOn")||"")})});
   const payload=await response.json().catch(()=>({})) as {error?:string};
   if(!response.ok){setError(locale==="ur"?text.error:(payload.error||text.error));return;}
   setOk(true);router.refresh();
  }catch{setError(text.error);}finally{setBusy(false);}
 }
 return <form className="professional-card flow-form" aria-busy={busy||undefined} onSubmit={e=>{e.preventDefault();void submit(e.currentTarget);}}>
  <div><p className="state-kicker">{text.kicker}</p><h2>{text.title}</h2><p>{text.body}</p></div>
  {error?<p className="form-message form-error" role="alert">{error}</p>:null}
  {ok?<p className="form-message" role="status">{text.success}</p>:null}
  <div className="form-grid">
   <label className="field-label">{text.name}<input className="text-field" name="displayName" required minLength={2} maxLength={160} defaultValue={teacher.displayName} disabled={busy}/></label>
   <label className="field-label">{text.native}<input className="text-field" name="nameNative" maxLength={160} dir="auto" defaultValue={teacher.nameNative??""} disabled={busy}/></label>
   <label className="field-label">{text.email}<input className="text-field" type="email" name="email" maxLength={320} defaultValue={teacher.email??""} disabled={busy}/></label>
   <label className="field-label">{text.phone}<input className="text-field" name="phone" maxLength={40} defaultValue={teacher.phone??""} disabled={busy}/></label>
   <label className="field-label">{text.designation}<input className="text-field" name="designation" required minLength={1} maxLength={120} defaultValue={teacher.designation} disabled={busy}/></label>
   <label className="field-label">{text.joined}<input className="text-field" type="date" name="joinedOn" required defaultValue={teacher.joinedOn} disabled={busy}/></label>
  </div>
  <button className="action-button action-button-primary" disabled={busy} aria-busy={busy||undefined}>{busy?<><span className="inline-spinner" aria-hidden="true"/>{text.saving}</>:text.save}</button>
 </form>;
}
