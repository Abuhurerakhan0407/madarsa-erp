"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import type {Locale} from "@/lib/i18n/config";
import type {TeachersWorkspace,TeacherLabels} from "@/lib/teachers/workspace";

function label(labels:TeacherLabels,locale:Locale,fallback:string){return labels[locale]||labels.en||labels.ur||labels.ar||fallback;}
function account(status:string){return status==="active"?"Active":status==="disabled"?"Disabled":status==="email_required"?"Email required":"Not created";}
function pct(present:number,total:number){return total>0?`${Math.round((present/total)*100)}%`:"—";}

export function TeachersWorkspaceView({locale,data,search,state}:{locale:Locale;data:TeachersWorkspace;search:string;state:string}){
 const router=useRouter();
 function go(next:{q?:string;state?:string}){const p=new URLSearchParams();const q=next.q!==undefined?next.q:search;const st=next.state!==undefined?next.state:state;if(q)p.set("q",q);if(st)p.set("state",st);router.push(`/${locale}/staff${p.size?`?${p}`:""}`);}
 const active=data.teachers.filter(t=>t.state==="active").length;const access=data.teachers.filter(t=>t.accountStatus==="active").length;const missingEmail=data.teachers.filter(t=>!t.email).length;
 return <div className="flow-stack">
  <section className="professional-card"><div className="section-heading"><div><p className="state-kicker">Teaching team</p><h1>Teachers</h1><p>Teaching identity, contact details, assignments, timetable, portal status and attendance—without payroll or private HR fields.</p></div><div className="quick-actions"><Link className="action-button" href={`/${locale}/staff/attendance`}>Teacher attendance</Link><Link className="action-button" href={`/${locale}/portals?tab=teachers`}>Teacher access</Link></div></div>
   <form className="form-grid" onSubmit={e=>{e.preventDefault();const fd=new FormData(e.currentTarget);go({q:String(fd.get("q")||"").trim()});}}><label className="field-label">Search<input className="text-field" name="q" defaultValue={search} placeholder="Name or teacher ID"/></label><label className="field-label">Status<select className="text-field" value={state} onChange={e=>go({state:e.target.value})}><option value="">All current</option><option value="active">Active</option><option value="on_leave">On leave</option><option value="suspended">Suspended</option></select></label><button className="action-button" type="submit">Search</button>{search||state?<button className="action-button" type="button" onClick={()=>go({q:"",state:""})}>Clear</button>:null}</form>
  </section>
  <section className="attendance-metrics">{[["Teachers",data.teachers.length],["Active",active],["Portal active",access],["Need email",missingEmail]].map(([k,v])=><article className="attendance-metric" key={String(k)}><span>{k}</span><strong>{v}</strong></article>)}</section>
  <section className="flow-stack">{data.teachers.length?data.teachers.map(t=><article className="professional-card" key={t.employmentId}><div className="section-heading"><div style={{display:"flex",gap:14,alignItems:"center"}}><div className="teacher-avatar" aria-hidden="true">{t.photoStoragePath?<img src={`/api/teachers/photo/${t.personId}`} alt=""/>:<span>{t.displayName.slice(0,1).toUpperCase()}</span>}</div><div><p className="state-kicker">{t.teacherId}</p><h2>{t.displayName}</h2>{t.nameNative?<p dir="auto">{t.nameNative}</p>:null}<p>{t.designation}</p></div></div><div className="quick-actions"><span className="status-pill">{account(t.accountStatus)}</span><Link className="action-button" href={`/${locale}/staff/${t.employmentId}`}>Open</Link></div></div>
   <div className="demo-card-grid"><div className="demo-card"><strong>Contact</strong><p>{t.email||"Email not added"}</p><p>{t.phone||"Phone not added"}</p><small>Joined {t.joinedOn||"—"}</small></div><div className="demo-card"><strong>Teaching scope</strong><p>Programs: {t.assignedPrograms.length?t.assignedPrograms.map(x=>label(x.labels,locale,`Program ${x.id}`)).join(", "):"Not assigned"}</p><p>Subjects: {t.assignedSubjects.length?t.assignedSubjects.map(x=>label(x.labels,locale,`Subject ${x.id}`)).join(", "):"Not assigned"}</p><p>Groups: {t.assignedGroups.length?t.assignedGroups.map(x=>label(x.labels,locale,`Group ${x.id}`)).join(", "):"Not assigned"}</p></div><div className="demo-card"><strong>Attendance · 30 days</strong><p>{pct(t.attendance.present,t.attendance.total)} present</p><small>{t.attendance.present} present · {t.attendance.absent} absent · {t.attendance.late} late</small></div><div className="demo-card"><strong>Timetable</strong><p>{t.timetable.length} active periods</p><small>{t.lastLogin?`Last portal login ${new Date(t.lastLogin).toLocaleString()}`:"No portal login yet"}</small></div></div>
  </article>):<section className="professional-card"><h2>No teachers found</h2><p>Adjust the search/status filter. Existing HR records were not deleted or changed.</p></section>}</section>
 </div>;
}
