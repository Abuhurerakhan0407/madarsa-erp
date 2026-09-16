"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { TeachersWorkspace, TeacherLabels } from "@/lib/teachers/workspace";

type UiLocale = "en" | "ur";

const copy = {
  en: {
    kicker: "Teaching team",
    title: "Teachers",
    body: "Teaching identity, contact details, assignments, timetable, portal status and attendance—without payroll or private HR fields.",
    attendanceAction: "Teacher attendance",
    accessAction: "Teacher access",
    search: "Search",
    searchPlaceholder: "Name or teacher ID",
    status: "Status",
    allCurrent: "All current",
    active: "Active",
    onLeave: "On leave",
    suspended: "Suspended",
    searching: "Searching…",
    loading: "Loading…",
    clear: "Clear",
    teachers: "Teachers",
    portalActive: "Portal active",
    needEmail: "Need email",
    open: "Open",
    contact: "Contact",
    emailMissing: "Email not added",
    phoneMissing: "Phone not added",
    joined: "Joined",
    teachingScope: "Teaching scope",
    programs: "Programs",
    subjects: "Subjects",
    groups: "Groups",
    notAssigned: "Not assigned",
    attendance30: "Attendance · 30 days",
    present: "present",
    absent: "absent",
    late: "late",
    timetable: "Timetable",
    activePeriods: "active periods",
    lastPortalLogin: "Last portal login",
    noPortalLogin: "No portal login yet",
    noTeachers: "No teachers found",
    noTeachersBody: "Adjust the search or status filter. Existing HR records were not deleted or changed.",
    accountActive: "Active",
    accountDisabled: "Disabled",
    accountEmailRequired: "Email required",
    accountNotCreated: "Not created"
  },
  ur: {
    kicker: "تدریسی ٹیم",
    title: "اساتذہ",
    body: "اساتذہ کی شناخت، رابطہ معلومات، تدریسی ذمہ داریاں، ٹائم ٹیبل، پورٹل حیثیت اور حاضری دیکھیں—تنخواہ یا نجی HR معلومات کے بغیر۔",
    attendanceAction: "اساتذہ کی حاضری",
    accessAction: "اساتذہ کی پورٹل رسائی",
    search: "تلاش",
    searchPlaceholder: "نام یا استاد ID",
    status: "حیثیت",
    allCurrent: "تمام موجودہ",
    active: "فعال",
    onLeave: "رخصت پر",
    suspended: "معطل",
    searching: "تلاش جاری ہے…",
    loading: "لوڈ ہو رہا ہے…",
    clear: "فلٹر صاف کریں",
    teachers: "اساتذہ",
    portalActive: "پورٹل فعال",
    needEmail: "ای میل درکار",
    open: "کھولیں",
    contact: "رابطہ",
    emailMissing: "ای میل شامل نہیں",
    phoneMissing: "فون شامل نہیں",
    joined: "شمولیت",
    teachingScope: "تدریسی ذمہ داریاں",
    programs: "پروگرام",
    subjects: "مضامین",
    groups: "کلاس / گروپس",
    notAssigned: "مقرر نہیں",
    attendance30: "حاضری · 30 دن",
    present: "حاضر",
    absent: "غیر حاضر",
    late: "تاخیر",
    timetable: "ٹائم ٹیبل",
    activePeriods: "فعال پیریڈ",
    lastPortalLogin: "آخری پورٹل لاگ اِن",
    noPortalLogin: "ابھی تک پورٹل لاگ اِن نہیں ہوا",
    noTeachers: "کوئی استاد نہیں ملا",
    noTeachersBody: "تلاش یا حیثیت کا فلٹر تبدیل کریں۔ موجودہ HR ریکارڈ حذف یا تبدیل نہیں کیے گئے۔",
    accountActive: "فعال",
    accountDisabled: "غیر فعال",
    accountEmailRequired: "ای میل درکار",
    accountNotCreated: "اکاؤنٹ نہیں بنا"
  }
} as const;

function uiLocale(locale: Locale): UiLocale {
  return locale === "ur" ? "ur" : "en";
}

function label(labels: TeacherLabels, locale: Locale, fallback: string) {
  if (locale === "ur") return labels.ur || fallback;
  return labels.en || fallback;
}

function account(status: string, locale: UiLocale) {
  const text = copy[locale];
  return status === "active"
    ? text.accountActive
    : status === "disabled"
      ? text.accountDisabled
      : status === "email_required"
        ? text.accountEmailRequired
        : text.accountNotCreated;
}

function designation(key: string, value: string, locale: UiLocale) {
  if (locale === "en") return value;
  const urdu: Record<string, string> = {
    teacher: "استاد",
    assistant_teacher: "معاون استاد",
    attendance_supervisor: "حاضری نگران",
    dars_e_nizami_teacher: "درسِ نظامی استاد",
    admissions_coordinator: "داخلہ رابطہ کار",
    hifz_instructor: "حفظ استاد",
    exam_evaluator: "امتحانی ممتحن"
  };
  return urdu[key] || value;
}

function pct(present: number, total: number) {
  return total > 0 ? `${Math.round((present / total) * 100)}%` : "—";
}

