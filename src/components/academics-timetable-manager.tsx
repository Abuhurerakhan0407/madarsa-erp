"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AcademicsWorkspace } from "@/lib/academics/workspace";

type Locale = "en" | "ur";
type Props = { locale: Locale; data: AcademicsWorkspace };
type Tab = "day" | "timetable" | "homework" | "calendar";

type Copy = {
  day: string; timetable: string; homework: string; calendar: string; date: string; load: string; todaySchedule: string; noLessons: string;
  closed: string; group: string; subject: string; teacher: string; room: string; slot: string; time: string; actions: string; addSlot: string;
  slotKey: string; label: string; starts: string; ends: string; sequence: string; addEntry: string; weekday: string; effectiveFrom: string;
  effectiveTo: string; optional: string; exception: string; cancel: string; substitute: string; reschedule: string; lessonDate: string;
  replacementDate: string; replacementSlot: string; replacementTeacher: string; note: string; archive: string; dismiss: string; createHomework: string;
  targetType: string; student: string; title: string; instructions: string; due: string; priority: string; publish: string; attachment: string;
  allowSubmission: string; parentVisible: string; studentVisible: string; openHomework: string; state: string; close: string; createEvent: string;
  eventType: string; description: string; location: string; audience: string; affectsAttendance: string; upcoming: string; saving: string;
  saved: string; error: string; choose: string; none: string; activeEntries: string; activeSlots: string; lessons: string; events: string;
};

const copy: Record<Locale, Copy> = {
  en: { day:"Day view",timetable:"Timetable",homework:"Homework",calendar:"Calendar",date:"Date",load:"Load day",todaySchedule:"Schedule for selected day",noLessons:"No lessons are scheduled for this date.",closed:"Attendance is closed by the academic calendar.",group:"Group",subject:"Subject",teacher:"Teacher",room:"Room",slot:"Slot",time:"Time",actions:"Actions",addSlot:"Add timetable slot",slotKey:"Slot key",label:"Label",starts:"Starts",ends:"Ends",sequence:"Sequence",addEntry:"Add timetable entry",weekday:"Weekday",effectiveFrom:"Effective from",effectiveTo:"Effective to",optional:"Optional",exception:"Schedule exception",cancel:"Cancel lesson",substitute:"Substitute teacher",reschedule:"Reschedule",lessonDate:"Lesson date",replacementDate:"Replacement date",replacementSlot:"Replacement slot",replacementTeacher:"Replacement teacher",note:"Note",archive:"Archive",dismiss:"Cancel",createHomework:"Create homework",targetType:"Target type",student:"Student",title:"Title",instructions:"Instructions",due:"Due",priority:"Priority",publish:"Publish now",attachment:"Attachment",allowSubmission:"Allow submission",parentVisible:"Visible to parents",studentVisible:"Visible to students",openHomework:"Homework assignments",state:"State",close:"Close",createEvent:"Create calendar event",eventType:"Event type",description:"Description",location:"Location",audience:"Audience",affectsAttendance:"Affects attendance",upcoming:"Academic calendar",saving:"Saving…",saved:"Saved successfully.",error:"Unable to save this change.",choose:"Choose",none:"None",activeEntries:"Active entries",activeSlots:"Active slots",lessons:"Lessons today",events:"Calendar items" },
  ur: { day:"دن",timetable:"ٹائم ٹیبل",homework:"ہوم ورک",calendar:"کیلنڈر",date:"تاریخ",load:"دن کھولیں",todaySchedule:"منتخب دن کا شیڈول",noLessons:"اس تاریخ کے لیے کوئی سبق مقرر نہیں۔",closed:"اکیڈمک کیلنڈر کے مطابق حاضری بند ہے۔",group:"گروپ",subject:"مضمون",teacher:"استاد",room:"کمرہ",slot:"پیریڈ",time:"وقت",actions:"عمل",addSlot:"ٹائم ٹیبل پیریڈ شامل کریں",slotKey:"پیریڈ کلید",label:"نام",starts:"شروع",ends:"ختم",sequence:"ترتیب",addEntry:"ٹائم ٹیبل اندراج شامل کریں",weekday:"ہفتے کا دن",effectiveFrom:"موثر از",effectiveTo:"موثر تا",optional:"اختیاری",exception:"شیڈول تبدیلی",cancel:"سبق منسوخ",substitute:"متبادل استاد",reschedule:"دوبارہ شیڈول",lessonDate:"سبق تاریخ",replacementDate:"نئی تاریخ",replacementSlot:"نیا پیریڈ",replacementTeacher:"متبادل استاد",note:"نوٹ",archive:"آرکائیو",dismiss:"منسوخ",createHomework:"ہوم ورک بنائیں",targetType:"ہدف قسم",student:"طالب علم",title:"عنوان",instructions:"ہدایات",due:"آخری وقت",priority:"ترجیح",publish:"ابھی شائع کریں",attachment:"فائل",allowSubmission:"سبمشن کی اجازت",parentVisible:"والدین کو دکھائیں",studentVisible:"طلبہ کو دکھائیں",openHomework:"ہوم ورک اسائنمنٹس",state:"حالت",close:"بند کریں",createEvent:"کیلنڈر ایونٹ بنائیں",eventType:"ایونٹ قسم",description:"تفصیل",location:"مقام",audience:"سامعین",affectsAttendance:"حاضری پر اثر",upcoming:"اکیڈمک کیلنڈر",saving:"محفوظ ہو رہا ہے…",saved:"کامیابی سے محفوظ ہوا۔",error:"تبدیلی محفوظ نہیں ہو سکی۔",choose:"منتخب کریں",none:"کوئی نہیں",activeEntries:"فعال اندراج",activeSlots:"فعال پیریڈ",lessons:"آج کے اسباق",events:"کیلنڈر آئٹمز" }
};

