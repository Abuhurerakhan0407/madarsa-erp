import { useEffect, useState } from 'react';
import type { MobileWorkspace } from './lib/mobile-api';
import { getMobilePortalHome, getParentPortalAttendance, type ParentPortalAttendance, type TeacherPortalHome } from './lib/portal-api';

function shortDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date);
}

function ParentAttendance({ data }: { data: ParentPortalAttendance }) {
  return (
    <div className="portal-attendance-children">
      {data.children.map((child) => (
        <article className="attendance-panel portal-attendance-card" key={child.personId}>
          <div className="attendance-toolbar">
            <div><span className="section-kicker">Linked child</span><strong>{child.name}</strong></div>
            <span className="read-only-pill">{child.studentNumber || 'Student'}</span>
          </div>
          <div className="attendance-stats">
            <div><span>Today</span><strong>{Math.round(child.dailyPercent)}%</strong></div>
            <div><span>7 days</span><strong>{Math.round(child.weeklyPercent)}%</strong></div>
            <div><span>30 days</span><strong>{Math.round(child.monthlyPercent)}%</strong></div>
            <div><span>Records</span><strong>{child.recent.length}</strong></div>
          </div>
          {child.trend.length ? (
            <div className="attendance-trend" aria-label="30 day attendance trend">
              {child.trend.slice(-14).map((point, index) => (
                <div className="trend-column" key={`${point.date}-${index}`} title={`${shortDate(point.date)} · ${Math.round(point.percent)}%`}>
                  <span style={{ height: `${Math.max(5, Math.min(100, point.percent))}%` }} />
                </div>
              ))}
            </div>
          ) : null}
          <div className="student-list">
            {child.recent.slice(0, 7).map((record, index) => (
              <div className="student-row portal-attendance-row" key={`${record.date}-${index}`}>
                <div className="student-avatar" aria-hidden="true">{shortDate(record.date).slice(0, 2)}</div>
                <div className="student-copy"><strong>{shortDate(record.date)}</strong><span>{record.source ? `Source: ${record.source}` : 'Attendance record'}</span></div>
                <span className={`attendance-status status-${record.status ?? 'unmarked'}`}>{record.status || 'Unmarked'}</span>
              </div>
            ))}
          </div>
          <p className="read-only-note">Visible only for children linked to this verified guardian account.</p>
        </article>
      ))}
    </div>
  );
}

function TeacherAttendance({ data }: { data: TeacherPortalHome }) {
  return (
    <article className="attendance-panel portal-attendance-card">
      <div className="attendance-toolbar">
        <div><span className="section-kicker">Teacher portal</span><strong>My attendance</strong></div>
        <span className="read-only-pill">Self only</span>
      </div>
      {data.employee.recentAttendance.length ? (
        <div className="student-list">
          {data.employee.recentAttendance.map((record, index) => (
            <div className="student-row portal-attendance-row" key={`${record.date}-${index}`}>
              <div className="student-avatar" aria-hidden="true">{shortDate(record.date).slice(0, 2)}</div>
              <div className="student-copy"><strong>{shortDate(record.date)}</strong><span>{record.checkInAt ? `Check-in recorded` : 'No check-in time'}</span></div>
              <span className={`attendance-status status-${record.status ?? 'unmarked'}`}>{record.status || 'Unmarked'}</span>
            </div>
          ))}
        </div>
      ) : <div className="data-state"><strong>No attendance yet</strong><span>No recent staff attendance records were returned.</span></div>}
      <p className="read-only-note">This portal view only exposes the signed-in teacher’s own HR attendance.</p>
    </article>
  );
}

export default function PortalAttendancePanel({ workspace, online }: { workspace: MobileWorkspace; online: boolean }) {
  const [parentData, setParentData] = useState<ParentPortalAttendance | null>(null);
  const [teacherData, setTeacherData] = useState<TeacherPortalHome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!online) {
        setError('Reconnect to refresh attendance.');
        setParentData(null);
        setTeacherData(null);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        if (workspace.surface === 'parent') {
          const next = await getParentPortalAttendance(workspace);
          if (!cancelled) { setParentData(next); setTeacherData(null); }
        } else if (workspace.surface === 'teacher') {
          const next = await getMobilePortalHome(workspace);
          if (!cancelled && next.surface === 'teacher') { setTeacherData(next); setParentData(null); }
        }
      } catch (caught) {
        if (!cancelled) {
          setParentData(null);
          setTeacherData(null);
          setError(caught instanceof Error ? caught.message : 'Attendance is unavailable.');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [online, workspace]);

  return (
    <section className="portal-attendance" aria-label="Portal attendance">
      {busy ? <div className="data-state"><span className="data-spinner" />Loading private attendance…</div> : null}
      {!busy && error ? <div className="data-state data-state-error"><strong>Attendance</strong><span>{error}</span></div> : null}
      {!busy && parentData ? <ParentAttendance data={parentData} /> : null}
      {!busy && teacherData ? <TeacherAttendance data={teacherData} /> : null}
    </section>
  );
}
