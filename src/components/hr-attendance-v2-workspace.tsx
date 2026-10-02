"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import { EmergencyAttendancePanel } from "@/components/emergency-attendance-panel";

type Row = {
  employmentId: number;
  personId: number;
  employeeNumber: string;
  displayName: string;
  nameNative: string | null;
  departmentKey: string | null;
  designationKey: string;
  attendanceRecordId: number | null;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  source: string | null;
  correctionReason: string | null;
  firstScan: string | null;
  lastScan: string | null;
  deviceLabel: string | null;
  modality: string | null;
  emergencyManualAuthorized: boolean;
};

type Authorization = {
  id: number;
  scopeType: string;
  reason: string;
  startsAt: string;
  expiresAt: string;
  active: boolean;
  scopeLabel: string;
};

type Data = {
  date: string;
  summary: {
    total: number;
    marked: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
    unmarked: number;
  };
  canManage: boolean;
  emergency: {
    canManage: boolean;
    authorizations: Authorization[];
  };
  insights: {
    dailyPercent: number;
    weeklyPercent: number;
    monthlyPercent: number;
    trend: Array<{ date: string; recorded: number; attendancePercent: number }>;
  };
  rows: Row[];
};

const copy = {
  en: {
    teachers: "Teachers / Staff",
    present: "Present",
    absent: "Absent",
    late: "Late",
    leave: "Leave",
    unmarked: "Unmarked",
    first: "First scan",
    last: "Last scan",
    biometric: "Biometric",
    legacyDevice: "Legacy device",
    imported: "Imported",
    device: "Device",
    emergency: "Emergency manual",
    manualHint: "Manual controls appear only during an active emergency authorization.",
    saving: "Saving…",
    none: "No teachers or staff are available for this date.",
    error: "Unable to save attendance. Please try again."
  },
  ur: {
    teachers: "اساتذہ / عملہ",
    present: "حاضر",
    absent: "غیر حاضر",
    late: "تاخیر",
    leave: "رخصت",
    unmarked: "درج نہیں",
    first: "پہلا اسکین",
    last: "آخری اسکین",
    biometric: "بایومیٹرک",
    legacyDevice: "پرانا ڈیوائس",
    imported: "درآمد شدہ",
    device: "ڈیوائس",
    emergency: "ہنگامی دستی",
    manualHint: "دستی کنٹرول صرف فعال ہنگامی اجازت کے دوران ظاہر ہوتے ہیں۔",
    saving: "محفوظ ہو رہا ہے…",
    none: "اس تاریخ کے لیے کوئی استاد یا عملہ دستیاب نہیں۔",
    error: "حاضری محفوظ نہیں ہو سکی۔ دوبارہ کوشش کریں۔"
  }
} as const;

const designationCopy = {
  en: {
    teacher: "Teacher",
    senior_teacher: "Senior teacher",
    head_teacher: "Head teacher",
    assistant_teacher: "Assistant teacher",
    attendance_supervisor: "Attendance supervisor",
    dars_e_nizami_teacher: "Dars-e-Nizami teacher",
    admissions_coordinator: "Admissions coordinator",
    hifz_instructor: "Hifz instructor",
    exam_evaluator: "Exam evaluator"
  },
  ur: {
    teacher: "استاد",
    senior_teacher: "سینئر استاد",
    head_teacher: "صدر مدرس",
    assistant_teacher: "معاون استاد",
    attendance_supervisor: "حاضری نگران",
    dars_e_nizami_teacher: "درسِ نظامی استاد",
    admissions_coordinator: "داخلہ رابطہ کار",
    hifz_instructor: "حفظ استاد",
    exam_evaluator: "امتحانی ممتحن"
  }
} as const;

function time(value: string | null, locale: SupportedLocale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(locale === "ur" ? "ur-PK" : "en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusLabel(status: string, locale: SupportedLocale) {
  const t = copy[locale];
  if (status === "present") return t.present;
  if (status === "absent") return t.absent;
  if (status === "late") return t.late;
  if (status === "leave" || status === "excused") return t.leave;
  if (status === "unmarked") return t.unmarked;
  return status.replaceAll("_", " ");
}

function designationLabel(key: string, locale: SupportedLocale) {
  const language = locale === "ur" ? "ur" : "en";
  return designationCopy[language][key as keyof typeof designationCopy.en] ?? key.replaceAll("_", " ");
}

function sourceLabel(row: Row, locale: SupportedLocale) {
  const t = copy[locale];
  if (!row.source) return "—";
  if (row.source === "manual") return t.emergency;
  if (row.source === "biometric") {
    return `${t.biometric}${row.deviceLabel ? ` · ${row.deviceLabel}` : ""}`;
  }
  if (row.source === "nfc") {
    return `${t.legacyDevice}${row.deviceLabel ? ` · ${row.deviceLabel}` : ""}`;
  }
  if (row.source === "import") return t.imported;
  return `${t.device}${row.deviceLabel ? ` · ${row.deviceLabel}` : ""}`;
}

export function HrAttendanceV2Workspace({
  locale,
  data
}: {
  locale: SupportedLocale;
  data: Data;
}) {
  const t = copy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const targets = data.rows.map((row) => ({
    id: row.employmentId,
    label: `${row.displayName} · ${row.employeeNumber}`,
    kind: "teacher" as const
  }));

  async function mark(row: Row, status: string) {
    if (busy) return;
    const key = `${row.employmentId}:${status}`;
    setBusy(key);
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
          reason: row.attendanceRecordId
            ? "Emergency manual attendance adjustment under active authorization."
            : null,
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

  return (
    <div className="flow-stack teacher-attendance-workspace" aria-busy={busy !== null || undefined}>
      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}

      <section className="attendance-summary-strip teacher-attendance-summary" data-page-section>
        {[
          [t.teachers, data.summary.total],
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

      <EmergencyAttendancePanel
        subjectType="staff"
        date={data.date}
        canManage={data.emergency.canManage}
        targets={targets}
        authorizations={data.emergency.authorizations}
        locale={locale}
      />

      <section className="hr-attendance-list" data-page-section>
        {data.rows.length ? (
          data.rows.map((row) => (
            <article className="panel hr-attendance-row teacher-attendance-card" key={row.employmentId}>
              <div className="hr-person">
                <strong>{row.displayName}</strong>
                <small>
                  {row.employeeNumber} · {designationLabel(row.designationKey, locale)}
                </small>
                {row.nameNative ? <span dir="auto">{row.nameNative}</span> : null}
              </div>

              <div className="teacher-attendance-state">
                <span className={`attendance-status attendance-status-${row.status}`}>
                  {statusLabel(row.status, locale)}
                </span>
                <small>{t.first}: {time(row.firstScan, locale)}</small>
                <small>{t.last}: {time(row.lastScan, locale)}</small>
                <small>{sourceLabel(row, locale)}</small>
              </div>

              {row.emergencyManualAuthorized && data.canManage ? (
                <div className="teacher-attendance-manual">
                  <small>{t.manualHint}</small>
                  <div className="quick-actions">
                    {["present", "absent", "late", "leave"].map((status) => {
                      const key = `${row.employmentId}:${status}`;
                      return (
                        <button
                          className="secondary-button"
                          type="button"
                          key={status}
                          disabled={busy !== null}
                          aria-busy={busy === key || undefined}
                          onClick={() => void mark(row, status)}
                        >
                          {busy === key ? (
                            <>
                              <span className="inline-spinner" aria-hidden="true" />
                              {t.saving}
                            </>
                          ) : (
                            statusLabel(status, locale)
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="panel attendance-empty-list">{t.none}</p>
        )}
      </section>
    </div>
  );
}
