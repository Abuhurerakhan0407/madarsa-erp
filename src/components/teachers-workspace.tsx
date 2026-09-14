"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { TeachersWorkspace, TeacherLabels } from "@/lib/teachers/workspace";

function label(labels: TeacherLabels, locale: Locale, fallback: string) {
  return labels[locale] || labels.en || labels.ur || labels.ar || fallback;
}

function account(status: string) {
  return status === "active" ? "Active" : status === "disabled" ? "Disabled" : status === "email_required" ? "Email required" : "Not created";
}

function pct(present: number, total: number) {
  return total > 0 ? `${Math.round((present / total) * 100)}%` : "—";
}

export function TeachersWorkspaceView({ locale, data, search, state }: { locale: Locale; data: TeachersWorkspace; search: string; state: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const searching = locale === "ur" ? "تلاش جاری ہے…" : "Searching…";
  const loading = locale === "ur" ? "لوڈ ہو رہا ہے…" : "Loading…";

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

  return <div className="flow-stack">
    <section className="professional-card" data-page-section>
      <div className="section-heading">
        <div><p className="state-kicker">Teaching team</p><h1>Teachers</h1><p>Teaching identity, contact details, assignments, timetable, portal status and attendance—without payroll or private HR fields.</p></div>
        <div className="quick-actions"><Link className="action-button" href={`/${locale}/staff/attendance`}>Teacher attendance</Link><Link className="action-button" href={`/${locale}/portals?tab=teachers`}>Teacher access</Link></div>
      </div>
      <form className="form-grid" aria-busy={pending || undefined} onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        go({ q: String(fd.get("q") || "").trim() });
      }}>
        <label className="field-label">Search<input className="text-field" name="q" defaultValue={search} placeholder="Name or teacher ID" disabled={pending} /></label>
        <label className="field-label">Status<select className="text-field" value={state} disabled={pending} onChange={(event) => go({ state: event.target.value })}><option value="">All current</option><option value="active">Active</option><option value="on_leave">On leave</option><option value="suspended">Suspended</option></select></label>
        <button className="action-button" type="submit" disabled={pending} aria-busy={pending || undefined}>{pending ? <><span className="inline-spinner" aria-hidden="true" />{searching}</> : "Search"}</button>
        {search || state ? <button className="action-button" type="button" disabled={pending} onClick={() => go({ q: "", state: "" })}>{pending ? loading : "Clear"}</button> : null}
      </form>
    </section>
    <section className="attendance-metrics" data-page-section>{[["Teachers", data.teachers.length], ["Active", active], ["Portal active", access], ["Need email", missingEmail]].map(([key, value]) => <article className="attendance-metric" key={String(key)}><span>{key}</span><strong>{value}</strong></article>)}</section>
    <section className="flow-stack teacher-card-list" data-page-section>{data.teachers.length ? data.teachers.map((teacher) => <article className="professional-card" key={teacher.employmentId}>
      <div className="section-heading">
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div className="teacher-avatar" aria-hidden="true">{teacher.photoStoragePath ? <img src={`/api/teachers/photo/${teacher.personId}`} alt="" /> : <span>{teacher.displayName.slice(0, 1).toUpperCase()}</span>}</div>
          <div><p className="state-kicker">{teacher.teacherId}</p><h2>{teacher.displayName}</h2>{teacher.nameNative ? <p dir="auto">{teacher.nameNative}</p> : null}<p>{teacher.designation}</p></div>
        </div>
        <div className="quick-actions"><span className="status-pill">{account(teacher.accountStatus)}</span><Link className="action-button" href={`/${locale}/staff/${teacher.employmentId}`}>Open</Link></div>
      </div>
      <div className="demo-card-grid">
        <div className="demo-card"><strong>Contact</strong><p>{teacher.email || "Email not added"}</p><p>{teacher.phone || "Phone not added"}</p><small>Joined {teacher.joinedOn || "—"}</small></div>
        <div className="demo-card"><strong>Teaching scope</strong><p>Programs: {teacher.assignedPrograms.length ? teacher.assignedPrograms.map((item) => label(item.labels, locale, `Program ${item.id}`)).join(", ") : "Not assigned"}</p><p>Subjects: {teacher.assignedSubjects.length ? teacher.assignedSubjects.map((item) => label(item.labels, locale, `Subject ${item.id}`)).join(", ") : "Not assigned"}</p><p>Groups: {teacher.assignedGroups.length ? teacher.assignedGroups.map((item) => label(item.labels, locale, `Group ${item.id}`)).join(", ") : "Not assigned"}</p></div>
        <div className="demo-card"><strong>Attendance · 30 days</strong><p>{pct(teacher.attendance.present, teacher.attendance.total)} present</p><small>{teacher.attendance.present} present · {teacher.attendance.absent} absent · {teacher.attendance.late} late</small></div>
        <div className="demo-card"><strong>Timetable</strong><p>{teacher.timetable.length} active periods</p><small>{teacher.lastLogin ? `Last portal login ${new Date(teacher.lastLogin).toLocaleString()}` : "No portal login yet"}</small></div>
      </div>
    </article>) : <section className="professional-card"><h2>No teachers found</h2><p>Adjust the search/status filter. Existing HR records were not deleted or changed.</p></section>}</section>
  </div>;
}
