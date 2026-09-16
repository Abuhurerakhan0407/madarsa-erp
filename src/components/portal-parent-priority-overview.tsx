import type { ReactNode } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import { formatPortalDateTime, localizedPortalText } from "@/lib/portal/locale";

type Raw = Record<string, unknown>;
const object = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const rows = (value: unknown): Raw[] => Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Raw[] : [];
const text = (value: unknown) => typeof value === "string" ? value : "";
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

const copy = {
  en: {
    priority: "Priority", urgent: "Urgent notices", noUrgent: "No urgent notices right now.", schedule: "Today's schedule", student: "Student", time: "Time", subject: "Subject", teacher: "Teacher", room: "Room", rescheduled: "Rescheduled", noSchedule: "No classes are scheduled for today, or the institution is closed.", homework: "Homework", due: "Due", noHomework: "No current parent-visible homework.", progress: "Qur'an & teaching progress", noQuran: "No recorded Qur'an attempt yet", noStudents: "No linked students.", results: "Published results", exam: "Exam", result: "Result", grade: "Grade", rank: "Rank", noResults: "No published results yet.", events: "Upcoming events", event: "Event", normal: "Normal", important: "Important", urgentPriority: "Urgent", noEvents: "No upcoming parent events.", directory: "Parent-safe directory", teachers: "Teachers", assignedTeam: "Assigned teaching team", noTeachers: "No teacher assignments are linked to these students yet."
  },
  ur: {
    priority: "ترجیح", urgent: "فوری اطلاعات", noUrgent: "اس وقت کوئی فوری اطلاع نہیں۔", schedule: "آج کا شیڈول", student: "طالب علم", time: "وقت", subject: "مضمون", teacher: "استاد", room: "کمرہ", rescheduled: "دوبارہ مقرر", noSchedule: "آج کوئی کلاس مقرر نہیں، یا ادارہ بند ہے۔", homework: "گھر کا کام", due: "آخری وقت", noHomework: "اس وقت والدین کے لیے کوئی گھر کا کام موجود نہیں۔", progress: "قرآن اور تدریسی پیش رفت", noQuran: "ابھی قرآن کی کوئی کوشش درج نہیں ہوئی", noStudents: "کوئی منسلک طالب علم نہیں۔", results: "شائع شدہ نتائج", exam: "امتحان", result: "نتیجہ", grade: "گریڈ", rank: "درجہ", noResults: "ابھی کوئی نتیجہ شائع نہیں ہوا۔", events: "آنے والے پروگرام", event: "پروگرام", normal: "معمول", important: "اہم", urgentPriority: "فوری", noEvents: "والدین کے لیے کوئی آنے والا پروگرام نہیں۔", directory: "والدین کے لیے محفوظ ڈائریکٹری", teachers: "اساتذہ", assignedTeam: "مقرر تدریسی ٹیم", noTeachers: "ان طلبہ کے ساتھ ابھی کوئی استاد مقرر نہیں۔"
  }
} as const;

const eventTypes = {
  en: { holiday: "Holiday", parent_meeting: "Parent meeting", exam: "Exam", event: "Event", closure: "Closure", class: "Class" },
  ur: { holiday: "تعطیل", parent_meeting: "والدین میٹنگ", exam: "امتحان", event: "پروگرام", closure: "بندش", class: "کلاس" }
} as const;
const quranCategories = {
  en: { sabaq: "Sabaq", sabqi: "Sabqi", manzil: "Manzil", revision: "Revision", nazira: "Nazira" },
  ur: { sabaq: "سبق", sabqi: "سبقی", manzil: "منزل", revision: "دہرائی", nazira: "ناظرہ" }
} as const;
const designations = {
  en: { teacher: "Teacher", senior_teacher: "Senior teacher", head_teacher: "Head teacher" },
  ur: { teacher: "استاد", senior_teacher: "سینئر استاد", head_teacher: "صدر مدرس" }
} as const;

function priorityLabel(value: string, locale: SupportedLocale) {
  const t = copy[locale];
  return value === "urgent" ? t.urgentPriority : value === "important" ? t.important : t.normal;
}
function eventTypeLabel(value: string, locale: SupportedLocale) {
  return eventTypes[locale][value as keyof typeof eventTypes.en] ?? copy[locale].event;
}
function quranCategoryLabel(value: string, locale: SupportedLocale) {
  return quranCategories[locale][value as keyof typeof quranCategories.en] ?? value;
}
function designationLabel(value: string, locale: SupportedLocale) {
  const normalized = value.toLowerCase().trim().replaceAll(" ", "_");
  return designations[locale][normalized as keyof typeof designations.en] ?? value;
}
function aggregateStatus(value: string, locale: SupportedLocale) {
  const labels = {
    en: { pass: "Pass", passed: "Passed", fail: "Fail", failed: "Failed", absent: "Absent", incomplete: "Incomplete" },
    ur: { pass: "کامیاب", passed: "کامیاب", fail: "ناکام", failed: "ناکام", absent: "غیر حاضر", incomplete: "نامکمل" }
  } as const;
  return labels[locale][value as keyof typeof labels.en] ?? value;
}

