"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { AttendanceWorkspace as Workspace } from "@/lib/attendance/workspace";

const copy = {
  en: {
    date: "Attendance date", start: "Start attendance", starting: "Starting…", search: "Search student or ID", searchAction: "Search", clear: "Clear",
    total: "Students", present: "Present", absent: "Absent", late: "Late", leave: "Leave", unmarked: "Unmarked", device: "Device marks", pending: "Pending corrections",
    notStarted: "Attendance has not been started for this date.", notStartedBody: "Start attendance to snapshot the current active student roster for this branch.",
    status: "Status", source: "Source", group: "Class / group", notMarked: "Not marked", corrected: "Corrected", pendingCorrection: "Correction pending",
    correction: "Correct attendance", reason: "Reason for correction", reasonHint: "Required for the immutable audit history (minimum 8 characters)", saveCorrection: "Submit correction", cancel: "Cancel",
    manual: "Manual", biometric: "Biometric", nfc: "NFC", import: "Import", saving: "Saving…", error: "Unable to save attendance.", noStudents: "No students match this view.",
    previous: "Previous", next: "Next", page: "Page", original: "Original"
  },
  ur: {
    date: "حاضری کی تاریخ", start: "حاضری شروع کریں", starting: "شروع ہو رہی ہے…", search: "طالب علم یا ID تلاش کریں", searchAction: "تلاش", clear: "صاف کریں",
    total: "طلبہ", present: "حاضر", absent: "غائب", late: "تاخیر", leave: "رخصت", unmarked: "بغیر نشان", device: "ڈیوائس مارکس", pending: "زیرِ التوا اصلاحات",
    notStarted: "اس تاریخ کے لیے حاضری شروع نہیں ہوئی۔", notStartedBody: "موجودہ فعال طلبہ کی فہرست محفوظ کرنے کے لیے حاضری شروع کریں۔",
    status: "حالت", source: "ذریعہ", group: "کلاس / گروپ", notMarked: "نشان نہیں", corrected: "اصلاح شدہ", pendingCorrection: "اصلاح زیرِ التوا",
    correction: "حاضری درست کریں", reason: "اصلاح کی وجہ", reasonHint: "آڈٹ ریکارڈ کے لیے کم از کم 8 حروف ضروری ہیں", saveCorrection: "اصلاح جمع کریں", cancel: "منسوخ",
    manual: "دستی", biometric: "بایومیٹرک", nfc: "NFC", import: "امپورٹ", saving: "محفوظ ہو رہا ہے…", error: "حاضری محفوظ نہیں ہو سکی۔", noStudents: "اس منظر میں کوئی طالب علم نہیں۔",
    previous: "پچھلا", next: "اگلا", page: "صفحہ", original: "اصل"
  },
  ar: {
    date: "تاريخ الحضور", start: "بدء الحضور", starting: "جارٍ البدء…", search: "ابحث عن طالب أو رقم", searchAction: "بحث", clear: "مسح",
    total: "الطلاب", present: "حاضر", absent: "غائب", late: "متأخر", leave: "إجازة", unmarked: "غير مسجل", device: "تسجيلات الجهاز", pending: "تصحيحات معلقة",
    notStarted: "لم يبدأ الحضور لهذا التاريخ.", notStartedBody: "ابدأ الحضور لحفظ لقطة قائمة الطلاب النشطين الحالية لهذا الفرع.",
    status: "الحالة", source: "المصدر", group: "الفصل / المجموعة", notMarked: "غير مسجل", corrected: "تم التصحيح", pendingCorrection: "التصحيح معلق",
    correction: "تصحيح الحضور", reason: "سبب التصحيح", reasonHint: "مطلوب لسجل التدقيق غير القابل للتغيير (8 أحرف على الأقل)", saveCorrection: "إرسال التصحيح", cancel: "إلغاء",
    manual: "يدوي", biometric: "بيومتري", nfc: "NFC", import: "استيراد", saving: "جارٍ الحفظ…", error: "تعذر حفظ الحضور.", noStudents: "لا يوجد طلاب مطابقون لهذا العرض.",
    previous: "السابق", next: "التالي", page: "صفحة", original: "الأصل"
  }
} as const;

