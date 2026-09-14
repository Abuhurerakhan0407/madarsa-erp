"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale, SupportedLocale } from "@/lib/i18n/config";
import { EmergencyAttendancePanel } from "@/components/emergency-attendance-panel";

type Row = { employmentId: number; personId: number; employeeNumber: string; displayName: string; nameNative: string | null; departmentKey: string | null; designationKey: string; attendanceRecordId: number | null; status: string; checkInAt: string | null; checkOutAt: string | null; source: string | null; correctionReason: string | null; firstScan: string | null; lastScan: string | null; deviceLabel: string | null; modality: string | null; emergencyManualAuthorized: boolean };
type Authorization = { id: number; scopeType: string; reason: string; startsAt: string; expiresAt: string; active: boolean; scopeLabel: string };
type Data = { date: string; summary: { total: number; marked: number; present: number; absent: number; late: number; leave: number; unmarked: number }; canManage: boolean; emergency: { canManage: boolean; authorizations: Authorization[] }; insights: { dailyPercent: number; weeklyPercent: number; monthlyPercent: number; trend: Array<{ date: string; recorded: number; attendancePercent: number }> }; rows: Row[] };

const copy = {
  en: { teachers: "Teachers", present: "Present", absent: "Absent", late: "Late", leave: "Leave", unmarked: "Unmarked", daily: "Today", weekly: "7 days", monthly: "30 days", trend: "Attendance trend", first: "First scan", last: "Last scan", source: "Source", biometric: "Biometric", legacyDevice: "Legacy device", imported: "Imported", device: "Device", emergency: "Emergency manual", manualHint: "Manual controls are visible only while an active emergency authorization matches this teacher.", saving: "Saving…", none: "No teachers/staff match this view.", recorded: "recorded", error: "Unable to save attendance. Please try again.", teacher: "Teacher", seniorTeacher: "Senior teacher", headTeacher: "Head teacher" },
  ur: { teachers: "اساتذہ", present: "حاضر", absent: "غیر حاضر", late: "تاخیر", leave: "رخصت", unmarked: "درج نہیں", daily: "آج", weekly: "7 دن", monthly: "30 دن", trend: "حاضری رجحان", first: "پہلا اسکین", last: "آخری اسکین", source: "ذریعہ", biometric: "بایومیٹرک", legacyDevice: "پرانا ڈیوائس", imported: "درآمد شدہ", device: "ڈیوائس", emergency: "ہنگامی دستی", manualHint: "دستی کنٹرول صرف اس وقت دکھائے جاتے ہیں جب اس استاد کے لیے فعال ہنگامی اجازت موجود ہو۔", saving: "محفوظ ہو رہا ہے…", none: "کوئی استاد یا عملہ اس منظر سے مطابقت نہیں رکھتا۔", recorded: "ریکارڈ شدہ", error: "حاضری محفوظ نہیں ہو سکی۔ دوبارہ کوشش کریں۔", teacher: "استاد", seniorTeacher: "سینئر استاد", headTeacher: "صدر مدرس" },
  ar: { teachers: "المعلمون", present: "حاضر", absent: "غائب", late: "متأخر", leave: "إجازة", unmarked: "غير مسجل", daily: "اليوم", weekly: "7 أيام", monthly: "30 يوماً", trend: "اتجاه الحضور", first: "أول مسح", last: "آخر مسح", source: "المصدر", biometric: "بيومتري", legacyDevice: "جهاز قديم", imported: "مستورد", device: "جهاز", emergency: "يدوي طارئ", manualHint: "تظهر أدوات التسجيل اليدوي فقط أثناء تفويض طارئ نشط يطابق هذا المعلم.", saving: "جارٍ الحفظ…", none: "لا يوجد معلمون أو موظفون مطابقون.", recorded: "مسجل", error: "تعذر حفظ الحضور. حاول مرة أخرى.", teacher: "معلم", seniorTeacher: "معلم أول", headTeacher: "رئيس المعلمين" }
} as const;

