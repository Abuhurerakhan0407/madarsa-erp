"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { TeachersWorkspace } from "@/lib/teachers/workspace";

type UiLocale = "en" | "ur";

const copy = {
  en: {
    kicker: "Teaching team",
    title: "Teachers",
    body: "Find teachers quickly, see their teaching scope, and open a full profile only when needed.",
    attendanceAction: "Teacher attendance",
    accessAction: "Manage access",
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
    portalActive: "Access active",
    open: "Open profile",
    teachingScope: "Teaching scope",
    programs: "Programs",
    subjects: "Subjects",
    groups: "Groups",
    notAssigned: "Not assigned",
    assigned: "assigned",
    noTeachers: "No teachers found",
    noTeachersBody: "Adjust the search or status filter. Existing HR records were not deleted or changed.",
    accountActive: "Access active",
    accountDisabled: "Access disabled",
    accountEmailRequired: "Access setup",
    accountNotCreated: "Access setup"
  },
  ur: {
    kicker: "تدریسی ٹیم",
    title: "اساتذہ",
    body: "اساتذہ کو جلد تلاش کریں، تدریسی دائرہ دیکھیں، اور ضرورت پر مکمل پروفائل کھولیں۔",
    attendanceAction: "اساتذہ کی حاضری",
    accessAction: "رسائی منظم کریں",
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
    portalActive: "رسائی فعال",
    open: "پروفائل کھولیں",
    teachingScope: "تدریسی ذمہ داریاں",
    programs: "پروگرام",
    subjects: "مضامین",
    groups: "کلاس / گروپس",
    notAssigned: "مقرر نہیں",
    assigned: "مقرر",
    noTeachers: "کوئی استاد نہیں ملا",
    noTeachersBody: "تلاش یا حیثیت کا فلٹر تبدیل کریں۔ موجودہ HR ریکارڈ حذف یا تبدیل نہیں کیے گئے۔",
    accountActive: "رسائی فعال",
    accountDisabled: "رسائی غیر فعال",
    accountEmailRequired: "رسائی سیٹ اپ",
    accountNotCreated: "رسائی سیٹ اپ"
  }
} as const;

function uiLocale(locale: Locale): UiLocale {
  return locale === "ur" ? "ur" : "en";
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
    <section className="attendance-metrics teacher-summary-metrics" data-page-section>{[[text.teachers, data.teachers.length], [text.active, active], [text.portalActive, access]].map(([key, value]) => <article className="attendance-metric" key={String(key)}><span>{key}</span><strong>{value}</strong></article>)}</section>
    <section className="teacher-card-list" data-page-section>{data.teachers.length ? data.teachers.map((teacher) => {
      const scopeParts = [
        teacher.assignedGroups.length ? `${teacher.assignedGroups.length} ${text.groups}` : "",
        teacher.assignedSubjects.length ? `${teacher.assignedSubjects.length} ${text.subjects}` : ""
      ].filter(Boolean);
      return <Link className="teacher-list-row" href={`/${locale}/staff/${teacher.employmentId}`} key={teacher.employmentId} aria-label={`${text.open}: ${teacher.displayName}`}>
        <div className="teacher-avatar" aria-hidden="true">{teacher.photoStoragePath ? <Image src={`/api/teachers/photo/${teacher.personId}`} alt="" width={48} height={48} unoptimized /> : <span>{teacher.displayName.slice(0, 1).toUpperCase()}</span>}</div>
        <div className="teacher-list-main">
          <div className="teacher-list-name">
            <strong>{teacher.displayName}</strong>
            {teacher.nameNative ? <span dir="auto">{teacher.nameNative}</span> : null}
          </div>
          <span className="teacher-list-role">{designation(teacher.designationKey, teacher.designation, language)} · {teacher.teacherId}</span>
          <span className="teacher-list-scope">{scopeParts.length ? scopeParts.join(" · ") : text.notAssigned}</span>
        </div>
        <div className="teacher-list-end">
          <span className="status-pill">{account(teacher.accountStatus, language)}</span>
          <span className="teacher-list-chevron" aria-hidden="true">›</span>
        </div>
      </Link>;
    }) : <section className="professional-card"><h2>{text.noTeachers}</h2><p>{text.noTeachersBody}</p></section>}</section>
  </div>;
}
