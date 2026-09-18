"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import { quranCopy, quranOutcomeLabel } from "@/lib/quran/copy";

type Attempt={id:number;outcome:string;accuracy:number|null;fluency:number|null;tajweed:number|null;overall:number|null;prompts:number|null;teacherRemark:string|null;parentRemark:string|null;privateNote:string|null;targetLabel:string};
type Props={locale:SupportedLocale;attempt:Attempt};

const extra={
  en:{open:"Correct record",title:"Correct recitation record",reason:"Correction reason",reasonHint:"Explain what was wrong and what was verified.",save:"Save correction",saving:"Saving…",cancel:"Cancel",notice:"The original record stays unchanged. This correction becomes the effective evaluation and is added to the audit trail.",failed:"Unable to save correction."},
  ur:{open:"ریکارڈ درست کریں",title:"تلاوت ریکارڈ کی اصلاح",reason:"اصلاح کی وجہ",reasonHint:"بتائیں کیا غلط تھا اور کس بنیاد پر تصدیق ہوئی۔",save:"اصلاح محفوظ کریں",saving:"محفوظ ہو رہا ہے…",cancel:"منسوخ",notice:"اصل ریکارڈ تبدیل نہیں ہوگا۔ یہ اصلاح مؤثر تشخیص بنے گی اور آڈٹ ٹریل میں محفوظ ہوگی۔",failed:"اصلاح محفوظ نہیں ہو سکی۔"}
} as const;

export function QuranCorrectionControl({locale,attempt}:Props){
  const router=useRouter();const t=quranCopy[locale];const x=extra[locale];
  const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);const [requestKey,setRequestKey]=useState("");
  const [scores,setScores]=useState({accuracy:attempt.accuracy?.toString()??"",fluency:attempt.fluency?.toString()??"",tajweed:attempt.tajweed?.toString()??"",overall:attempt.overall?.toString()??"",prompts:attempt.prompts?.toString()??""});
  const [outcome,setOutcome]=useState(attempt.outcome);const [reason,setReason]=useState("");
  const [notes,setNotes]=useState({teacher:attempt.teacherRemark??"",parent:attempt.parentRemark??"",private:attempt.privateNote??""});
  function stableKey(){if(requestKey)return requestKey;const key=globalThis.crypto?.randomUUID?.()??`quran-correction-${attempt.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;setRequestKey(key);return key;}
  async function submit(){setBusy(true);setError(null);try{
    const body={requestKey:stableKey(),attemptId:attempt.id,reason,accuracyScore:scores.accuracy,fluencyScore:scores.fluency,tajweedScore:scores.tajweed,overallScore:scores.overall,prompts:scores.prompts,outcome,teacherRemark:notes.teacher,parentVisibleRemark:notes.parent,privateNote:notes.private};
    const response=await fetch("/api/quran/correct",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const payload=await response.json().catch(()=>({})) as {error?:string};
    if(!response.ok){setError(payload.error||x.failed);return;}setOpen(false);router.refresh();
  }catch{setError(x.failed);}finally{setBusy(false);}}
  if(!open)return <button className="action-button quran-correct-trigger no-print" type="button" onClick={()=>setOpen(true)}>{x.open}</button>;
  return <div className="quran-correction-panel no-print">
    <div className="quran-form-heading"><div><p className="state-kicker">{attempt.targetLabel}</p><h3>{x.title}</h3></div><button className="action-button" type="button" disabled={busy} onClick={()=>setOpen(false)}>{x.cancel}</button></div>
    <p className="quran-correction-notice">{x.notice}</p>{error?<p className="form-message form-error" role="alert">{error}</p>:null}
    <div className="quran-form-grid">{(["accuracy","fluency","tajweed","overall"] as const).map(key=><label className="field-label" key={key}>{key==="accuracy"?t.accuracy:key==="fluency"?t.fluency:key==="tajweed"?t.tajweedScore:t.overall}<input className="text-field" type="number" min="0" max="100" value={scores[key]} onChange={e=>setScores(v=>({...v,[key]:e.target.value}))}/></label>)}
      <label className="field-label">{t.prompts}<input className="text-field" type="number" min="0" max="999" value={scores.prompts} onChange={e=>setScores(v=>({...v,prompts:e.target.value}))}/></label>
      <label className="field-label">{t.outcome}<select className="text-field" value={outcome} onChange={e=>setOutcome(e.target.value)}>{["passed","partial","repeat","excused","not_attempted"].map(value=><option value={value} key={value}>{quranOutcomeLabel(value,t)}</option>)}</select></label>
    </div>
    <label className="field-label">{x.reason}<textarea className="text-field" rows={3} minLength={5} maxLength={500} required placeholder={x.reasonHint} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <div className="quran-notes-grid"><label className="field-label">{t.teacherRemark}<textarea className="text-field" rows={3} maxLength={1000} value={notes.teacher} onChange={e=>setNotes(v=>({...v,teacher:e.target.value}))}/></label><label className="field-label">{t.parentRemark}<textarea className="text-field" rows={3} maxLength={1000} value={notes.parent} onChange={e=>setNotes(v=>({...v,parent:e.target.value}))}/></label><label className="field-label">{t.privateNote}<textarea className="text-field" rows={3} maxLength={1000} value={notes.private} onChange={e=>setNotes(v=>({...v,private:e.target.value}))}/></label></div>
    <div className="quran-form-actions"><button className="action-button action-button-primary" type="button" disabled={busy||reason.trim().length<5} onClick={submit}>{busy?x.saving:x.save}</button><button className="action-button" type="button" disabled={busy} onClick={()=>setOpen(false)}>{x.cancel}</button></div>
  </div>;
}
