"use client";

import Link from "next/link";
import { useEffect,useRef,useState } from "react";
import type { Locale } from "@/lib/i18n/config";

type Result={personId:number;name:string;nativeName:string|null;studentNumber:string;status:string;program:string;group:string};
const copy={
 en:{label:"Find student",placeholder:"Name, student/admission no. or guardian phone",empty:"No matching students",loading:"Searching…"},
 ur:{label:"طالب علم تلاش کریں",placeholder:"نام، طالب علم/داخلہ نمبر یا سرپرست فون",empty:"کوئی طالب علم نہیں ملا",loading:"تلاش جاری ہے…"},
 ar:{label:"البحث عن طالب",placeholder:"الاسم أو رقم الطالب/القبول أو هاتف ولي الأمر",empty:"لا يوجد طالب مطابق",loading:"جارٍ البحث…"}
} as const;

export function GlobalStudentSearch({locale}:{locale:Locale}){
 const t=copy[locale],box=useRef<HTMLDivElement>(null);const[q,setQ]=useState("");const[results,setResults]=useState<Result[]>([]);const[busy,setBusy]=useState(false);const[open,setOpen]=useState(false);
 useEffect(()=>{const onPointer=(e:PointerEvent)=>{if(box.current&&!box.current.contains(e.target as Node))setOpen(false)};document.addEventListener("pointerdown",onPointer);return()=>document.removeEventListener("pointerdown",onPointer)},[]);
 useEffect(()=>{const value=q.trim();if(value.length<2){setResults([]);setBusy(false);return}const controller=new AbortController();const timer=window.setTimeout(async()=>{setBusy(true);try{const response=await fetch(`/api/students/search?q=${encodeURIComponent(value)}&locale=${locale}`,{signal:controller.signal,cache:"no-store"});const json=await response.json();setResults(response.ok&&Array.isArray(json.results)?json.results:[]);setOpen(true)}catch(e){if((e as Error).name!=="AbortError")setResults([])}finally{setBusy(false)}},220);return()=>{window.clearTimeout(timer);controller.abort()}},[q,locale]);
 return <div ref={box} style={{position:"relative",minWidth:"min(34rem,42vw)",flex:"1 1 24rem"}}><label className="sr-only" htmlFor="global-student-search">{t.label}</label><input id="global-student-search" className="text-field" type="search" value={q} onChange={e=>setQ(e.target.value)} onFocus={()=>q.trim().length>=2&&setOpen(true)} placeholder={t.placeholder} autoComplete="off"/>{open?<div role="listbox" aria-label={t.label} style={{position:"absolute",insetInline:0,top:"calc(100% + .45rem)",zIndex:80,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:".85rem",boxShadow:"0 18px 45px rgb(20 49 32 / 16%)",padding:".45rem",maxHeight:"24rem",overflowY:"auto"}}>{busy?<p style={{padding:".7rem",margin:0}}>{t.loading}</p>:results.length?results.map(r=><Link key={r.personId} role="option" href={`/${locale}/students/${r.personId}`} onClick={()=>setOpen(false)} style={{display:"grid",padding:".7rem .8rem",borderRadius:".65rem",textDecoration:"none",color:"inherit",gap:".15rem"}}><strong>{r.name}</strong>{r.nativeName?<span dir="auto">{r.nativeName}</span>:null}<small>{r.studentNumber} · {r.program} · {r.group} · {r.status}</small></Link>):<p style={{padding:".7rem",margin:0}}>{t.empty}</p>}</div>:null}</div>;
}
