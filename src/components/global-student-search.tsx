"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect,useRef,useState } from "react";
import type { Locale } from "@/lib/i18n/config";

type Result={personId:number;name:string;nativeName:string|null;studentNumber:string;status:string;program:string;group:string};
const copy={
 en:{label:"Find student",placeholder:"Name, student/admission no. or guardian phone",empty:"No matching students",loading:"Searching…"},
 ur:{label:"طالب علم تلاش کریں",placeholder:"نام، طالب علم/داخلہ نمبر یا سرپرست فون",empty:"کوئی طالب علم نہیں ملا",loading:"تلاش جاری ہے…"},
 ar:{label:"البحث عن طالب",placeholder:"الاسم أو رقم الطالب/القبول أو هاتف ولي الأمر",empty:"لا يوجد طالب مطابق",loading:"جارٍ البحث…"}
} as const;

export function GlobalStudentSearch({locale}:{locale:Locale}){
 const t=copy[locale],box=useRef<HTMLDivElement>(null);const router=useRouter();const[q,setQ]=useState("");const[results,setResults]=useState<Result[]>([]);const[busy,setBusy]=useState(false);const[open,setOpen]=useState(false);const[activeIndex,setActiveIndex]=useState<number>(-1);
 useEffect(()=>{const onPointer=(e:PointerEvent)=>{if(box.current&&!box.current.contains(e.target as Node))setOpen(false)};document.addEventListener("pointerdown",onPointer);return()=>document.removeEventListener("pointerdown",onPointer)},[]);
 useEffect(()=>{
   const value=q.trim();
   if(value.length<2){
     // defer to avoid cascading render warning
     const t = window.setTimeout(()=>{setResults([]);setOpen(false);setActiveIndex(-1);},0);
     return ()=> window.clearTimeout(t);
   }
   const controller=new AbortController();
   const timer=window.setTimeout(async()=>{setBusy(true);try{const response=await fetch(`/api/students/search?q=${encodeURIComponent(value)}&locale=${locale}`,{signal:controller.signal,cache:"no-store"});const json=await response.json();const nextResults=response.ok&&Array.isArray(json.results)?json.results as Result[]:[];setResults(nextResults);setOpen(true);setActiveIndex(nextResults.length?0:-1)}catch(e){if((e as Error).name!=="AbortError"){setResults([]);setActiveIndex(-1)}}finally{setBusy(false)}},220);
   return()=>{window.clearTimeout(timer);controller.abort()}
 },[q,locale]);
 function changeQuery(value:string){setQ(value);if(value.trim().length<2){setResults([]);setBusy(false);setOpen(false);setActiveIndex(-1)}}
 function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>){
   if(!open){ if(e.key==="ArrowDown" && results.length){ setOpen(true); setActiveIndex(0); e.preventDefault(); } return; }
   if(e.key==="ArrowDown"){ e.preventDefault(); setActiveIndex((prev)=> (prev+1) % Math.max(results.length,1)); }
   else if(e.key==="ArrowUp"){ e.preventDefault(); setActiveIndex((prev)=> (prev-1+results.length) % results.length); }
   else if(e.key==="Enter"){
     if(activeIndex>=0 && results[activeIndex]){ e.preventDefault(); router.push(`/${locale}/students/${results[activeIndex].personId}`); }
     else if(results.length===1){ e.preventDefault(); router.push(`/${locale}/students/${results[0].personId}`); }
   }
   else if(e.key==="Escape"){ setOpen(false); setActiveIndex(-1); }
 }
 return <div ref={box} className="global-search-box" style={{position:"relative",minWidth:0,flex:"1 1 16rem",maxWidth:"34rem"}}><label className="sr-only" htmlFor="global-student-search">{t.label}</label><input id="global-student-search" className="text-field" type="search" value={q} onChange={e=>changeQuery(e.target.value)} onFocus={()=>q.trim().length>=2&&setOpen(true)} onKeyDown={handleKeyDown} role="combobox" aria-expanded={open} aria-controls="global-search-listbox" aria-autocomplete="list" aria-activedescendant={activeIndex>=0?`global-search-option-${results[activeIndex]?.personId}`:undefined} placeholder={t.placeholder} autoComplete="off"/>{open?<div id="global-search-listbox" role="listbox" aria-label={t.label} style={{position:"absolute",insetInline:0,top:"calc(100% + .45rem)",zIndex:80,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:".85rem",boxShadow:"0 18px 45px rgb(20 49 32 / 16%)",padding:".45rem",maxHeight:"24rem",overflowY:"auto"}}>{busy?<p style={{padding:".7rem",margin:0}} role="status" aria-live="polite">{t.loading}</p>:results.length?results.map((r,idx)=><Link key={r.personId} id={`global-search-option-${r.personId}`} role="option" aria-selected={idx===activeIndex} href={`/${locale}/students/${r.personId}`} onClick={()=>setOpen(false)} style={{display:"grid",padding:".7rem .8rem",borderRadius:".65rem",textDecoration:"none",color:"inherit",gap:".15rem",background: idx===activeIndex ? "var(--surface-hover, #f3f4f6)" : "transparent", outline: idx===activeIndex ? "2px solid var(--border)" : "none"}}><strong>{r.name}</strong>{r.nativeName?<span dir="auto">{r.nativeName}</span>:null}<small>{r.studentNumber} · {r.program} · {r.group} · {r.status}</small></Link>):<p style={{padding:".7rem",margin:0}} role="status">{t.empty} — try a different name or ID</p>}</div>:null}</div>;
}