export function PortalParentPriorityOverview({ tenantId, locale, overview, linkedChildren, attendance }: { tenantId: number; locale: SupportedLocale; overview: Raw; linkedChildren: Raw[]; attendance: ReactNode }) {
  const t = copy[locale];
  const urgent = rows(overview.urgent_notices), schedule = rows(overview.today_schedule), homework = rows(overview.homework), results = rows(overview.results), events = rows(overview.events), teachers = rows(overview.teachers);
  return <div className="flow-stack" data-testid="parent-priority-overview">
    <section className="professional-card" data-priority="1-urgent-notices"><p className="state-kicker">{t.priority} 1</p><h2>{t.urgent}</h2>{urgent.length ? <div className="flow-stack">{urgent.map(item => <article className="demo-card" key={num(item.id)}><strong>{localizedPortalText(item.labels, locale, "—")}</strong><p>{localizedPortalText(item.body, locale)}</p><small>{formatPortalDateTime(item.published_at, locale)}</small></article>)}</div> : <p>{t.noUrgent}</p>}</section>
    <section className="professional-card" data-priority="2-today-schedule"><p className="state-kicker">{t.priority} 2</p><h2>{t.schedule}</h2>{schedule.length ? <div className="table-wrap"><table><thead><tr><th>{t.student}</th><th>{t.time}</th><th>{t.subject}</th><th>{t.teacher}</th><th>{t.room}</th></tr></thead><tbody>{schedule.map((item, index) => <tr key={`${num(item.student_person_id)}:${num(item.entry_id)}:${index}`}><td>{text(item.student_name)}</td><td>{text(item.starts_at)}–{text(item.ends_at)}</td><td>{localizedPortalText(item.subject_labels, locale, "—")}{text(item.occurrence_type) === "rescheduled" ? <small> · {t.rescheduled}</small> : null}</td><td>{text(item.teacher_name) || "—"}{text(item.teacher_designation) ? <small> · {designationLabel(text(item.teacher_designation), locale)}</small> : null}</td><td>{text(item.room_key) || "—"}</td></tr>)}</tbody></table></div> : <p>{t.noSchedule}</p>}</section>
    <section data-priority="3-attendance">{attendance}</section>
    <section className="professional-card" data-priority="4-homework"><p className="state-kicker">{t.priority} 4</p><h2>{t.homework}</h2>{homework.length ? <div className="demo-card-grid">{homework.map(item => <article className="demo-card" key={num(item.id)}><p className="state-kicker">{text(item.student_name)} · {localizedPortalText(item.subject_labels, locale, "—")}</p><h3>{localizedPortalText(item.title, locale, text(item.title))}</h3><p>{localizedPortalText(item.instructions, locale, text(item.instructions))}</p><small>{t.due} {formatPortalDateTime(item.due_at, locale)}{text(item.teacher_name) ? ` · ${text(item.teacher_name)}` : ""}</small></article>)}</div> : <p>{t.noHomework}</p>}</section>
    <section className="professional-card" data-priority="5-teaching-progress"><p className="state-kicker">{t.priority} 5</p><h2>{t.progress}</h2>{linkedChildren.length ? <div className="demo-card-grid">{linkedChildren.map(child => { const quran = object(child.latest_quran), category = text(quran.work_category); return <article className="demo-card" key={num(child.person_id)}><p className="state-kicker">{text(child.student_number)}</p><h3>{text(child.display_name)}</h3><p>{category ? quranCategoryLabel(category, locale) : t.noQuran}{quran.overall_score != null ? ` · ${num(quran.overall_score)}%` : ""}</p>{text(quran.parent_visible_remark) ? <small>{text(quran.parent_visible_remark)}</small> : null}</article>; })}</div> : <p>{t.noStudents}</p>}</section>
    <section className="professional-card" data-priority="6-results"><p className="state-kicker">{t.priority} 6</p><h2>{t.results}</h2>{results.length ? <div className="table-wrap"><table><thead><tr><th>{t.student}</th><th>{t.exam}</th><th>{t.result}</th><th>{t.grade}</th></tr></thead><tbody>{results.map(item => <tr key={num(item.snapshot_id)}><td>{text(item.student_name)}</td><td>{localizedPortalText(item.exam_labels, locale, "—")}</td><td>{num(item.percentage).toFixed(1)}% · {aggregateStatus(text(item.aggregate_status) || "—", locale)}</td><td>{text(item.grade_key) || "—"}{item.rank_value != null ? ` · ${t.rank} ${num(item.rank_value)}` : ""}</td></tr>)}</tbody></table></div> : <p>{t.noResults}</p>}</section>
    <section className="professional-card" data-priority="7-events"><p className="state-kicker">{t.priority} 7</p><h2>{t.events}</h2>{events.length ? <div className="demo-card-grid">{events.map(item => <article className="demo-card" key={num(item.id)}><p className="state-kicker">{eventTypeLabel(text(item.event_type), locale)} · {priorityLabel(text(item.priority), locale)}</p><h3>{localizedPortalText(item.labels, locale, "—")}</h3>{text(item.description) ? <p>{localizedPortalText(item.description, locale, text(item.description))}</p> : null}<small>{formatPortalDateTime(item.starts_at, locale)}{text(item.location) ? ` · ${text(item.location)}` : ""}</small></article>)}</div> : <p>{t.noEvents}</p>}</section>
    <section className="professional-card"><p className="state-kicker">{t.directory}</p><h2>{t.teachers}</h2>{teachers.length ? <div className="demo-card-grid">{teachers.map(item => <article className="demo-card" key={`${num(item.teacher_person_id)}:${num(item.group_id)}`}><div style={{ display: "flex", gap: 12, alignItems: "center" }}>{text(item.photo_storage_path) ? <img src={`/api/portal/teachers/photo/${num(item.teacher_person_id)}?tenant=${tenantId}`} alt="" width={48} height={48} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: "50%" }} /> : null}<div><h3>{text(item.teacher_name)}</h3><p>{designationLabel(text(item.designation) || "teacher", locale)}</p></div></div><p>{localizedPortalText(item.program_labels, locale, "—")} · {localizedPortalText(item.group_labels, locale, "—")}</p><small>{rows(item.subjects).map(subject => localizedPortalText(subject.labels, locale)).filter(Boolean).join(" · ") || t.assignedTeam}</small></article>)}</div> : <p>{t.noTeachers}</p>}</section>
  </div>;
}