function time(value: string | null, locale: Locale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(locale === "ur" ? "ur-PK" : locale === "ar" ? "ar-SA" : "en-IN", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status: string, locale: Locale) {
  const t = copy[locale];
  if (status === "present") return t.present;
  if (status === "absent") return t.absent;
  if (status === "late") return t.late;
  if (status === "leave" || status === "excused") return t.leave;
  if (status === "unmarked") return t.unmarked;
  return status.replaceAll("_", " ");
}

function designationLabel(key: string, locale: Locale) {
  const t = copy[locale];
  if (key === "teacher") return t.teacher;
  if (key === "senior_teacher") return t.seniorTeacher;
  if (key === "head_teacher") return t.headTeacher;
  return key.replaceAll("_", " ");
}

function sourceLabel(row: Row, locale: Locale) {
  const t = copy[locale];
  if (!row.source) return "—";
  if (row.source === "manual") return t.emergency;
  if (row.source === "biometric") return `${t.biometric}${row.deviceLabel ? ` · ${row.deviceLabel}` : ""}`;
  if (row.source === "nfc") return `${t.legacyDevice}${row.deviceLabel ? ` · ${row.deviceLabel}` : ""}`;
  if (row.source === "import") return t.imported;
  return `${t.device}${row.deviceLabel ? ` · ${row.deviceLabel}` : ""}`;
}

export function HrAttendanceV2Workspace({ locale, data }: { locale: Locale; data: Data }) {
  const t = copy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mark(row: Row, status: string) {
    setBusy(`${row.employmentId}:${status}`);
    setError(null);
    try {
      const response = await fetch("/api/hr/attendance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employmentId: row.employmentId,
          attendanceDate: data.date,
          status,
          checkInAt: null,
          checkOutAt: null,
          source: "manual",
          reason: row.attendanceRecordId ? "Emergency manual attendance adjustment under active authorization." : null,
          requestKey: crypto.randomUUID()
        })
      });
      if (!response.ok) {
        setError(t.error);
        return;
      }
      router.refresh();
    } catch {
      setError(t.error);
    } finally {
      setBusy(null);
    }
  }

  const targets = data.rows.map((row) => ({ id: row.employmentId, label: `${row.displayName} · ${row.employeeNumber}`, kind: "teacher" as const }));
  const supportedLocale: SupportedLocale = locale === "ur" ? "ur" : "en";

  return <div className="flow-stack" aria-busy={busy !== null || undefined}>
    {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
    <section className="attendance-metrics" data-page-section>{[[t.teachers, data.summary.total], [t.present, data.summary.present], [t.absent, data.summary.absent], [t.late, data.summary.late], [t.leave, data.summary.leave], [t.unmarked, data.summary.unmarked], [`${t.daily} %`, data.insights.dailyPercent], [`${t.weekly} %`, data.insights.weeklyPercent], [`${t.monthly} %`, data.insights.monthlyPercent]].map(([key, value]) => <article className="attendance-metric" key={String(key)}><span>{key}</span><strong>{value}</strong></article>)}</section>

    {data.insights.trend.length ? <section className="professional-card" data-page-section><div className="section-heading"><div><p className="state-kicker">{t.monthly}</p><h2>{t.trend}</h2></div></div><div className="demo-card-grid">{data.insights.trend.slice(-7).map((point) => <article className="demo-card" key={point.date}><small>{point.date}</small><strong style={{ display: "block", fontSize: "1.5rem" }}>{point.attendancePercent}%</strong><span>{point.recorded} {t.recorded}</span></article>)}</div></section> : null}

    <EmergencyAttendancePanel subjectType="staff" date={data.date} canManage={data.emergency.canManage} targets={targets} authorizations={data.emergency.authorizations} locale={supportedLocale} />

    <section className="hr-attendance-list" data-page-section>{data.rows.length ? data.rows.map((row) => <article className="panel hr-attendance-row" key={row.employmentId}>
      <div className="hr-person"><strong>{row.displayName}</strong><small>{row.employeeNumber} · {designationLabel(row.designationKey, locale)}</small>{row.nameNative ? <span dir="auto">{row.nameNative}</span> : null}</div>
      <div><span className={`attendance-status attendance-status-${row.status}`}>{statusLabel(row.status, locale)}</span><small style={{ display: "block", marginTop: 6 }}>{t.first}: {time(row.firstScan, locale)} · {t.last}: {time(row.lastScan, locale)}</small><small style={{ display: "block" }}>{t.source}: {sourceLabel(row, locale)}</small></div>
      {row.emergencyManualAuthorized && data.canManage ? <div><small>{t.manualHint}</small><div className="quick-actions">{["present", "absent", "late", "leave"].map((status) => {
        const key = `${row.employmentId}:${status}`;
        return <button className="secondary-button" type="button" key={status} disabled={busy !== null} aria-busy={busy === key || undefined} onClick={() => void mark(row, status)}>{busy === key ? <><span className="inline-spinner" aria-hidden="true" />{t.saving}</> : statusLabel(status, locale)}</button>;
      })}</div></div> : null}
    </article>) : <p className="panel">{t.none}</p>}</section>
  </div>;
}
