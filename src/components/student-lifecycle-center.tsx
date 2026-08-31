"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudentLifecycleCenter } from "@/lib/students/lifecycle";
import { parseStudentImportCsv, type StudentImportRow } from "@/lib/students/csv-import";

type Copy={nextSession:string;sourceSession:string;sessionKey:string;sessionLabel:string;startsOn:string;endsOn:string;prepare:string;importTitle:string;csvFile:string;placement:string;joinedOn:string;preview:string;importAction:string;rolloverTitle:string;mode:string;targetSession:string;targetGroup:string;students:string;selectAll:string;promotion:string;renewal:string;plan:string;jobs:string;none:string;error:string;guardrail:string;rows:string;created:string;blocked:string;failed:string;planned:string};

async function postJson(url:string,body:unknown){const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const payload=await response.json().catch(()=>({})) as Record<string,unknown>;if(!response.ok)throw new Error(typeof payload.error==="string"?payload.error:"Request failed.");return payload;}
function addOneDay(value:string){const d=new Date(`${value}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
function addOneYearMinusDay(value:string){const d=new Date(`${value}T00:00:00Z`);d.setUTCFullYear(d.getUTCFullYear()+1);d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);}
function nextSessionDefaults(endsOn:string){const start=addOneDay(endsOn);const y=Number(start.slice(0,4));return{key:`${y}_${String(y+1).slice(-2)}`,label:`${y}-${String(y+1).slice(-2)}`,startsOn:start,endsOn:addOneYearMinusDay(start)};}

export function StudentLifecycleCenter({data,copy}:{data:StudentLifecycleCenter;copy:Copy}){
 const router=useRouter();const[busy,setBusy]=useState<string|null>(null);const[message,setMessage]=useState<string|null>(null);const[csvRows,setCsvRows]=useState<StudentImportRow[]>([]);const[selectedStudents,setSelectedStudents]=useState<number[]>([]);
 const activeSession=data.sessions.find(s=>s.status==="active")??data.sessions[0];const defaults=activeSession?nextSessionDefaults(activeSession.endsOn):null;
 const currentGroups=useMemo(()=>data.groups.filter(g=>g.sessionId===activeSession?.id),[data.groups,activeSession?.id]);const futureSessions=useMemo(()=>data.sessions.filter(s=>s.id!==activeSession?.id&&(s.status==="draft"||s.status==="active")),[data.sessions,activeSession?.id]);
 const defaultImportGroup=currentGroups[0];const[importGroupId,setImportGroupId]=useState(defaultImportGroup?.id??0);const[rolloverSessionId,setRolloverSessionId]=useState(futureSessions[0]?.id??0);const targetGroups=useMemo(()=>data.groups.filter(g=>g.sessionId===rolloverSessionId),[data.groups,rolloverSessionId]);
 async function run(key:string,action:()=>Promise<Record<string,unknown>>){setBusy(key);setMessage(null);try{const result=await action();const state=typeof result.state==="string"?result.state:"saved";const success=Number(result.succeeded_items??result.groups_cloned??0);const blocked=Number(result.blocked_items??0);const failed=Number(result.failed_items??0);setMessage(`${state}${success||blocked||failed?` · ${copy.created}/${copy.planned}: ${success} · ${copy.blocked}: ${blocked} · ${copy.failed}: ${failed}`:""}`);router.refresh();}catch(error){setMessage(error instanceof Error?error.message:copy.error);}finally{setBusy(null);}}
 async function readCsv(file:File|null){setMessage(null);if(!file){setCsvRows([]);return;}try{setCsvRows(parseStudentImportCsv(await file.text()));}catch(error){setCsvRows([]);setMessage(error instanceof Error?error.message:copy.error);}}
 const toggle=(id:number)=>setSelectedStudents(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
 return <div className="documents-shell">
  {message?<p className="panel empty-state">{message}</p>:null}
  <section className="panel"><h2>{copy.nextSession}</h2><p>{copy.guardrail}</p>{activeSession&&defaults?<form action={(form)=>run("session",()=>postJson("/api/students/lifecycle/session",{sourceSessionId:activeSession.id,key:form.get("key"),label:form.get("label"),labelUr:form.get("labelUr"),labelAr:form.get("labelAr"),startsOn:form.get("startsOn"),endsOn:form.get("endsOn")}))} className="detail-grid">
   <label className="field-label">{copy.sourceSession}<input className="text-field" value={`${activeSession.label} · ${activeSession.startsOn} → ${activeSession.endsOn}`} readOnly/></label>
   <label className="field-label">{copy.sessionKey}<input className="text-field" name="key" defaultValue={defaults.key} required/></label>
   <label className="field-label">{copy.sessionLabel}<input className="text-field" name="label" defaultValue={defaults.label} required/></label>
   <label className="field-label">Urdu label<input className="text-field" name="labelUr"/></label><label className="field-label">Arabic label<input className="text-field" name="labelAr"/></label>
   <label className="field-label">{copy.startsOn}<input className="text-field" type="date" name="startsOn" defaultValue={defaults.startsOn} required/></label><label className="field-label">{copy.endsOn}<input className="text-field" type="date" name="endsOn" defaultValue={defaults.endsOn} required/></label>
   <div><button className="action-button" disabled={busy!==null} type="submit">{copy.prepare}</button></div>
  </form>:<p className="empty-state">{copy.none}</p>}</section>

  <section className="panel"><h2>{copy.importTitle}</h2><form action={(form)=>run("import",async()=>{const group=data.groups.find(g=>g.id===Number(form.get("groupId")));if(!group)throw new Error("Choose a valid class or group.");if(!csvRows.length)throw new Error("Choose a CSV file with at least one student.");return postJson("/api/students/lifecycle/import",{sessionId:group.sessionId,programId:group.programId,groupId:group.id,joinedOn:form.get("joinedOn"),rows:csvRows});})} className="detail-grid">
   <label className="field-label">{copy.csvFile}<input className="text-field" type="file" accept=".csv,text/csv" onChange={e=>readCsv(e.target.files?.[0]??null)}/></label>
   <label className="field-label">{copy.placement}<select className="text-field" name="groupId" value={importGroupId} onChange={e=>setImportGroupId(Number(e.target.value))}>{currentGroups.map(g=><option value={g.id} key={g.id}>{g.programLabel} · {g.label}</option>)}</select></label>
   <label className="field-label">{copy.joinedOn}<input className="text-field" type="date" name="joinedOn" defaultValue={activeSession?.startsOn}/></label>
   <div><button className="action-button" disabled={busy!==null||!csvRows.length||!importGroupId} type="submit">{copy.importAction}</button></div>
  </form>{csvRows.length?<div className="documents-recent"><p><strong>{copy.preview}: {csvRows.length} {copy.rows}</strong></p><div>{csvRows.slice(0,5).map((row,index)=><article key={`${row.display_name}-${index}`}><div><strong>{row.display_name}</strong><small>{row.guardian?.name??"No guardian in CSV"}</small></div><span>{row.preferred_locale??"en"}</span></article>)}</div></div>:null}</section>

  <section className="panel"><h2>{copy.rolloverTitle}</h2><form action={(form)=>run("rollover",()=>postJson("/api/students/lifecycle/rollover",{studentPersonIds:selectedStudents,targetSessionId:Number(form.get("targetSessionId")),targetGroupId:Number(form.get("targetGroupId")),mode:form.get("mode")}))} className="detail-grid">
   <label className="field-label">{copy.mode}<select className="text-field" name="mode" defaultValue="promotion"><option value="promotion">{copy.promotion}</option><option value="renewal">{copy.renewal}</option></select></label>
   <label className="field-label">{copy.targetSession}<select className="text-field" name="targetSessionId" value={rolloverSessionId} onChange={e=>setRolloverSessionId(Number(e.target.value))}><option value={0}>—</option>{futureSessions.map(s=><option value={s.id} key={s.id}>{s.label} · {s.status}</option>)}</select></label>
   <label className="field-label">{copy.targetGroup}<select className="text-field" name="targetGroupId" defaultValue={targetGroups[0]?.id??0} key={rolloverSessionId}><option value={0}>—</option>{targetGroups.map(g=><option value={g.id} key={g.id}>{g.programLabel} · {g.label}</option>)}</select></label>
   <div><button className="action-button" disabled={busy!==null||!selectedStudents.length||!rolloverSessionId||!targetGroups.length} type="submit">{copy.plan}</button></div>
  </form><div className="documents-recent"><p><button className="secondary-button" type="button" onClick={()=>setSelectedStudents(selectedStudents.length===data.students.length?[]:data.students.map(s=>s.personId))}>{copy.selectAll}</button> · {selectedStudents.length} / {data.students.length}</p><div>{data.students.map(student=><article key={student.personId}><div><strong>{student.studentNumber} · {student.name}</strong><small>{data.groups.find(g=>g.id===student.groupId)?.label??"No group"}</small></div><label><input type="checkbox" checked={selectedStudents.includes(student.personId)} onChange={()=>toggle(student.personId)}/> {copy.students}</label></article>)}</div></div></section>

  <section className="panel"><h2>{copy.jobs}</h2>{data.jobs.length?<div className="documents-recent"><div>{data.jobs.map(job=><article key={job.id}><div><strong>#{job.id} · {job.operationType} · {job.state}</strong><small>{new Date(job.createdAt).toLocaleString()} · {copy.rows}: {job.totalItems}</small></div><span>{copy.created}/{copy.planned}: {job.succeededItems} · {copy.blocked}: {job.blockedItems} · {copy.failed}: {job.failedItems}</span></article>)}</div></div>:<p className="empty-state">{copy.none}</p>}</section>
 </div>;
}
