"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { quranCopy, quranOutcomeLabel, quranWorkLabel } from "@/lib/quran/copy";

const mistakeCategories=["makhraj","madd","ghunnah","waqf","ikhfa","qalqalah"] as const;
type Mode="juz"|"ayah"|"page";
type Props={locale:Locale;personId:number;studentName:string;studentNumber:string;onSaved:()=>void;onCancel:()=>void};

export function QuranEntryForm({locale,personId,studentName,studentNumber,onSaved,onCancel}:Props){
  const t=quranCopy[locale];
  const [workCategory,setWorkCategory]=useState("sabaq");
  const [mode,setMode]=useState<Mode>("juz");
  const [juz,setJuz]=useState("30");
  const [range,setRange]=useState({startSurah:"",startAyah:"",endSurah:"",endAyah:"",pageStart:"",pageEnd:""});
  const [scores,setScores]=useState({accuracy:"",fluency:"",tajweed:"",overall:"",prompts:"0"});
  const [outcome,setOutcome]=useState("passed");
  const [notes,setNotes]=useState({teacher:"",parent:"",private:""});
  const [mistakes,setMistakes]=useState<Record<string,string>>(Object.fromEntries(mistakeCategories.map(k=>[k,"0"])));
  const [requestKey,setRequestKey]=useState("");
  const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);

  function stableRequestKey(){
    if(requestKey)return requestKey;
    const generated=globalThis.crypto?.randomUUID?.() ?? `quran-${personId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setRequestKey(generated);return generated;
  }

  async function submit(){
    setBusy(true);setError(null);
    try{
      const body:any={requestKey:stableRequestKey(),personId,workCategory,targetMode:mode,outcome,accuracyScore:scores.accuracy,fluencyScore:scores.fluency,tajweedScore:scores.tajweed,overallScore:scores.overall,prompts:scores.prompts,teacherRemark:notes.teacher,parentVisibleRemark:notes.parent,privateNote:notes.private,mistakes:mistakeCategories.flatMap(category=>{const count=Number(mistakes[category]||0);return count>0?[{category,severity:count>=4?3:2,count}]:[];})};
      if(mode==="juz")body.juzNumber=juz;
      if(mode==="ayah")Object.assign(body,{startSurahNumber:range.startSurah,startAyahNumber:range.startAyah,endSurahNumber:range.endSurah,endAyahNumber:range.endAyah});
      if(mode==="page")Object.assign(body,{pageStart:range.pageStart,pageEnd:range.pageEnd});
      const response=await fetch("/api/quran/record",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      const payload=await response.json().catch(()=>({})) as {error?:string};
      if(!response.ok){setError(payload.error||t.error);return;}
      onSaved();
    }catch{setError(t.error);}finally{setBusy(false);}
  }

  return <div className="quran-entry-form">
    <div className="quran-form-heading"><div><p className="state-kicker">{studentNumber}</p><h3>{studentName}</h3></div><button className="action-button" type="button" onClick={onCancel}>{t.cancel}</button></div>
    {error?<p className="form-message form-error" role="alert">{error}</p>:null}
    <div className="quran-form-grid">
      <label className="field-label">{t.latest}<select className="text-field" value={workCategory} onChange={e=>setWorkCategory(e.target.value)}>{["sabaq","sabqi","manzil","nazra","qaida","tajweed"].map(k=><option key={k} value={k}>{quranWorkLabel(k,t)}</option>)}</select></label>
      <label className="field-label">{t.target}<select className="text-field" value={mode} onChange={e=>setMode(e.target.value as Mode)}><option value="juz">{t.juz}</option><option value="ayah">{t.ayah}</option><option value="page">{t.page}</option></select></label>
      {mode==="juz"?<label className="field-label">{t.juz}<select className="text-field" value={juz} onChange={e=>setJuz(e.target.value)}>{Array.from({length:30},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></label>:null}
      {mode==="ayah"?<><label className="field-label">{t.from} · {t.surah}<input className="text-field" type="number" min="1" max="114" value={range.startSurah} onChange={e=>setRange(v=>({...v,startSurah:e.target.value}))}/></label><label className="field-label">{t.from} · {t.ayahNo}<input className="text-field" type="number" min="1" value={range.startAyah} onChange={e=>setRange(v=>({...v,startAyah:e.target.value}))}/></label><label className="field-label">{t.to} · {t.surah}<input className="text-field" type="number" min="1" max="114" value={range.endSurah} onChange={e=>setRange(v=>({...v,endSurah:e.target.value}))}/></label><label className="field-label">{t.to} · {t.ayahNo}<input className="text-field" type="number" min="1" value={range.endAyah} onChange={e=>setRange(v=>({...v,endAyah:e.target.value}))}/></label></>:null}
      {mode==="page"?<><label className="field-label">{t.from} · {t.pageNo}<input className="text-field" type="number" min="1" max="604" value={range.pageStart} onChange={e=>setRange(v=>({...v,pageStart:e.target.value}))}/></label><label className="field-label">{t.to} · {t.pageNo}<input className="text-field" type="number" min="1" max="604" value={range.pageEnd} onChange={e=>setRange(v=>({...v,pageEnd:e.target.value}))}/></label></>:null}
      {(["accuracy","fluency","tajweed","overall"] as const).map(key=><label className="field-label" key={key}>{key==="accuracy"?t.accuracy:key==="fluency"?t.fluency:key==="tajweed"?t.tajweedScore:t.overall}<input className="text-field" type="number" min="0" max="100" value={scores[key]} onChange={e=>setScores(v=>({...v,[key]:e.target.value}))}/></label>)}
      <label className="field-label">{t.prompts}<input className="text-field" type="number" min="0" value={scores.prompts} onChange={e=>setScores(v=>({...v,prompts:e.target.value}))}/></label>
      <label className="field-label">{t.outcome}<select className="text-field" value={outcome} onChange={e=>setOutcome(e.target.value)}>{["passed","partial","repeat","excused","not_attempted"].map(k=><option key={k} value={k}>{quranOutcomeLabel(k,t)}</option>)}</select></label>
    </div>
    <fieldset className="quran-mistakes"><legend>{t.mistakes}</legend>{mistakeCategories.map(category=><label key={category}><span>{category}</span><input type="number" min="0" max="99" value={mistakes[category]} onChange={e=>setMistakes(v=>({...v,[category]:e.target.value}))}/></label>)}</fieldset>
    <div className="quran-notes-grid"><label className="field-label">{t.teacherRemark}<textarea className="text-field" rows={3} maxLength={1000} value={notes.teacher} onChange={e=>setNotes(v=>({...v,teacher:e.target.value}))}/></label><label className="field-label">{t.parentRemark}<textarea className="text-field" rows={3} maxLength={1000} value={notes.parent} onChange={e=>setNotes(v=>({...v,parent:e.target.value}))}/></label><label className="field-label">{t.privateNote}<textarea className="text-field" rows={3} maxLength={1000} value={notes.private} onChange={e=>setNotes(v=>({...v,private:e.target.value}))}/></label></div>
    <div className="quran-form-actions"><button className="action-button action-button-primary" type="button" disabled={busy} onClick={submit}>{busy?t.saving:t.save}</button><button className="action-button" type="button" disabled={busy} onClick={onCancel}>{t.cancel}</button></div>
  </div>;
}
