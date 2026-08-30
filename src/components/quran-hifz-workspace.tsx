"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { quranCopy, quranOutcomeLabel, quranWorkLabel } from "@/lib/quran/copy";
import type { QuranHifzWorkspace as Workspace } from "@/lib/quran/workspace";
import { QuranEntryForm } from "./quran-entry-form";

export function QuranHifzWorkspace({locale,data,search}:{locale:Locale;data:Workspace;search:string}){
  const t=quranCopy[locale];const router=useRouter();const [openPerson,setOpenPerson]=useState<number|null>(null);
  const pages=Math.max(1,Math.ceil(data.total/data.pageSize));
  const metrics=[[t.students,data.summary.students],[t.recorded,data.summary.recordedToday],[t.attempts,data.summary.attemptsToday],[t.revision,data.summary.revisionDue],[t.average,data.summary.averageToday??"—"],[t.repeat,data.summary.repeatToday]];
  function navigate(params:{q?:string;page?:number}){const query=new URLSearchParams();const q=params.q!==undefined?params.q:search;if(q)query.set("q",q);const page=params.page??data.page;if(page>1)query.set("page",String(page));router.push(`/${locale}/quran${query.size?`?${query.toString()}`:""}`);}
  return <div className="quran-workspace">
    <section className="quran-toolbar panel" data-page-section><form className="quran-search" onSubmit={e=>{e.preventDefault();const fd=new FormData(e.currentTarget);navigate({q:String(fd.get("q")||"").trim(),page:1});}}><label className="field-label">{t.search}<input className="text-field" name="q" defaultValue={search}/></label><button className="action-button" type="submit">{t.searchAction}</button>{search?<button className="action-button" type="button" onClick={()=>navigate({q:"",page:1})}>{t.clear}</button>:null}</form><Link className="action-button" href={`/${locale}/quran/revision`}>{t.revisionQueue}</Link></section>
    <section className="quran-metrics" data-page-section>{metrics.map(([label,value])=><article className="quran-metric" key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</section>
    <section className="quran-register" data-page-section>{data.rows.length?data.rows.map(row=><article className="quran-row" key={row.personId}>
      <div className="quran-student"><div><strong>{row.name}</strong>{row.nameNative?<span dir="auto">{row.nameNative}</span>:null}<small>{row.studentNumber} · {row.groupName||"—"}</small></div><div className="quran-student-links"><Link className="quiet-link" href={`/${locale}/quran/${row.personId}`}>{t.history}</Link><Link className="quiet-link" href={`/${locale}/students/${row.personId}`}>{t.openStudent}</Link></div></div>
      <div className="quran-progress-grid"><div><span>{t.sabaq}</span><strong>{row.sabaqLabel||"—"}</strong></div><div><span>{t.sabqi}</span><strong>{row.sabqiLabel||"—"}</strong></div><div><span>{t.manzil}</span><strong>{row.manzilLabel||"—"}</strong></div><div><span>{t.memorized}</span><strong>{row.passedJuz}/30</strong></div></div>
      <div className="quran-latest"><span>{t.latest}</span>{row.lastRecordedAt?<><strong>{quranWorkLabel(row.lastWorkCategory||"",t)} · {quranOutcomeLabel(row.lastOutcome||"",t)}</strong><small>{t.score}: {row.lastOverallScore??"—"}</small></>:<strong>{t.noRecords}</strong>}{row.revisionDue>0?<em>{t.revisionFlag}: {row.revisionDue}</em>:null}</div>
      {data.canRecord?<button className="action-button action-button-primary quran-record-button" type="button" onClick={()=>setOpenPerson(row.personId)}>{t.record}</button>:null}
      {openPerson===row.personId?<QuranEntryForm locale={locale} personId={row.personId} studentName={row.name} studentNumber={row.studentNumber} onCancel={()=>setOpenPerson(null)} onSaved={()=>{setOpenPerson(null);router.refresh();}}/>:null}
    </article>):<div className="panel quran-empty">{t.noStudents}</div>}</section>
    {pages>1?<nav className="quran-pagination" aria-label={t.pageLabel}><button className="action-button" type="button" disabled={data.page<=1} onClick={()=>navigate({page:data.page-1})}>{t.previous}</button><span>{t.pageLabel} {data.page} / {pages}</span><button className="action-button" type="button" disabled={data.page>=pages} onClick={()=>navigate({page:data.page+1})}>{t.next}</button></nav>:null}
  </div>;
}
