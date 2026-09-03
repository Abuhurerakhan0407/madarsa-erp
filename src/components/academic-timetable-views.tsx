"use client";

import { useMemo, useState } from "react";
import type { AcademicsWorkspace } from "@/lib/academics/workspace";

type Locale = "en" | "ur" | "ar";
type Props = { locale: Locale; data: AcademicsWorkspace };
type View = "group" | "teacher" | "student";

const weekdays = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const copy = {
  en: { title:"Timetable views", body:"Switch between group, teacher and student schedules without changing the underlying timetable.", view:"View by", group:"Group", teacher:"Teacher", student:"Student", choose:"Choose", day:"Day", time:"Time", subject:"Subject", room:"Room", empty:"No active timetable entries match this view." },
  ur: { title:"ٹائم ٹیبل ویوز", body:"اصل ٹائم ٹیبل بدلے بغیر گروپ، استاد اور طالب علم کے شیڈول دیکھیں۔", view:"دیکھیں", group:"گروپ", teacher:"استاد", student:"طالب علم", choose:"منتخب کریں", day:"دن", time:"وقت", subject:"مضمون", room:"کمرہ", empty:"اس انتخاب کے لیے کوئی فعال ٹائم ٹیبل اندراج نہیں۔" },
  ar: { title:"طرق عرض الجدول", body:"بدّل بين جدول المجموعة والمعلم والطالب دون تغيير الجدول الأساسي.", view:"عرض حسب", group:"المجموعة", teacher:"المعلم", student:"الطالب", choose:"اختر", day:"اليوم", time:"الوقت", subject:"المادة", room:"الغرفة", empty:"لا توجد حصص نشطة مطابقة لهذا العرض." }
} as const;

export function AcademicTimetableViews({ locale, data }: Props) {
  const text = copy[locale];
  const [view, setView] = useState<View>("group");
  const [selectedId, setSelectedId] = useState<number>(data.groups[0]?.id ?? 0);

  const options = view === "group"
    ? data.groups.map((item) => ({ id:item.id, label:item.label }))
    : view === "teacher"
      ? data.teachers.map((item) => ({ id:item.personId, label:item.name }))
      : data.students.map((item) => ({ id:item.personId, label:`${item.name} · ${item.studentNumber}` }));

  const entries = useMemo(() => {
    if (!selectedId) return [];
    if (view === "group") return data.entries.filter((entry) => entry.groupId === selectedId);
    if (view === "teacher") return data.entries.filter((entry) => entry.teacherPersonId === selectedId);
    const student = data.students.find((item) => item.personId === selectedId);
    return student?.groupId ? data.entries.filter((entry) => entry.groupId === student.groupId && entry.sessionId === student.sessionId) : [];
  }, [data.entries, data.students, selectedId, view]);

  function changeView(next: View) {
    setView(next);
    const first = next === "group" ? data.groups[0]?.id : next === "teacher" ? data.teachers[0]?.personId : data.students[0]?.personId;
    setSelectedId(first ?? 0);
  }

  return <section className="workspace-task-section academics-timetable-views" data-page-section>
    <header className="workspace-section-heading"><div><h2>{text.title}</h2><p>{text.body}</p></div></header>
    <div className="workspace-filter-bar">
      <label className="workspace-field"><span>{text.view}</span><select value={view} onChange={(event)=>changeView(event.target.value as View)}><option value="group">{text.group}</option><option value="teacher">{text.teacher}</option><option value="student">{text.student}</option></select></label>
      <label className="workspace-field"><span>{text.choose}</span><select value={selectedId} onChange={(event)=>setSelectedId(Number(event.target.value))}>{options.length===0?<option value={0}>{text.choose}</option>:options.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    </div>
    {entries.length===0 ? <div className="workspace-inline-state"><strong>{text.empty}</strong></div> : <div className="workspace-table-wrap"><table><thead><tr><th>{text.day}</th><th>{text.time}</th><th>{text.group}</th><th>{text.subject}</th><th>{text.teacher}</th><th>{text.room}</th></tr></thead><tbody>{entries.map((entry)=><tr key={entry.id}><td>{weekdays[entry.weekday-1]??entry.weekday}</td><td>{entry.startsAt}–{entry.endsAt}</td><td>{entry.groupLabel}</td><td>{entry.subjectLabel}</td><td>{entry.teacherName}</td><td>{entry.roomKey||"—"}</td></tr>)}</tbody></table></div>}
  </section>;
}
