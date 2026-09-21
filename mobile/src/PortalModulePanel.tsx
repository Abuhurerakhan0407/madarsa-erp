import { useEffect, useState } from 'react';
import type { MobileWorkspace } from './lib/mobile-api';
import { getMobilePortalHome, type MobilePortalHome, type ParentPortalHome } from './lib/portal-api';

type PortalModuleMode = 'timetable' | 'homework' | 'results' | 'notifications';

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

function ParentTimetable({ data }: { data: ParentPortalHome }) {
  const rows = data.overview.todaySchedule;
  return rows.length ? (
    <div className="portal-module-list">
      {rows.map((entry, index) => (
        <article className="portal-module-card" key={`${entry.studentPersonId}-${entry.startsAt}-${index}`}>
          <div className="portal-time-block"><strong>{time(entry.startsAt)}</strong><span>{time(entry.endsAt)}</span></div>
          <div className="portal-module-copy"><span className="section-kicker">{entry.studentName || 'Student'}</span><strong>{entry.subjectName || 'Class'}</strong><p>{entry.teacherName || 'Teacher'}{entry.room ? ` · ${entry.room}` : ''}</p></div>
        </article>
      ))}
    </div>
  ) : <div className="data-state"><strong>No classes today</strong><span>No guardian-visible timetable entries were returned for linked children.</span></div>;
}

function ParentHomework({ data }: { data: ParentPortalHome }) {
  const rows = data.overview.homework;
  return rows.length ? (
    <div className="portal-module-list">
      {rows.map((item, index) => (
        <article className="portal-module-card stacked" key={`${item.id}-${index}`}>
          <div className="portal-module-copy"><span className="section-kicker">{item.studentName || 'Student'} · {item.priority || 'Normal'}</span><strong>{item.title || 'Homework'}</strong><p>{item.teacherName ? `Assigned by ${item.teacherName}` : 'Assigned work'} · due {shortDate(item.dueAt)}</p></div>
          <span className="read-only-pill">Due {shortDate(item.dueAt)}</span>
        </article>
      ))}
    </div>
  ) : <div className="data-state"><strong>No current homework</strong><span>No guardian-visible homework is due right now.</span></div>;
}

function ParentResults({ data }: { data: ParentPortalHome }) {
  const rows = data.overview.results;
  return rows.length ? (
    <div className="portal-module-list">
      {rows.map((item, index) => (
        <article className="portal-result-card" key={`${item.snapshotId}-${index}`}>
          <div><span className="section-kicker">{item.studentName || 'Student'}</span><strong>{item.exam || 'Published result'}</strong><p>Published {shortDate(item.publishedAt)} · {item.status || 'Result available'}</p></div>
          <div className="result-score"><strong>{item.percentage == null ? item.grade || '—' : `${Math.round(item.percentage)}%`}</strong><span>{item.grade || 'Published'}</span></div>
        </article>
      ))}
    </div>
  ) : <div className="data-state"><strong>No published results</strong><span>Published guardian-visible results will appear here.</span></div>;
}

function Notifications({ data }: { data: MobilePortalHome }) {
  return data.notices.length ? (
    <div className="portal-module-list">
      {data.notices.map((notice) => (
        <article className={`portal-notification-card ${notice.isRead ? '' : 'is-unread'}`} key={notice.id}>
          <div className="notice-indicator" aria-hidden="true" />
          <div><span className="section-kicker">{notice.audience} · {shortDate(notice.publishedAt)}</span><strong>{notice.title || 'Institution notice'}</strong><p>{notice.body}</p></div>
        </article>
      ))}
    </div>
  ) : <div className="data-state"><strong>No active notices</strong><span>Institution announcements visible to this account will appear here.</span></div>;
}

export default function PortalModulePanel({
  workspace,
  online,
  mode,
}: {
  workspace: MobileWorkspace;
  online: boolean;
  mode: PortalModuleMode;
}) {
  const [data, setData] = useState<MobilePortalHome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!online) {
        setData(null);
        setError('Reconnect to refresh this module.');
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
          setError(caught instanceof Error ? caught.message : 'This module is temporarily unavailable.');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [online, workspace]);

  return (
    <section className="portal-module-panel" aria-label={mode}>
      {busy ? <div className="data-state"><span className="data-spinner" />Loading private portal data…</div> : null}
      {!busy && error ? <div className="data-state data-state-error"><strong>Portal module</strong><span>{error}</span></div> : null}
      {!busy && data && mode === 'notifications' ? <Notifications data={data} /> : null}
      {!busy && data?.surface === 'parent' && mode === 'timetable' ? <ParentTimetable data={data} /> : null}
      {!busy && data?.surface === 'parent' && mode === 'homework' ? <ParentHomework data={data} /> : null}
      {!busy && data?.surface === 'parent' && mode === 'results' ? <ParentResults data={data} /> : null}
      {!busy && data?.surface === 'teacher' && mode !== 'notifications' ? (
        <div className="data-state"><strong>Scoped teacher module</strong><span>This teacher feature stays locked until its assignment-scoped API is complete.</span></div>
      ) : null}
      <p className="read-only-note">Portal data remains read-only while native write authorization and device QA are still being completed.</p>
    </section>
  );
}
