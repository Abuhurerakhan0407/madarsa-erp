"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useState} from "react";
import type {Locale} from "@/lib/i18n/config";
import {entryStatusLabel,examsCopy,examStateLabel} from "@/lib/exams/copy";
import type {ExamWorkspace} from "@/lib/exams/workspace";

function localized(labels:{en?:string;ur?:string;ar?:string},locale:Locale,fallback:string){return labels[locale]||labels.en||fallback;}

export function ExamsResultsWorkspace({locale,data}:{locale:Locale;data:ExamWorkspace}){
  const t=examsCopy[locale];const router=useRouter();const [busy,setBusy]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);
  const exam=data.exam;if(!exam)return <section className="panel exams-empty">{t.noResult}</section>;
  const complete=data.summary.marksExpected>0&&data.summary.marksRecorded>=data.summary.marksExpected;

  async function post(path:string,body:Record<string,unknown>,key:string){
    setBusy(key);setError(null);try{const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const payload=await response.json().catch(()=>({})) as {error?:string};if(!response.ok){setError(payload.error||t.error);return false;}router.refresh();return true;}catch{setError(t.error);return false;}finally{setBusy(null);}
  }

  async function saveMark(form:HTMLFormElement,examSubjectId:number,studentPersonId:number,markEntryId:number){
    const fd=new FormData(form);const entryStatus=String(fd.get("entryStatus")||"present");const marks=String(fd.get("rawMarks")||"").trim();await post("/api/exams/mark",{examSubjectId,studentPersonId,entryStatus,rawMarks:entryStatus==="present"?marks:null,comment:String(fd.get("comment")||"")},`save-${markEntryId}`);
  }
  async function moderateMark(form:HTMLFormElement,markEntryId:number){
    const fd=new FormData(form);const marks=String(fd.get("rawMarks")||"").trim();await post("/api/exams/moderate",{markEntryId,rawMarks:marks,reason:String(fd.get("moderationReason")||"")},`moderate-${markEntryId}`);
  }
  async function workflow(action:"calculate"|"approve"|"publish"){await post("/api/exams/workflow",{examSeriesId:exam.id,action},`workflow-${action}`);}

  const metrics=[[t.candidates,data.summary.candidates],[t.subjects,data.summary.subjects],[t.marksRecorded,`${data.summary.marksRecorded}/${data.summary.marksExpected}`],[t.average,data.summary.averagePercentage===null?"—":`${data.summary.averagePercentage}%`]];
  return <div className="exams-workspace">
    {error?<p className="form-message form-error exams-alert" role="alert">{error}</p>:null}
    <section className="exams-summary panel" data-page-section>
      <div><p className="state-kicker">{localized(exam.labels,locale,exam.label)}</p><h2>{examStateLabel(exam.state,t)}</h2><p>{t.group}: <strong>{exam.groupLabel||"—"}</strong> · {t.examWindow}: <strong>{exam.startsOn} → {exam.endsOn}</strong></p></div>
      <div className="exams-workflow-actions">
        {data.canApprove&&exam.state==="marks_open"?<button className="action-button action-button-primary" type="button" disabled={!complete||busy!==null} onClick={()=>workflow("calculate")}>{busy==="workflow-calculate"?t.processing:t.calculate}</button>:null}
        {data.canApprove&&data.latestResult?.state==="calculated"?<button className="action-button action-button-primary" type="button" disabled={busy!==null} onClick={()=>workflow("approve")}>{busy==="workflow-approve"?t.processing:t.approve}</button>:null}
        {data.canPublish&&data.latestResult?.state==="approved"?<button className="action-button action-button-primary" type="button" disabled={busy!==null} onClick={()=>workflow("publish")}>{busy==="workflow-publish"?t.processing:t.publish}</button>:null}
      </div>
    </section>
    <section className="exams-metrics" data-page-section>{metrics.map(([label,value])=><article className="exam-metric" key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</section>
    {data.latestResult?<section className="panel exams-result-status" data-page-section><div><span>{t.resultState}</span><strong>{examStateLabel(data.latestResult.state,t)}</strong>{data.latestResult.snapshot?<small>{data.latestResult.snapshot.percentage??"—"}% · {t.grade} {data.latestResult.snapshot.gradeKey||"—"}</small>:null}</div>{data.latestResult.state==="approved"||exam.state==="results_published"?<span className="status-chip">{examStateLabel(exam.state,t)}</span>:null}</section>:<section className="panel exams-result-status" data-page-section><span>{t.noResult}</span></section>}
    <section className="exam-subjects" data-page-section>{data.subjects.map(subject=><article className="exam-subject-card panel" key={subject.examSubjectId}>
      <header className="exam-subject-header"><div><p className="state-kicker">{subject.subjectKey.replaceAll("_"," ")}</p><h3>{localized(subject.labels,locale,subject.subjectName)}</h3><p>{t.evaluator}: <strong>{subject.evaluator||"—"}</strong></p></div><div className="exam-score-rule"><span>{t.maximum}: {subject.maximumMarks}</span><span>{t.pass}: {subject.passMarks??"—"}</span></div></header>
      <div className="exam-marks-table">{subject.marks.map(mark=><form className="exam-mark-row" key={mark.markEntryId} onSubmit={e=>{e.preventDefault();void saveMark(e.currentTarget,subject.examSubjectId,mark.studentPersonId,mark.markEntryId);}}>
        <div className="exam-student-cell"><strong>{mark.studentName}</strong><small>{mark.studentNumber} · {t.version} {mark.currentVersion}</small>{exam.state==="results_published"?<Link className="quiet-link" href={`/${locale}/exams/report-card/${mark.studentPersonId}`}>{t.openReport}</Link>:null}</div>
        <label className="field-label">{t.status}<select className="text-field" name="entryStatus" defaultValue={mark.entryStatus} disabled={!data.canEnter||exam.state!=="marks_open"}>{["present","absent","exempt","incomplete","withheld"].map(status=><option key={status} value={status}>{entryStatusLabel(status,t)}</option>)}</select></label>
        <label className="field-label">{t.marks}<input className="text-field" name="rawMarks" type="number" min="0" max={subject.maximumMarks} step="0.01" defaultValue={mark.rawMarks??""} disabled={!data.canEnter||exam.state!=="marks_open"}/></label>
        <label className="field-label exam-comment-field">{t.comment}<input className="text-field" name="comment" maxLength={500} defaultValue={mark.comment||""} disabled={!data.canEnter||exam.state!=="marks_open"}/></label>
        {data.canEnter&&exam.state==="marks_open"?<button className="action-button" type="submit" disabled={busy!==null}>{busy===`save-${mark.markEntryId}`?t.saving:t.save}</button>:null}
        {data.canModerate&&exam.state!=="results_published"?<div className="exam-moderation"><label className="field-label">{t.moderationReason}<input className="text-field" name="moderationReason" minLength={4} maxLength={500}/></label><button className="action-button" type="button" disabled={busy!==null} onClick={e=>{if(e.currentTarget.form)void moderateMark(e.currentTarget.form,mark.markEntryId);}}>{busy===`moderate-${mark.markEntryId}`?t.processing:t.moderate}</button></div>:null}
      </form>)}</div>
    </article>)}</section>
  </div>;
}