function labelForStatus(status: string, locale: Locale) {
  const t = copy[locale];
  if (status === "present") return t.present;
  if (status === "absent") return t.absent;
  if (status === "late") return t.late;
  if (status === "leave" || status === "excused") return t.leave;
  return status;
}

function sourceLabel(source: Workspace["rows"][number]["source"], locale: Locale) {
  const t = copy[locale];
  if (source === "biometric") return t.biometric;
  if (source === "nfc") return t.nfc;
  if (source === "import") return t.import;
  return t.manual;
}

export function AttendanceWorkspace({ locale, data, search }: { locale: Locale; data: Workspace; search: string }) {
  const t = copy[locale];
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<number | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<string>("present");
  const [reason, setReason] = useState("");

  function navigate(params: Record<string, string | number | undefined>) {
    const query = new URLSearchParams();
    query.set("date", String(params.date ?? data.date));
    const nextSearch = params.q !== undefined ? String(params.q) : search;
    if (nextSearch) query.set("q", nextSearch);
    const page = Number(params.page ?? data.page);
    if (page > 1) query.set("page", String(page));
    router.push(`/${locale}/attendance?${query.toString()}`);
  }

  async function startAttendance() {
    setBusyKey("start"); setError(null);
    try {
      const response = await fetch("/api/attendance/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: data.date }) });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(payload.error || t.error); return; }
      router.refresh();
    } catch { setError(t.error); } finally { setBusyKey(null); }
  }

  async function mark(personId: number, statusKey: string) {
    if (!data.sessionId) return;
    const key = `${personId}:${statusKey}`;
    setBusyKey(key); setError(null);
    try {
      const response = await fetch("/api/attendance/mark", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ attendanceSessionId: data.sessionId, personId, statusKey, source: "manual" }) });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(payload.error || t.error); return; }
      router.refresh();
    } catch { setError(t.error); } finally { setBusyKey(null); }
  }

  function beginCorrection(recordId: number, currentStatus: string | null) {
    setCorrecting(recordId);
    setCorrectionStatus(currentStatus === "present" ? "absent" : "present");
    setReason("");
    setError(null);
  }

  async function submitCorrection() {
    if (!correcting) return;
    setBusyKey(`correct:${correcting}`); setError(null);
    try {
      const response = await fetch("/api/attendance/correct", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ attendanceRecordId: correcting, statusKey: correctionStatus, reason }) });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(payload.error || t.error); return; }
      setCorrecting(null); setReason(""); router.refresh();
    } catch { setError(t.error); } finally { setBusyKey(null); }
  }

  const statusOptions = data.statuses.filter((status) => ["present", "absent", "late", "leave"].includes(status.key));
  const deviceMarks = data.summary.biometric + data.summary.nfc;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return <div className="attendance-workspace">
    <section className="attendance-toolbar panel" data-page-section>
      <label className="field-label">{t.date}<input className="text-field" type="date" value={data.date} onChange={(event) => navigate({ date: event.target.value, page: 1 })} /></label>
      <form className="attendance-search" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); navigate({ q: String(form.get("q") || "").trim(), page: 1 }); }}>
        <label className="field-label">{t.search}<input className="text-field" name="q" defaultValue={search} /></label>
        <button className="action-button" type="submit">{t.searchAction}</button>
        {search ? <button className="action-button" type="button" onClick={() => navigate({ q: "", page: 1 })}>{t.clear}</button> : null}
      </form>
    </section>

    {error ? <p className="form-message form-error attendance-global-error" role="alert">{error}</p> : null}

    {!data.started ? <section className="panel attendance-empty-state" data-page-section><div><p className="state-kicker">{data.date}</p><h2>{t.notStarted}</h2><p>{t.notStartedBody}</p><small>{data.timezone}</small></div><button className="action-button action-button-primary" type="button" disabled={busyKey === "start"} onClick={startAttendance}>{busyKey === "start" ? t.starting : t.start}</button></section> : <>
      <section className="attendance-metrics" data-page-section>
        {[ [t.total,data.summary.total], [t.present,data.summary.present], [t.absent,data.summary.absent], [t.late,data.summary.late], [t.leave,data.summary.leave], [t.unmarked,data.summary.unmarked], [t.device,deviceMarks], [t.pending,data.summary.pendingCorrections] ].map(([label,value]) => <article className="attendance-metric" key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}
      </section>

      <section className="attendance-register" data-page-section>
        {data.rows.length ? data.rows.map((row) => <article className="attendance-row" key={row.personId}>
          <div className="attendance-student"><strong>{row.name}</strong>{row.nameNative ? <span dir="auto">{row.nameNative}</span> : null}<small>{row.studentNumber} · {row.groupName || t.group}</small></div>
          <div className="attendance-current">
            <span className={`attendance-status attendance-status-${row.statusCategory || "unmarked"}`}>{row.statusKey ? labelForStatus(row.statusKey, locale) : t.notMarked}</span>
            {row.source ? <span className={`attendance-source attendance-source-${row.source}`}>{sourceLabel(row.source, locale)}</span> : null}
            {row.approvedCorrectionId ? <span className="attendance-correction-badge">{t.corrected}</span> : null}
            {row.pendingCorrectionId ? <span className="attendance-pending-badge">{t.pendingCorrection}</span> : null}
            {row.approvedCorrectionId && row.originalStatusKey ? <small>{t.original}: {labelForStatus(row.originalStatusKey, locale)}</small> : null}
          </div>
          <div className="attendance-actions">
            {!row.attendanceRecordId ? statusOptions.map((status) => <button className={`attendance-mark attendance-mark-${status.category}`} key={status.key} type="button" disabled={busyKey !== null} onClick={() => mark(row.personId, status.key)}>{busyKey === `${row.personId}:${status.key}` ? t.saving : labelForStatus(status.key, locale)}</button>) : <button className="action-button" type="button" disabled={Boolean(row.pendingCorrectionId) || busyKey !== null} onClick={() => beginCorrection(row.attendanceRecordId!, row.statusKey)}>{t.correction}</button>}
          </div>
          {correcting === row.attendanceRecordId ? <div className="attendance-correction-form">
            <label className="field-label">{t.status}<select className="text-field" value={correctionStatus} onChange={(e) => setCorrectionStatus(e.target.value)}>{statusOptions.map((status) => <option key={status.key} value={status.key}>{labelForStatus(status.key, locale)}</option>)}</select></label>
            <label className="field-label">{t.reason}<input className="text-field" value={reason} maxLength={500} placeholder={t.reasonHint} onChange={(e) => setReason(e.target.value)} /></label>
            <div className="quick-actions"><button className="action-button action-button-primary" type="button" disabled={reason.trim().length < 8 || busyKey !== null} onClick={submitCorrection}>{busyKey === `correct:${correcting}` ? t.saving : t.saveCorrection}</button><button className="action-button" type="button" onClick={() => setCorrecting(null)}>{t.cancel}</button></div>
          </div> : null}
        </article>) : <div className="panel attendance-empty-list">{t.noStudents}</div>}
      </section>

      {pages > 1 ? <nav className="attendance-pagination" aria-label={t.page}><button className="action-button" type="button" disabled={data.page <= 1} onClick={() => navigate({ page: data.page - 1 })}>{t.previous}</button><span>{t.page} {data.page} / {pages}</span><button className="action-button" type="button" disabled={data.page >= pages} onClick={() => navigate({ page: data.page + 1 })}>{t.next}</button></nav> : null}
    </>}
  </div>;
}
