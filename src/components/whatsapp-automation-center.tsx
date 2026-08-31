"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { WhatsappCenter } from "@/lib/notifications/whatsapp";

type Copy={config:string;provider:string;sender:string;secretRef:string;state:string;save:string;template:string;locale:string;providerTemplate:string;body:string;variables:string;publish:string;consent:string;student:string;status:string;source:string;evidence:string;record:string;queue:string;messageVars:string;send:string;recipients:string;dispatches:string;none:string;error:string;blockedHint:string;privacy:string};

async function postJson(url:string,body:unknown){const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const payload=await response.json().catch(()=>({})) as Record<string,unknown>;if(!response.ok)throw new Error(typeof payload.error==="string"?payload.error:"Request failed.");return payload;}

export function WhatsappAutomationCenter({data,copy}:{data:WhatsappCenter;copy:Copy}){
 const router=useRouter();const[busy,setBusy]=useState(false);const[message,setMessage]=useState<string|null>(null);const[queueVariables,setQueueVariables]=useState("{}");
 const publishedTemplates=useMemo(()=>data.templates.filter(t=>t.state==="published"),[data.templates]);
 async function run(action:()=>Promise<unknown>){setBusy(true);setMessage(null);try{const result=await action();const row=result&&typeof result==="object"?result as Record<string,unknown>:{};setMessage(typeof row.blocked_reason==="string"?`${row.state}: ${row.blocked_reason}`:typeof row.state==="string"?`Status: ${row.state}`:"Saved.");router.refresh();}catch(error){setMessage(error instanceof Error?error.message:copy.error);}finally{setBusy(false);}}
 return <div className="documents-shell">
  {message?<p className="panel empty-state">{message}</p>:null}
  <section className="panel"><h2>{copy.config}</h2><p>{copy.privacy}</p><form action={(form)=>run(()=>postJson("/api/communications/whatsapp/config",{provider:form.get("provider"),senderReference:form.get("senderReference"),encryptedConfigReference:form.get("encryptedConfigReference"),state:form.get("state")}))} className="detail-grid">
   <label className="field-label">{copy.provider}<select className="text-field" name="provider" defaultValue={data.config.provider??"meta_cloud"}><option value="meta_cloud">Meta Cloud API</option><option value="360dialog">360dialog</option><option value="twilio">Twilio</option><option value="custom">Custom adapter</option></select></label>
   <label className="field-label">{copy.sender}<input className="text-field" name="senderReference" defaultValue={data.config.senderReference??""} maxLength={160}/></label>
   <label className="field-label">{copy.secretRef}<input className="text-field" name="encryptedConfigReference" placeholder="vercel-env:WHATSAPP_ACCESS_TOKEN" maxLength={256}/></label>
   <label className="field-label">{copy.state}<select className="text-field" name="state" defaultValue={data.config.state}><option value="inactive">Inactive</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
   <div><button className="action-button" disabled={busy} type="submit">{copy.save}</button></div>
  </form></section>

  <section className="panel"><h2>{copy.template}</h2><form action={(form)=>run(()=>postJson("/api/communications/whatsapp/templates",{locale:form.get("locale"),providerTemplateReference:form.get("providerTemplateReference"),bodyTemplate:form.get("bodyTemplate"),requiredVariables:String(form.get("requiredVariables")??"").split(",").map(v=>v.trim()).filter(Boolean)}))} className="detail-grid">
   <label className="field-label">{copy.locale}<select className="text-field" name="locale" defaultValue="en"><option value="en">English</option><option value="ur">Urdu</option><option value="ar">Arabic</option></select></label>
   <label className="field-label">{copy.providerTemplate}<input className="text-field" name="providerTemplateReference" maxLength={160}/></label>
   <label className="field-label">{copy.variables}<input className="text-field" name="requiredVariables" placeholder="student_name, notice" maxLength={500}/></label>
   <label className="field-label" style={{gridColumn:"1 / -1"}}>{copy.body}<textarea className="text-field" name="bodyTemplate" required minLength={2} maxLength={4096} rows={5}/></label>
   <div><button className="action-button" disabled={busy} type="submit">{copy.publish}</button></div>
  </form></section>

  <section className="panel"><h2>{copy.consent}</h2><form action={(form)=>run(()=>postJson("/api/communications/whatsapp/consent",{studentPersonId:Number(form.get("studentPersonId")),status:form.get("status"),source:form.get("source"),evidenceReference:form.get("evidenceReference")}))} className="detail-grid">
   <label className="field-label">{copy.student}<select className="text-field" name="studentPersonId" required>{data.recipients.map(r=><option key={r.studentPersonId} value={r.studentPersonId}>{r.studentNumber} · {r.studentName} · {r.guardianName??"No guardian"}</option>)}</select></label>
   <label className="field-label">{copy.status}<select className="text-field" name="status" defaultValue="opted_in"><option value="opted_in">Opted in</option><option value="opted_out">Opted out</option></select></label>
   <label className="field-label">{copy.source}<select className="text-field" name="source" defaultValue="written"><option value="written">Written</option><option value="verbal">Verbal</option><option value="digital">Digital</option><option value="provider">Provider</option></select></label>
   <label className="field-label">{copy.evidence}<input className="text-field" name="evidenceReference" maxLength={240}/></label>
   <div><button className="action-button" disabled={busy||!data.recipients.length} type="submit">{copy.record}</button></div>
  </form></section>

  <section className="panel"><h2>{copy.queue}</h2><p>{copy.blockedHint}</p><form action={(form)=>run(async()=>{let variables:Record<string,unknown>={};try{variables=JSON.parse(queueVariables) as Record<string,unknown>;}catch{throw new Error("Message variables must be valid JSON.");}return postJson("/api/communications/whatsapp/queue",{studentPersonId:Number(form.get("studentPersonId")),templateId:Number(form.get("templateId")),variables});})} className="detail-grid">
   <label className="field-label">{copy.student}<select className="text-field" name="studentPersonId" required>{data.recipients.map(r=><option key={r.studentPersonId} value={r.studentPersonId}>{r.studentNumber} · {r.studentName} · {r.guardianName??"No guardian"} · {r.consentStatus}</option>)}</select></label>
   <label className="field-label">{copy.template}<select className="text-field" name="templateId" required>{publishedTemplates.map(t=><option key={t.id} value={t.id}>{t.locale} · {t.providerTemplateReference??"provider ref missing"}</option>)}</select></label>
   <label className="field-label" style={{gridColumn:"1 / -1"}}>{copy.messageVars}<textarea className="text-field" rows={4} value={queueVariables} onChange={e=>setQueueVariables(e.target.value)}/></label>
   <div><button className="action-button" disabled={busy||!publishedTemplates.length||!data.recipients.length} type="submit">{copy.send}</button></div>
  </form></section>

  <section className="panel"><h2>{copy.recipients}</h2>{data.recipients.length?<div className="documents-recent"><div>{data.recipients.map(r=><article key={r.studentPersonId}><div><strong>{r.studentNumber} · {r.studentName}</strong><small>{r.guardianName??"No primary guardian"} · {r.phoneHint??"No phone"}</small></div><span>{r.consentStatus}</span></article>)}</div></div>:<p className="empty-state">{copy.none}</p>}</section>
  <section className="panel"><h2>{copy.dispatches}</h2>{data.dispatches.length?<div className="documents-recent"><div>{data.dispatches.map(d=><article key={d.id}><div><strong>#{d.id} · {d.studentNumber??"—"} · {d.studentName??"—"}</strong><small>{d.guardianName??"—"} · {d.locale} · attempts {d.attemptCount}</small></div><span>{d.state}</span></article>)}</div></div>:<p className="empty-state">{copy.none}</p>}</section>
 </div>;
}