export function TeachersWorkspaceView({ locale, data, search, state }: { locale: Locale; data: TeachersWorkspace; search: string; state: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const language = uiLocale(locale);
  const text = copy[language];

  function go(next: { q?: string; state?: string }) {
    const params = new URLSearchParams();
    const q = next.q !== undefined ? next.q : search;
    const nextState = next.state !== undefined ? next.state : state;
    if (q) params.set("q", q);
    if (nextState) params.set("state", nextState);
    const query = params.toString();
    startTransition(() => router.push(`/${locale}/staff${query ? `?${query}` : ""}`));
  }

  const active = data.teachers.filter((teacher) => teacher.state === "active").length;
  const access = data.teachers.filter((teacher) => teacher.accountStatus === "active").length;
  const missingEmail = data.teachers.filter((teacher) => !teacher.email).length;
  const localeTag = language === "ur" ? "ur-PK" : "en-US";

  return <div className="flow-stack">
    <section className="professional-card" data-page-section>
      <div className="section-heading">
        <div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{text.body}</p></div>
        <div className="quick-actions"><Link className="action-button" href={`/${locale}/staff/attendance`}>{text.attendanceAction}</Link></div>
      </div>
      <form className="form-grid" aria-busy={pending || undefined} onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        go({ q: String(fd.get("q") || "").trim() });
      }}>
        <label className="field-label">{text.search}<input className="text-field" name="q" defaultValue={search} placeholder={text.searchPlaceholder} disabled={pending} /></label>
        <label className="field-label">{text.status}<select className="text-field" value={state} disabled={pending} onChange={(event) => go({ state: event.target.value })}><option value="">{text.allCurrent}</option><option value="active">{text.active}</option><option value="on_leave">{text.onLeave}</option><option value="suspended">{text.suspended}</option></select></label>
        <button className="action-button" type="submit" disabled={pending} aria-busy={pending || undefined}>{pending ? <><span className="inline-spinner" aria-hidden="true" />{text.searching}</> : text.search}</button>
        {search || state ? <button className="action-button" type="button" disabled={pending} onClick={() => go({ q: "", state: "" })}>{pending ? text.loading : text.clear}</button> : null}
      </form>
    </section>
    <section className="attendance-metrics" data-page-section>{[[text.teachers, data.teachers.length], [text.active, active], [text.portalActive, access], [text.needEmail, missingEmail]].map(([key, value]) => <article className="attendance-metric" key={String(key)}><span>{key}</span><strong>{value}</strong></article>)}</section>
    <section className="flow-stack teacher-card-list" data-page-section>{data.teachers.length ? data.teachers.map((teacher) => <article className="professional-card" key={teacher.employmentId}>
      <div className="section-heading">
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div className="teacher-avatar" aria-hidden="true">{teacher.photoStoragePath ? <img src={`/api/teachers/photo/${teacher.personId}`} alt="" /> : <span>{teacher.displayName.slice(0, 1).toUpperCase()}</span>}</div>
          <div><p className="state-kicker">{teacher.teacherId}</p><h2>{teacher.displayName}</h2>{teacher.nameNative ? <p dir="auto">{teacher.nameNative}</p> : null}<p>{designation(teacher.designationKey, teacher.designation, language)}</p></div>
        </div>
        <div className="quick-actions"><span className="status-pill">{account(teacher.accountStatus, language)}</span><Link className="action-button" href={`/${locale}/staff/${teacher.employmentId}`}>{text.open}</Link></div>
      </div>
      <div className="demo-card-grid">
        <div className="demo-card"><strong>{text.contact}</strong><p>{teacher.email || text.emailMissing}</p><p>{teacher.phone || text.phoneMissing}</p><small>{text.joined} {teacher.joinedOn || "—"}</small></div>
        <div className="demo-card"><strong>{text.teachingScope}</strong><p>{text.programs}: {teacher.assignedPrograms.length ? teacher.assignedPrograms.map((item) => label(item.labels, locale, `${text.programs} ${item.id}`)).join(", ") : text.notAssigned}</p><p>{text.subjects}: {teacher.assignedSubjects.length ? teacher.assignedSubjects.map((item) => label(item.labels, locale, `${text.subjects} ${item.id}`)).join(", ") : text.notAssigned}</p><p>{text.groups}: {teacher.assignedGroups.length ? teacher.assignedGroups.map((item) => label(item.labels, locale, `${text.groups} ${item.id}`)).join(", ") : text.notAssigned}</p></div>
        <div className="demo-card"><strong>{text.attendance30}</strong><p>{pct(teacher.attendance.present, teacher.attendance.total)} {text.present}</p><small>{teacher.attendance.present} {text.present} · {teacher.attendance.absent} {text.absent} · {teacher.attendance.late} {text.late}</small></div>
        <div className="demo-card"><strong>{text.timetable}</strong><p>{teacher.timetable.length} {text.activePeriods}</p><small>{teacher.lastLogin ? `${text.lastPortalLogin} ${new Date(teacher.lastLogin).toLocaleString(localeTag)}` : text.noPortalLogin}</small></div>
      </div>
    </article>) : <section className="professional-card"><h2>{text.noTeachers}</h2><p>{text.noTeachersBody}</p></section>}</section>
  </div>;
}
