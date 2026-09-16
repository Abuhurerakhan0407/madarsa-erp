import { useEffect, useMemo, useState } from 'react';
import type { MobileWorkspace } from './lib/mobile-api';
import { getMobilePortalHome, type MobilePortalHome, type ParentPortalHome, type TeacherPortalHome } from './lib/portal-api';

function attendanceRate(present: number, total: number) {
  return total > 0 ? Math.round((present / total) * 100) : null;
}

function shortDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date);
}

function time(value: string | null) {
  if (!value) return '—';
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function TeacherHome({ data }: { data: TeacherPortalHome }) {
  const presentCount = useMemo(
    () => data.employee.recentAttendance.filter((record) => record.status === 'present').length,
    [data],
  );
  return (
    <>
      <div className="portal-profile-card">
        <div className="portal-avatar" aria-hidden="true">{data.employee.name.charAt(0).toUpperCase()}</div>
        <div>
          <span className="section-kicker">Teacher portal</span>
          <strong>{data.employee.name}</strong>
          <small>{data.employee.designation || 'Teacher'}{data.employee.employeeNumber ? ` · ${data.employee.employeeNumber}` : ''}</small>
        </div>
        <span className="read-only-pill">Read only</span>
      </div>

      <div className="home-metric-grid portal-metrics">
        <article className="home-metric hero-metric"><span>Recent attendance</span><strong>{presentCount}/{data.employee.recentAttendance.length || 0}</strong><small>Present records shown</small></article>
        <article className="home-metric"><span>Leave records</span><strong>{data.employee.recentLeave.length}</strong><small>Recent requests</small></article>
        <article className="home-metric"><span>Notices</span><strong>{data.notices.length}</strong><small>{data.notices.filter((notice) => !notice.isRead).length} unread</small></article>
      </div>

      <div className="portal-section">
        <div className="portal-section-title"><span className="section-kicker">Recent</span><strong>My attendance</strong></div>
        {data.employee.recentAttendance.length ? (
          <div className="portal-list">
            {data.employee.recentAttendance.slice(0, 7).map((record, index) => (
              <div className="portal-row" key={`${record.date}-${index}`}>
                <div><strong>{shortDate(record.date)}</strong><span>{record.checkInAt ? `Check-in ${time(record.checkInAt)}` : 'No check-in time'}</span></div>
                <span className={`portal-status state-${record.status ?? 'unknown'}`}>{record.status || 'Unmarked'}</span>
              </div>
            ))}
          </div>
        ) : <div className="portal-empty">No recent attendance records.</div>}
      </div>

      <NoticeList notices={data.notices} />
    </>
  );
}

function ParentHome({ data }: { data: ParentPortalHome }) {
  return (
    <>
      <div className="portal-child-grid">
        {data.children.map((child) => {
          const rate = attendanceRate(child.attendancePresent30d, child.attendanceTotal30d);
          return (
            <article className="portal-child-card" key={child.personId}>
              <div className="portal-avatar" aria-hidden="true">{child.name.charAt(0).toUpperCase()}</div>
              <div className="portal-child-copy"><span className="section-kicker">My child</span><strong>{child.name}</strong>{child.nativeName ? <small>{child.nativeName}</small> : null}<span>{child.studentNumber || 'Student'}</span></div>
              <div className="portal-rate"><strong>{rate == null ? '—' : `${rate}%`}</strong><span>30-day attendance</span></div>
            </article>
          );
        })}
      </div>

      {data.overview.urgentNotices.length ? (
        <div className="portal-urgent">
          <span className="section-kicker">Needs attention</span>
          <strong>{data.overview.urgentNotices[0].title || 'Important institution update'}</strong>
          <p>{data.overview.urgentNotices[0].body}</p>
        </div>
      ) : null}

      <div className="portal-section">
        <div className="portal-section-title"><span className="section-kicker">Today</span><strong>Schedule</strong></div>
        {data.overview.todaySchedule.length ? (
          <div className="portal-list">
            {data.overview.todaySchedule.slice(0, 6).map((entry, index) => (
              <div className="portal-row" key={`${entry.studentPersonId}-${entry.startsAt}-${index}`}>
                <div><strong>{entry.subjectName || 'Class'}</strong><span>{entry.studentName || 'Student'}{entry.teacherName ? ` · ${entry.teacherName}` : ''}</span></div>
                <span className="portal-time">{time(entry.startsAt)}</span>
              </div>
            ))}
          </div>
        ) : <div className="portal-empty">No classes scheduled for today.</div>}
      </div>

      <div className="portal-two-column">
        <div className="portal-section">
          <div className="portal-section-title"><span className="section-kicker">Learning</span><strong>Homework</strong></div>
          {data.overview.homework.length ? data.overview.homework.slice(0, 4).map((item, index) => (
            <div className="portal-mini-card" key={`${item.id}-${index}`}><strong>{item.title || 'Homework'}</strong><span>{item.studentName || 'Student'} · due {shortDate(item.dueAt)}</span></div>
          )) : <div className="portal-empty">No current homework.</div>}
        </div>
        <div className="portal-section">
          <div className="portal-section-title"><span className="section-kicker">Published</span><strong>Results</strong></div>
          {data.overview.results.length ? data.overview.results.slice(0, 4).map((item, index) => (
            <div className="portal-mini-card" key={`${item.snapshotId}-${index}`}><strong>{item.exam || 'Result'}</strong><span>{item.studentName || 'Student'} · {item.percentage == null ? item.grade || 'Published' : `${Math.round(item.percentage)}%`}</span></div>
          )) : <div className="portal-empty">No published results yet.</div>}
        </div>
      </div>

      <NoticeList notices={data.notices} />
    </>
  );
}

function NoticeList({ notices }: { notices: TeacherPortalHome['notices'] }) {
  return (
    <div className="portal-section">
      <div className="portal-section-title"><span className="section-kicker">Institution</span><strong>Notices</strong></div>
      {notices.length ? (
        <div className="portal-list">
          {notices.slice(0, 5).map((notice) => (
            <div className="portal-notice" key={notice.id}>
              <div><strong>{notice.title || 'Notice'}</strong><p>{notice.body}</p></div>
              {!notice.isRead ? <span className="notice-dot" aria-label="Unread" /> : null}
            </div>
          ))}
        </div>
      ) : <div className="portal-empty">No active notices.</div>}
    </div>
  );
}

export default function PortalHomePanel({ workspace, online }: { workspace: MobileWorkspace; online: boolean }) {
  const [data, setData] = useState<MobilePortalHome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!online) {
        setData(null);
        setError('Reconnect to refresh your portal.');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const next = await getMobilePortalHome(workspace);
        if (!cancelled) setData(next);
      } catch (caught) {
        if (!cancelled) {
          setData(null);
          setError(caught instanceof Error ? caught.message : 'Portal data is unavailable.');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [online, workspace]);

  return (
    <section className="home-panel portal-home" aria-label={`${workspace.surface} portal home`}>
      {busy ? <div className="home-loading"><span className="data-spinner" /> Opening your private portal…</div> : null}
      {!busy && error ? <div className="data-state data-state-error home-error"><strong>Portal connection</strong><span>{error}</span></div> : null}
      {!busy && data?.surface === 'teacher' ? <TeacherHome data={data} /> : null}
      {!busy && data?.surface === 'parent' ? <ParentHome data={data} /> : null}
    </section>
  );
}