const weekdays: Record<Locale,string[]> = { en:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], ur:["پیر","منگل","بدھ","جمعرات","جمعہ","ہفتہ","اتوار"] };
const enumLabels: Record<Locale,Record<string,string>> = {
  en:{low:"Low",normal:"Normal",high:"High",urgent:"Urgent",all:"All",parents:"Parents",students:"Students",teachers:"Teachers",staff:"Staff",working_day:"Working day",holiday:"Holiday",event:"Event",exam_window:"Exam window",closure:"Closure",draft:"Draft",published:"Published",open:"Open",closed:"Closed",cancelled:"Cancelled",scheduled:"Scheduled"},
  ur:{low:"کم",normal:"معمول",high:"زیادہ",urgent:"فوری",all:"سب",parents:"والدین",students:"طلبہ",teachers:"اساتذہ",staff:"عملہ",working_day:"تعلیمی دن",holiday:"چھٹی",event:"تقریب",exam_window:"امتحانی مدت",closure:"ادارہ بند",draft:"مسودہ",published:"شائع شدہ",open:"فعال",closed:"بند",cancelled:"منسوخ",scheduled:"طے شدہ"}
};
const enumLabel=(value:string,locale:Locale)=>enumLabels[locale][value]??value.replaceAll("_"," ");

