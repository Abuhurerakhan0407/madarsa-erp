"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import type { AttendanceWorkspace as Workspace } from "@/lib/attendance/workspace";
import { EmergencyAttendancePanel } from "@/components/emergency-attendance-panel";

const copy = {
  en: {
    students: "Students",
    present: "Present",
    absent: "Absent",
    late: "Late",
    leave: "Leave",
    unmarked: "Unmarked",
    biometric: "Biometric",
    legacyDevice: "Legacy device",
    deviceMarks: "Device marks",
    pending: "Pending corrections",
    firstScan: "First scan",
    lastScan: "Last scan",
    source: "Source",
    noScan: "No device scan",
    emergency: "Emergency manual",
    manualHistory: "Manual history",
    correction: "Correct attendance",
    review: "Review correction",
    reason: "Reason",
    status: "Status",
    save: "Save",
    cancel: "Cancel",
    approve: "Approve",
    reject: "Reject",
    lock: "Lock attendance",
    locked: "Attendance locked",
    saving: "Saving…",
    noStudents: "No students are available in this class/group for the selected date.",
    manualWindow: "Manual marking is available only under an active emergency authorization.",
    pendingCorrection: "Pending correction",
    corrected: "Corrected",
    error: "Unable to save attendance. Please try again.",
    previous: "Previous",
    next: "Next"
  },
  ur: {
    students: "طلبہ",
    present: "حاضر",
    absent: "غائب",
    late: "تاخیر",
    leave: "رخصت",
    unmarked: "بغیر نشان",
    biometric: "بایومیٹرک",
    legacyDevice: "سابقہ ڈیوائس",
    deviceMarks: "ڈیوائس مارکس",
    pending: "زیرِ التوا اصلاحات",
    firstScan: "پہلا اسکین",
    lastScan: "آخری اسکین",
    source: "ذریعہ",
    noScan: "کوئی ڈیوائس اسکین نہیں",
    emergency: "ہنگامی دستی",
    manualHistory: "دستی سابقہ ریکارڈ",
    correction: "حاضری درست کریں",
    review: "اصلاح کا جائزہ",
    reason: "وجہ",
    status: "حالت",
    save: "محفوظ کریں",
    cancel: "منسوخ",
    approve: "منظور",
    reject: "رد",
    lock: "حاضری لاک کریں",
    locked: "حاضری لاک ہے",
    saving: "محفوظ ہو رہا ہے…",
    noStudents: "منتخب تاریخ کے لیے اس کلاس/گروپ میں کوئی طالب علم دستیاب نہیں۔",
    manualWindow: "دستی حاضری صرف فعال ہنگامی اجازت کے دوران دستیاب ہے۔",
    pendingCorrection: "زیرِ التوا اصلاح",
    corrected: "درست شدہ",
    error: "حاضری محفوظ نہیں ہو سکی۔ دوبارہ کوشش کریں۔",
    previous: "پچھلا",
    next: "اگلا"
  }
} as const;

const validStatus = ["present", "absent", "late", "leave"] as const;

function label(status: string, locale: SupportedLocale) {
  const t = copy[locale];
  if (status === "present") return t.present;
  if (status === "absent") return t.absent;
  if (status === "late") return t.late;
  if (status === "leave" || status === "excused") return t.leave;
  return status.replaceAll("_", " ");
}

function displayTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sourceLabel(row: Workspace["rows"][number], locale: SupportedLocale) {
  const t = copy[locale];
  if (!row.source) return t.noScan;
  if (row.source === "manual" && row.sourceRef?.startsWith("emergency:")) return t.emergency;
  if (row.source === "manual") return t.manualHistory;
  if (row.source === "nfc") {
    return `${t.legacyDevice}${row.deviceLabel ? ` · ${row.deviceLabel}` : ""}`;
  }
  if (row.source === "biometric") {
    return `${t.biometric}${row.deviceLabel ? ` · ${row.deviceLabel}` : ""}`;
  }
  return `${row.source.toUpperCase()}${row.deviceLabel ? ` · ${row.deviceLabel}` : ""}`;
}

