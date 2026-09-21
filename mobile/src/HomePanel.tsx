import { useEffect, useMemo, useState } from 'react';
import type { MobileWorkspace } from './lib/mobile-api';
import { getMobileHome, type MobileHomeMetrics } from './lib/home-api';

function localDateIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function percent(value: number, total: number) {
  if (total <= 0) return null;
  return Math.round((value / total) * 100);
}

export default function HomePanel({ workspace, online }: { workspace: MobileWorkspace; online: boolean }) {
  const [data, setData] = useState<MobileHomeMetrics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!online) {
        setError('Reconnect to refresh your dashboard.');
        return;
      }
      if (workspace.surface === 'parent') {
        setError('Parent child overview is the next role-specific home view.');
        return;
      }

      setBusy(true);
      setError(null);
      try {
        const next = await getMobileHome(workspace, localDateIso());
        if (!cancelled) setData(next);
      } catch (caught) {
        if (!cancelled) {
          setData(null);
          setError(caught instanceof Error ? caught.message : 'Dashboard data is unavailable.');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [online, workspace]);

  const attendanceRate = useMemo(() => {
    const attendance = data?.metrics.attendance;
    return attendance ? percent(attendance.present, attendance.marked) : null;
  }, [data]);

  return (
    <section className="home-panel" aria-label="Mobile dashboard">
      {busy ? (
        <div className="home-loading" aria-live="polite">
          <span className="data-spinner" /> Refreshing governed records…
        </div>
      ) : error ? (
        <div className="data-state data-state-error home-error">
          <strong>Native dashboard connection</strong>
          <span>{error}</span>
        </div>
      ) : data ? (
        <>
          <div className="home-date-row">
            <div>
              <span className="section-kicker">Live workspace</span>
              <strong>{data.date}</strong>
            </div>
            <span className="read-only-pill">Read only</span>
          </div>

          <div className="home-metric-grid">
            <article className="home-metric hero-metric">
              <span>Active students</span>
              <strong>{data.metrics.students.active}</strong>
              <small>{data.metrics.students.total} total records</small>
            </article>
            <article className="home-metric">
              <span>Attendance</span>
              <strong>{attendanceRate == null ? '—' : `${attendanceRate}%`}</strong>
              <small>{data.metrics.attendance.present} present · {data.metrics.attendance.absent} absent</small>
            </article>
            {data.metrics.staff ? (
              <article className="home-metric">
                <span>Active teachers</span>
                <strong>{data.metrics.staff.active}</strong>
                <small>{data.metrics.staff.onLeave} on leave</small>
              </article>
            ) : null}
            {data.metrics.admissions ? (
              <article className="home-metric">
                <span>Open admissions</span>
                <strong>{data.metrics.admissions.open}</strong>
                <small>{data.metrics.admissions.converted} converted</small>
              </article>
            ) : null}
          </div>

          <div className="attention-card">
            <div>
              <span className="section-kicker">Today</span>
              <strong>{data.metrics.attendance.unmarked > 0 ? `${data.metrics.attendance.unmarked} attendance records need attention` : 'Attendance is up to date'}</strong>
            </div>
            <span>{data.metrics.attendance.marked}/{data.metrics.attendance.total}</span>
          </div>
        </>
      ) : null}
    </section>
  );
}