export function AcademicsTimetableManager({ locale, data }: Props) {
  const router = useRouter();
  const text = copy[locale];
  const dateLocale = locale === "ur" ? "ur-PK" : "en-IN";
  const formatDateTime = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(dateLocale,{dateStyle:"medium",timeStyle:"short",timeZone:data.timezone}).format(date); };
  const [tab, setTab] = useState<Tab>("day");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [targetType, setTargetType] = useState<"group" | "student">("group");
  const [exceptionAction, setExceptionAction] = useState<"cancel" | "substitute" | "reschedule">("cancel");

  const defaultSession = data.sessions.find((item) => item.isDefault) ?? data.sessions[0] ?? null;
  const summaryCards = [
    [text.lessons, data.summary.todayLessons], [text.activeSlots, data.summary.activeSlots], [text.activeEntries, data.summary.activeEntries], [text.homework, data.summary.openHomework], [text.events, data.summary.calendarItems]
  ] as const;
  const entryMap = useMemo(() => new Map(data.entries.map((entry) => [entry.id, entry])), [data.entries]);

  async function mutate(payload: Record<string, unknown>) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/academics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || text.error);
      setMessage({ tone: "success", text: text.saved });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : text.error });
    } finally { setBusy(false); }
  }

  async function uploadAttachment(kind: "homework" | "calendar", file: File | null): Promise<string | null> {
    if (!file || file.size === 0) return null;
    const form = new FormData(); form.set("kind", kind); form.set("attachment", file);
    const response = await fetch("/api/academics/attachment", { method: "POST", body: form });
    const body = await response.json().catch(() => ({})) as { error?: string; attachmentToken?: string };
    if (!response.ok || !body.attachmentToken) throw new Error(body.error || text.error);
    return body.attachmentToken;
  }

  function loadDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const date = String(form.get("date") ?? data.selectedDate);
    router.push(`/${locale}/people-academics?date=${encodeURIComponent(date)}`);
  }

  async function addSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    await mutate({ action:"create_slot", key:String(f.get("key")??""), labels:{ en:String(f.get("label")??""), ur:"" }, startsAt:String(f.get("startsAt")??""), endsAt:String(f.get("endsAt")??""), sequence:Number(f.get("sequence")??0) });
  }

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget); const teacher = String(f.get("teacherPersonId")??"");
    await mutate({ action:"create_timetable_entry", groupId:Number(f.get("groupId")), slotId:Number(f.get("slotId")), subjectId:Number(f.get("subjectId")), teacherPersonId:teacher?Number(teacher):null, roomKey:String(f.get("roomKey")??""), weekday:Number(f.get("weekday")), effectiveFrom:String(f.get("effectiveFrom")??""), effectiveTo:String(f.get("effectiveTo")??"")||null });
  }

  async function addException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget); const slot=String(f.get("replacementSlotId")??""); const teacher=String(f.get("replacementTeacherPersonId")??"");
    await mutate({ action:"create_exception", entryId:Number(f.get("entryId")), sessionDate:String(f.get("sessionDate")??""), exceptionAction, replacementDate:exceptionAction==="reschedule"?String(f.get("replacementDate")??"")||null:null, replacementSlotId:exceptionAction==="reschedule"&&slot?Number(slot):null, replacementTeacherPersonId:(exceptionAction==="substitute"||exceptionAction==="reschedule")&&teacher?Number(teacher):null, replacementRoomKey:exceptionAction==="reschedule"?String(f.get("replacementRoomKey")??""):"", note:String(f.get("note")??"") });
  }

  async function addHomework(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const f = new FormData(event.currentTarget); const target=Number(f.get("targetId")); const file=f.get("attachment") instanceof File ? f.get("attachment") as File : null;
      const attachmentToken=await uploadAttachment("homework",file);
      await mutate({ action:"create_homework", sessionId:Number(f.get("sessionId")), groupId:targetType==="group"?target:null, studentPersonId:targetType==="student"?target:null, subjectId:Number(f.get("subjectId")), teacherPersonId:Number(f.get("teacherPersonId")), title:String(f.get("title")??""), instructions:String(f.get("instructions")??""), dueAt:String(f.get("dueAt")??""), priority:String(f.get("priority")??"normal"), parentVisible:f.get("parentVisible")==="on", studentVisible:f.get("studentVisible")==="on", allowSubmission:f.get("allowSubmission")==="on", publish:f.get("publish")==="on", attachmentToken });
    } catch (error) { setMessage({ tone:"error", text:error instanceof Error?error.message:text.error }); setBusy(false); }
  }

  async function addCalendar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const f = new FormData(event.currentTarget); const file=f.get("attachment") instanceof File ? f.get("attachment") as File : null;
      const attachmentToken=await uploadAttachment("calendar",file);
      await mutate({ action:"create_calendar_event", sessionId:Number(f.get("sessionId")), eventType:String(f.get("eventType")??"event"), labels:{ en:String(f.get("label")??""), ur:"" }, startsAt:String(f.get("startsAt")??""), endsAt:String(f.get("endsAt")??""), description:String(f.get("description")??""), location:String(f.get("location")??""), audience:String(f.get("audience")??"all"), priority:String(f.get("priority")??"normal"), affectsAttendance:f.get("affectsAttendance")==="on", attachmentToken });
    } catch (error) { setMessage({ tone:"error", text:error instanceof Error?error.message:text.error }); setBusy(false); }
  }

  return <div className="academics-v2 flow-stack" data-page-section>
    {message ? <div className={message.tone === "success" ? "workspace-success" : "workspace-inline-state"} role={message.tone === "error" ? "alert" : "status"}><strong>{message.text}</strong></div> : null}

    <section className="metric-grid student-metric-grid" aria-label="Academic summary">
      {summaryCards.map(([label,value],index)=><article className={index===0?"metric metric-primary":"metric"} key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </section>

    <nav className="workspace-filter-bar academics-tabs" aria-label="Academics workspace">
      {(["day","timetable","homework","calendar"] as Tab[]).map((value)=><button type="button" key={value} className={tab===value?"action-button action-button-primary":"action-button"} onClick={()=>setTab(value)}>{text[value]}</button>)}
    </nav>

    {tab === "day" ? <section className="workspace-task-section">
      <form className="workspace-filter-bar" onSubmit={loadDate}>
        <label className="workspace-field"><span>{text.date}</span><input type="date" name="date" defaultValue={data.selectedDate}/></label>
        <button className="action-button" type="submit">{text.load}</button>
      </form>
      {data.closure ? <div className="workspace-inline-state"><strong>{text.closed}</strong><span>{data.closure.label}</span></div> : null}
      <header className="workspace-section-heading"><div><h2>{text.todaySchedule}</h2><p>{data.selectedDate} · {data.timezone}</p></div></header>
      {data.todaySchedule.length===0 ? <div className="workspace-inline-state"><strong>{text.noLessons}</strong></div> : <div className="workspace-table-wrap"><table><thead><tr><th>{text.time}</th><th>{text.group}</th><th>{text.subject}</th><th>{text.teacher}</th><th>{text.room}</th></tr></thead><tbody>{data.todaySchedule.map((row)=><tr key={`${row.entryId}-${row.exceptionId??0}`}><td data-label={text.time}>{row.startsAt}–{row.endsAt}</td><td data-label={text.group}>{row.groupLabel}</td><td data-label={text.subject}>{row.subjectLabel}</td><td data-label={text.teacher}>{row.teacherName}</td><td data-label={text.room}>{row.roomKey||"—"}</td></tr>)}</tbody></table></div>}
    </section> : null}

    {tab === "timetable" ? <section className="workspace-task-section">
      {data.permissions.timetableManage ? <div className="workspace-two-column">
        <details><summary className="action-button">{text.addSlot}</summary><form className="workspace-form-grid" onSubmit={addSlot}><label className="workspace-field"><span>{text.slotKey}</span><input name="key" required placeholder="period_1"/></label><label className="workspace-field"><span>{text.label}</span><input name="label" required/></label><label className="workspace-field"><span>{text.starts}</span><input type="time" name="startsAt" required/></label><label className="workspace-field"><span>{text.ends}</span><input type="time" name="endsAt" required/></label><label className="workspace-field"><span>{text.sequence}</span><input type="number" min="0" max="200" name="sequence" defaultValue="0"/></label><button className="action-button action-button-primary" disabled={busy}>{busy?text.saving:text.addSlot}</button><button className="action-button" type="reset" onClick={(event)=>{(event.currentTarget.closest("details") as HTMLDetailsElement|null)?.removeAttribute("open");}}>{text.dismiss}</button></form></details>
        <details><summary className="action-button">{text.addEntry}</summary><form className="workspace-form-grid" onSubmit={addEntry}><Select name="groupId" label={text.group} items={data.groups}/><Select name="slotId" label={text.slot} items={data.slots}/><Select name="subjectId" label={text.subject} items={data.subjects}/><PersonSelect name="teacherPersonId" label={text.teacher} items={data.teachers} optional={text.optional}/><label className="workspace-field"><span>{text.room}</span><input name="roomKey"/></label><label className="workspace-field"><span>{text.weekday}</span><select name="weekday" defaultValue="1">{weekdays[locale].map((day,index)=><option value={index+1} key={day}>{day}</option>)}</select></label><label className="workspace-field"><span>{text.effectiveFrom}</span><input type="date" name="effectiveFrom" defaultValue={defaultSession?.startsOn??data.localDate} required/></label><label className="workspace-field"><span>{text.effectiveTo}</span><input type="date" name="effectiveTo"/></label><button className="action-button action-button-primary" disabled={busy}>{busy?text.saving:text.addEntry}</button><button className="action-button" type="reset" onClick={(event)=>{(event.currentTarget.closest("details") as HTMLDetailsElement|null)?.removeAttribute("open");}}>{text.dismiss}</button></form></details>
      </div> : null}

      <header className="workspace-section-heading"><h2>{text.timetable}</h2></header>
      <div className="workspace-table-wrap"><table><thead><tr><th>{text.weekday}</th><th>{text.time}</th><th>{text.group}</th><th>{text.subject}</th><th>{text.teacher}</th><th>{text.room}</th><th>{text.actions}</th></tr></thead><tbody>{data.entries.map((row)=><tr key={row.id}><td data-label={text.weekday}>{weekdays[locale][row.weekday-1]??row.weekday}</td><td data-label={text.time}>{row.startsAt}–{row.endsAt}</td><td data-label={text.group}>{row.groupLabel}</td><td data-label={text.subject}>{row.subjectLabel}</td><td data-label={text.teacher}>{row.teacherName}</td><td data-label={text.room}>{row.roomKey||"—"}</td><td data-label={text.actions}>{data.permissions.timetableManage?<button className="action-link" type="button" onClick={()=>mutate({action:"archive_timetable_entry",entryId:row.id})}>{text.archive}</button>:"—"}</td></tr>)}</tbody></table></div>

      {data.permissions.timetableManage && data.entries.length>0 ? <details><summary className="action-button">{text.exception}</summary><form className="workspace-form-grid" onSubmit={addException}><label className="workspace-field"><span>{text.timetable}</span><select name="entryId" required>{data.entries.map((row)=><option value={row.id} key={row.id}>{row.groupLabel} · {weekdays[locale][row.weekday-1]} · {row.startsAt}</option>)}</select></label><label className="workspace-field"><span>{text.lessonDate}</span><input name="sessionDate" type="date" defaultValue={data.selectedDate} required/></label><label className="workspace-field"><span>{text.actions}</span><select value={exceptionAction} onChange={(e)=>setExceptionAction(e.target.value as typeof exceptionAction)}><option value="cancel">{text.cancel}</option><option value="substitute">{text.substitute}</option><option value="reschedule">{text.reschedule}</option></select></label>{exceptionAction==="reschedule"?<><label className="workspace-field"><span>{text.replacementDate}</span><input name="replacementDate" type="date" required/></label><Select name="replacementSlotId" label={text.replacementSlot} items={data.slots}/><label className="workspace-field"><span>{text.room}</span><input name="replacementRoomKey"/></label></>:null}{exceptionAction!=="cancel"?<PersonSelect name="replacementTeacherPersonId" label={text.replacementTeacher} items={data.teachers} optional={exceptionAction==="reschedule"?text.optional:undefined}/>:null}<label className="workspace-field workspace-field-wide"><span>{text.note}</span><textarea name="note" rows={3}/></label><button className="action-button action-button-primary" disabled={busy}>{busy?text.saving:text.exception}</button><button className="action-button" type="reset" onClick={(event)=>{(event.currentTarget.closest("details") as HTMLDetailsElement|null)?.removeAttribute("open");}}>{text.dismiss}</button></form></details> : null}
    </section> : null}

    {tab === "homework" ? <section className="workspace-task-section">
      {data.permissions.homeworkManage ? <details><summary className="action-button">{text.createHomework}</summary><form className="workspace-form-grid" onSubmit={addHomework}><Select name="sessionId" label={text.date} items={data.sessions}/><label className="workspace-field"><span>{text.targetType}</span><select value={targetType} onChange={(e)=>setTargetType(e.target.value as typeof targetType)}><option value="group">{text.group}</option><option value="student">{text.student}</option></select></label>{targetType==="group"?<Select name="targetId" label={text.group} items={data.groups}/>:<label className="workspace-field"><span>{text.student}</span><select name="targetId" required>{data.students.map((s)=><option value={s.personId} key={s.personId}>{s.name} · {s.studentNumber}</option>)}</select></label>}<Select name="subjectId" label={text.subject} items={data.subjects}/><PersonSelect name="teacherPersonId" label={text.teacher} items={data.teachers}/><label className="workspace-field"><span>{text.title}</span><input name="title" required maxLength={200}/></label><label className="workspace-field workspace-field-wide"><span>{text.instructions}</span><textarea name="instructions" rows={4} required/></label><label className="workspace-field"><span>{text.due}</span><input type="datetime-local" name="dueAt" required/></label><label className="workspace-field"><span>{text.priority}</span><select name="priority" defaultValue="normal"><option value="low">{enumLabel("low",locale)}</option><option value="normal">{enumLabel("normal",locale)}</option><option value="high">{enumLabel("high",locale)}</option><option value="urgent">{enumLabel("urgent",locale)}</option></select></label><label className="workspace-field"><span>{text.attachment}</span><input type="file" name="attachment" accept="application/pdf,image/jpeg,image/png,image/webp"/></label><label className="workspace-check"><input type="checkbox" name="parentVisible" defaultChecked/><span>{text.parentVisible}</span></label><label className="workspace-check"><input type="checkbox" name="studentVisible" defaultChecked/><span>{text.studentVisible}</span></label><label className="workspace-check"><input type="checkbox" name="allowSubmission"/><span>{text.allowSubmission}</span></label><label className="workspace-check"><input type="checkbox" name="publish"/><span>{text.publish}</span></label><button className="action-button action-button-primary" disabled={busy}>{busy?text.saving:text.createHomework}</button><button className="action-button" type="reset" onClick={(event)=>{(event.currentTarget.closest("details") as HTMLDetailsElement|null)?.removeAttribute("open");}}>{text.dismiss}</button></form></details> : null}
      <header className="workspace-section-heading"><h2>{text.openHomework}</h2></header><div className="workspace-table-wrap"><table><thead><tr><th>{text.title}</th><th>{text.group}/{text.student}</th><th>{text.subject}</th><th>{text.due}</th><th>{text.priority}</th><th>{text.state}</th><th>{text.actions}</th></tr></thead><tbody>{data.homework.map((row)=><tr key={row.id}><td data-label={text.title}>{row.title}</td><td data-label={`${text.group}/${text.student}`}>{row.groupLabel||row.studentName||"—"}</td><td data-label={text.subject}>{row.subjectLabel}</td><td data-label={text.due}>{formatDateTime(row.dueAt)}</td><td data-label={text.priority}>{enumLabel(row.priority,locale)}</td><td data-label={text.state}>{enumLabel(row.state,locale)}</td><td data-label={text.actions}>{data.permissions.homeworkManage&&row.state!=="closed"&&row.state!=="cancelled"?<button className="action-link" type="button" onClick={()=>mutate({action:"set_homework_state",homeworkId:row.id,state:"closed"})}>{text.close}</button>:"—"}</td></tr>)}</tbody></table></div>
    </section> : null}

    {tab === "calendar" ? <section className="workspace-task-section">
      {data.permissions.calendarManage ? <details><summary className="action-button">{text.createEvent}</summary><form className="workspace-form-grid" onSubmit={addCalendar}><Select name="sessionId" label={text.date} items={data.sessions}/><label className="workspace-field"><span>{text.eventType}</span><select name="eventType" defaultValue="event"><option value="working_day">{enumLabel("working_day",locale)}</option><option value="holiday">{enumLabel("holiday",locale)}</option><option value="event">{enumLabel("event",locale)}</option><option value="exam_window">{enumLabel("exam_window",locale)}</option><option value="closure">{enumLabel("closure",locale)}</option></select></label><label className="workspace-field"><span>{text.label}</span><input name="label" required/></label><label className="workspace-field"><span>{text.starts}</span><input type="datetime-local" name="startsAt" required/></label><label className="workspace-field"><span>{text.ends}</span><input type="datetime-local" name="endsAt" required/></label><label className="workspace-field workspace-field-wide"><span>{text.description}</span><textarea name="description" rows={3}/></label><label className="workspace-field"><span>{text.location}</span><input name="location"/></label><label className="workspace-field"><span>{text.audience}</span><select name="audience" defaultValue="all"><option value="all">{enumLabel("all",locale)}</option><option value="parents">{enumLabel("parents",locale)}</option><option value="students">{enumLabel("students",locale)}</option><option value="teachers">{enumLabel("teachers",locale)}</option><option value="staff">{enumLabel("staff",locale)}</option></select></label><label className="workspace-field"><span>{text.priority}</span><select name="priority" defaultValue="normal"><option value="low">{enumLabel("low",locale)}</option><option value="normal">{enumLabel("normal",locale)}</option><option value="high">{enumLabel("high",locale)}</option><option value="urgent">{enumLabel("urgent",locale)}</option></select></label><label className="workspace-field"><span>{text.attachment}</span><input type="file" name="attachment" accept="application/pdf,image/jpeg,image/png,image/webp"/></label><label className="workspace-check"><input type="checkbox" name="affectsAttendance"/><span>{text.affectsAttendance}</span></label><button className="action-button action-button-primary" disabled={busy}>{busy?text.saving:text.createEvent}</button><button className="action-button" type="reset" onClick={(event)=>{(event.currentTarget.closest("details") as HTMLDetailsElement|null)?.removeAttribute("open");}}>{text.dismiss}</button></form></details> : null}
      <header className="workspace-section-heading"><h2>{text.upcoming}</h2></header><div className="workspace-table-wrap"><table><thead><tr><th>{text.title}</th><th>{text.eventType}</th><th>{text.starts}</th><th>{text.audience}</th><th>{text.priority}</th><th>{text.state}</th></tr></thead><tbody>{data.calendar.map((row)=><tr key={row.id}><td data-label={text.title}>{row.label}</td><td data-label={text.eventType}>{enumLabel(row.eventType,locale)}</td><td data-label={text.starts}>{formatDateTime(row.startsAt)}</td><td data-label={text.audience}>{enumLabel(row.audience,locale)}</td><td data-label={text.priority}>{enumLabel(row.priority,locale)}</td><td data-label={text.state}>{enumLabel(row.status,locale)}</td></tr>)}</tbody></table></div>
    </section> : null}

    {busy ? <span className="sr-only" role="status">{text.saving}</span> : null}
    <span hidden>{entryMap.size}</span>
  </div>;
}

function Select({ name, label, items }: { name: string; label: string; items: Array<{ id: number; label: string }> }) {
  return <label className="workspace-field"><span>{label}</span><select name={name} required defaultValue=""><option value="" disabled>—</option>{items.map((item)=><option value={item.id} key={item.id}>{item.label}</option>)}</select></label>;
}

function PersonSelect({ name, label, items, optional }: { name: string; label: string; items: Array<{ personId: number; name: string }>; optional?: string }) {
  return <label className="workspace-field"><span>{label}</span><select name={name} required={!optional} defaultValue=""><option value="">{optional??"—"}</option>{items.map((item)=><option value={item.personId} key={item.personId}>{item.name}</option>)}</select></label>;
}