export function AttendanceV2Workspace({
  locale,
  data,
  groupId
}: {
  locale: SupportedLocale;
  data: Workspace;
  groupId: number;
}) {
  const t = copy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("present");
  const [reason, setReason] = useState("");
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [reviewReason, setReviewReason] = useState("");

  async function post(url: string, body: unknown, key: string) {
    if (busy) return false;
    setBusy(key);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(locale === "ur" ? t.error : payload.error ?? t.error);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError(t.error);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function start() {
    await post("/api/attendance/start", { date: data.date }, "start");
  }

  async function mark(personId: number, statusKey: string) {
    if (!data.sessionId) return;
    await post(
      "/api/attendance/mark",
      {
        attendanceSessionId: data.sessionId,
        personId,
        statusKey,
        source: "manual"
      },
      `mark:${personId}:${statusKey}`
    );
  }

  async function correct() {
    if (!editing) return;
    const ok = await post(
      "/api/attendance/correct",
      { attendanceRecordId: editing, statusKey: editStatus, reason },
      `correct:${editing}`
    );
    if (ok) {
      setEditing(null);
      setReason("");
    }
  }

  async function review(decision: "approved" | "rejected") {
    if (!reviewing) return;
    const ok = await post(
      "/api/attendance/review",
      { correctionId: reviewing, decision, reviewReason },
      `review:${reviewing}`
    );
    if (ok) {
      setReviewing(null);
      setReviewReason("");
    }
  }

  async function lock() {
    if (data.sessionId) {
      await post("/api/attendance/lock", { attendanceSessionId: data.sessionId }, "lock");
    }
  }

  function goToPage(page: number) {
    if (busy) return;
    const query = new URLSearchParams({
      date: data.date,
      group: String(groupId)
    });
    if (page > 1) query.set("page", String(page));
    router.push(`/${locale}/attendance?${query.toString()}`);
  }

  const statusOptions = data.statuses.filter((status) =>
    validStatus.includes(status.key as (typeof validStatus)[number])
  );
  const editable = data.state === "open" || data.state === "draft";
  const deviceMarks = data.summary.biometric + data.summary.nfc;
  const groups = new Map<number, string>();
  for (const row of data.rows) {
    if (row.groupId && !groups.has(row.groupId)) {
      groups.set(row.groupId, row.groupName ?? `Group ${row.groupId}`);
    }
  }
  const targets = [
    ...Array.from(groups, ([id, groupLabel]) => ({ id, label: groupLabel, kind: "group" as const })),
    ...data.rows.map((row) => ({
      id: row.personId,
      label: `${row.name} · ${row.studentNumber}`,
      kind: "student" as const
    }))
  ];
  const pages = Math.max(1, Math.ceil(data.total / Math.max(data.pageSize, 1)));

  return (
    <div className="attendance-workspace flow-stack">
      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}

      <section className="attendance-summary-strip" data-page-section>
        {[
          [t.students, data.summary.total],
          [t.present, data.summary.present],
          [t.absent, data.summary.absent],
          [t.late, data.summary.late],
          [t.leave, data.summary.leave],
          [t.unmarked, data.summary.unmarked]
        ].map(([key, value]) => (
          <article className="attendance-summary-item" key={String(key)}>
            <span>{key}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="attendance-session-bar panel" data-page-section>
        <div>
          <strong>{data.state === "locked" ? t.locked : data.date}</strong>
          <span>
            {t.deviceMarks}: {deviceMarks} · {t.pending}: {data.summary.pendingCorrections}
          </span>
        </div>
        {data.capabilities.canApprove && data.state !== "locked" && data.started ? (
          <button
            className="action-button action-button-primary"
            disabled={busy !== null || data.summary.unmarked > 0 || data.summary.pendingCorrections > 0}
            onClick={() => void lock()}
          >
            {busy === "lock" ? t.saving : t.lock}
          </button>
        ) : null}
      </section>

      <EmergencyAttendancePanel
        subjectType="student"
        date={data.date}
        canManage={data.emergency.canManage}
        targets={targets}
        authorizations={data.emergency.authorizations}
        locale={locale}
      />

      {!data.started ? (
        <section className="panel attendance-empty-state" data-page-section>
          <div>
            <h2>{locale === "ur" ? "حاضری ابھی شروع نہیں ہوئی" : "Attendance has not started"}</h2>
            <p>
              {locale === "ur"
                ? "اس تاریخ کی فہرست محفوظ کرنے کے لیے حاضری شروع کریں۔ عام حاضری بایومیٹرک/ڈیوائس فرسٹ رہے گی۔"
                : "Start attendance to snapshot this date's active roster. Normal attendance remains biometric/device-first."}
            </p>
          </div>
          {data.capabilities.canMark ? (
            <button
              className="action-button action-button-primary"
              disabled={busy !== null}
              onClick={() => void start()}
            >
              {busy === "start"
                ? locale === "ur" ? "شروع ہو رہی ہے…" : "Starting…"
                : locale === "ur" ? "حاضری شروع کریں" : "Start attendance"}
            </button>
          ) : null}
        </section>
      ) : (
        <>
          <section className="attendance-register" data-page-section>
            {data.rows.length ? (
              data.rows.map((row) => (
                <article className="attendance-row" key={row.personId}>
                  <div className="attendance-student">
                    <strong>{row.name}</strong>
                    {row.nameNative ? <span dir="auto">{row.nameNative}</span> : null}
                    <small>{row.studentNumber} · {row.groupName ?? "—"}</small>
                  </div>

                  <div className="attendance-current">
                    <span className={`attendance-status attendance-status-${row.statusCategory ?? "unmarked"}`}>
                      {row.statusKey ? label(row.statusKey, locale) : t.unmarked}
                    </span>
                    {row.source ? (
                      <span className={`attendance-source attendance-source-${row.source}`}>
                        {sourceLabel(row, locale)}
                      </span>
                    ) : null}
                    {row.pendingCorrectionId ? (
                      <span className="attendance-pending-badge">{t.pendingCorrection}</span>
                    ) : null}
                    {row.approvedCorrectionId ? (
                      <span className="attendance-correction-badge">{t.corrected}</span>
                    ) : null}
                    <small>{t.firstScan}: {displayTime(row.firstScan)} · {t.lastScan}: {displayTime(row.lastScan)}</small>
                  </div>

                  <div className="attendance-actions">
                    {!row.attendanceRecordId &&
                    editable &&
                    data.capabilities.canMark &&
                    row.emergencyManualAuthorized ? (
                      <div>
                        <small>{t.manualWindow}</small>
                        <div className="quick-actions">
                          {statusOptions.map((status) => (
                            <button
                              className={`attendance-mark attendance-mark-${status.category}`}
                              type="button"
                              key={status.key}
                              disabled={busy !== null}
                              onClick={() => void mark(row.personId, status.key)}
                            >
                              {busy === `mark:${row.personId}:${status.key}`
                                ? t.saving
                                : label(status.key, locale)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {row.attendanceRecordId &&
                    data.capabilities.canCorrect &&
                    !row.pendingCorrectionId ? (
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={busy !== null}
                        onClick={() => {
                          setEditing(row.attendanceRecordId);
                          setEditStatus(row.statusKey === "present" ? "absent" : "present");
                          setReason("");
                        }}
                      >
                        {t.correction}
                      </button>
                    ) : null}

                    {row.pendingCorrectionId && data.capabilities.canApprove ? (
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={busy !== null}
                        onClick={() => {
                          setReviewing(row.pendingCorrectionId);
                          setReviewReason("");
                        }}
                      >
                        {t.review}
                      </button>
                    ) : null}
                  </div>

                  {editing === row.attendanceRecordId ? (
                    <div className="attendance-correction-form">
                      <label className="field-label">
                        {t.status}
                        <select
                          className="text-field"
                          value={editStatus}
                          onChange={(event) => setEditStatus(event.target.value)}
                        >
                          {statusOptions.map((status) => (
                            <option key={status.key} value={status.key}>
                              {label(status.key, locale)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-label">
                        {t.reason}
                        <input
                          className="text-field"
                          value={reason}
                          minLength={8}
                          maxLength={500}
                          onChange={(event) => setReason(event.target.value)}
                        />
                      </label>
                      <div className="quick-actions">
                        <button
                          className="action-button action-button-primary"
                          disabled={reason.trim().length < 8 || busy !== null}
                          onClick={() => void correct()}
                        >
                          {busy === `correct:${editing}` ? t.saving : t.save}
                        </button>
                        <button className="secondary-button" type="button" onClick={() => setEditing(null)}>
                          {t.cancel}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {reviewing === row.pendingCorrectionId ? (
                    <div className="attendance-correction-form">
                      <label className="field-label">
                        {t.reason}
                        <input
                          className="text-field"
                          value={reviewReason}
                          minLength={8}
                          maxLength={500}
                          onChange={(event) => setReviewReason(event.target.value)}
                        />
                      </label>
                      <div className="quick-actions">
                        <button
                          className="action-button action-button-primary"
                          disabled={reviewReason.trim().length < 8 || busy !== null}
                          onClick={() => void review("approved")}
                        >
                          {t.approve}
                        </button>
                        <button
                          className="secondary-button"
                          disabled={reviewReason.trim().length < 8 || busy !== null}
                          onClick={() => void review("rejected")}
                        >
                          {t.reject}
                        </button>
                        <button className="secondary-button" type="button" onClick={() => setReviewing(null)}>
                          {t.cancel}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="panel attendance-empty-list">{t.noStudents}</p>
            )}
          </section>

          {pages > 1 ? (
            <nav className="attendance-pagination" aria-label={locale === "ur" ? "صفحات" : "Pages"}>
              <button
                type="button"
                className="secondary-button"
                disabled={data.page <= 1 || busy !== null}
                onClick={() => goToPage(data.page - 1)}
              >
                {t.previous}
              </button>
              <span>{data.page} / {pages}</span>
              <button
                type="button"
                className="secondary-button"
                disabled={data.page >= pages || busy !== null}
                onClick={() => goToPage(data.page + 1)}
              >
                {t.next}
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
