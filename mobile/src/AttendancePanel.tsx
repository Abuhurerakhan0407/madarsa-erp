import { useEffect, useMemo, useState } from 'react';
import type { MobileWorkspace } from './lib/mobile-api';
import { getMobileAttendance, type MobileAttendanceResponse } from './lib/attendance-api';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function titleCase(value?: string) {
  if (!value) return 'Not marked';
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AttendancePanel({ workspace, online }: { workspace: MobileWorkspace; online: boolean }) {
  const [date, setDate] = useState(todayIso());
  const [data, setData] = useState<MobileAttendanceResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!online) {
        setError('Reconnect to load attendance.');
        return;
      }
      if (workspace.surface === 'parent') {
        setError('Parent attendance history is the next mobile data view.');
        return;
      }

      setBusy(true);
      setError(null);
      try {
        const next = await getMobileAttendance(workspace, date);
        if (!cancelled) setData(next);
      } catch (caught) {
        if (!cancelled) {
          setData(null);
          setError(caught instanceof Error ? caught.message : 'Attendance is unavailable.');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [date, online, workspace]);

  const rows = data?.attendance.rows ?? [];
  const stats = useMemo(() => {
    const counts = { total: rows.length, present: 0, absent: 0, late: 0 };
    for (const row of rows) {
      const status = row.status?.toLowerCase();
      if (status === 'present') counts.present += 1;
      else if (status === 'absent') counts.absent += 1;
      else if (status === 'late') counts.late += 1;
    }
    return counts;
  }, [rows]);

  return (
    <section className="attendance-panel" aria-label="Attendance">
      <div className="attendance-toolbar">
        <div>
          <span className="section-kicker">Read-only preview</span>
          <strong>Daily attendance</strong>
        </div>
        <input
          className="date-control"
          type="date"
          value={date}
          max={todayIso()}
          onChange={(event) => setDate(event.target.value)}
          aria-label="Attendance date"
        />
      </div>

      <div className="attendance-stats" aria-label="Attendance summary">
        <div><span>Total</span><strong>{stats.total}</strong></div>
        <div><span>Present</span><strong>{stats.present}</strong></div>
        <div><span>Absent</span><strong>{stats.absent}</strong></div>
        <div><span>Late</span><strong>{stats.late}</strong></div>
      </div>

      {busy ? (
        <div className="data-state"><span className="data-spinner" />Loading attendance securely…</div>
      ) : error ? (
        <div className="data-state data-state-error">
          <strong>Attendance connection</strong>
          <span>{error}</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="data-state">
          <strong>No attendance rows</strong>
          <span>Nothing is recorded for this date and workspace.</span>
        </div>
      ) : (
        <div className="student-list">
          {rows.map((row, index) => (
            <article className="student-row" key={row.enrollmentId ?? row.studentId ?? `${row.studentName}-${index}`}>
              <div className="student-avatar" aria-hidden="true">{row.studentName?.trim().charAt(0).toUpperCase() || 'S'}</div>
              <div className="student-copy">
                <strong>{row.studentName || 'Student'}</strong>
                <span>{row.rollNo ? `Roll ${row.rollNo}` : row.group?.label || row.group?.name || 'Student'}</span>
              </div>
              <span className={`attendance-status status-${row.status?.toLowerCase() || 'unknown'}`}>
                {titleCase(row.status)}
              </span>
            </article>
          ))}
        </div>
      )}

      <p className="read-only-note">Viewing only. Marking attendance stays disabled until the native write flow passes authorization and device QA.</p>
    </section>
  );
}
