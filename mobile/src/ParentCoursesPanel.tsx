import { useEffect, useState } from 'react';
import type { MobileWorkspace } from './lib/mobile-api';
import { getMobilePortalHome, type ParentPortalHome } from './lib/portal-api';

type Raw = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function shortDate(value: unknown) {
  const raw = text(value);
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date);
}
function titleCase(value: string | null) {
  return value ? value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '—';
}

function ChildProgress({ child }: { child: ParentPortalHome['children'][number] }) {
  const quran = (child.latestQuran ?? {}) as Raw;
  const score = number(quran.overall_score);
  const category = text(quran.work_category);
  const outcome = text(quran.outcome);
  const remark = text(quran.parent_visible_remark);
  const occurredAt = quran.occurred_at;

  return (
    <article className="parent-progress-card">
      <header className="parent-progress-heading">
        <div className="portal-avatar" aria-hidden="true">{child.name.charAt(0).toUpperCase()}</div>
        <div><span className="section-kicker">{child.studentNumber || 'Student'}</span><strong>{child.name}</strong>{child.nativeName ? <small>{child.nativeName}</small> : null}</div>
      </header>

      {category || outcome || score != null ? (
        <>
          <div className="parent-progress-metrics">
            <div><span>Latest work</span><strong>{titleCase(category)}</strong></div>
            <div><span>Outcome</span><strong>{titleCase(outcome)}</strong></div>
            <div><span>Score</span><strong>{score == null ? '—' : `${Math.round(score)}%`}</strong></div>
            <div><span>Recorded</span><strong>{shortDate(occurredAt)}</strong></div>
          </div>
          {score != null ? <div className="parent-score-track" aria-label={`Latest score ${Math.round(score)} percent`}><span style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></div> : null}
          {remark ? <div className="parent-visible-remark"><span className="section-kicker">Teacher note</span><p>{remark}</p></div> : null}
        </>
      ) : (
        <div className="data-state"><strong>No guardian-visible progress yet</strong><span>The latest Qur’an/Hifz progress will appear after a parent-visible attempt is recorded.</span></div>
      )}
    </article>
  );
}

export default function ParentCoursesPanel({ workspace, online }: { workspace: MobileWorkspace; online: boolean }) {
  const [data, setData] = useState<ParentPortalHome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!online) {
        setData(null);
        setError('Reconnect to refresh course progress.');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const next = await getMobilePortalHome(workspace);
        if (!cancelled) {
          if (next.surface !== 'parent') throw new Error('Guardian course progress requires a parent portal workspace.');
          setData(next);
        }
      } catch (caught) {
        if (!cancelled) {
          setData(null);
          setError(caught instanceof Error ? caught.message : 'Course progress is temporarily unavailable.');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [online, workspace]);

  return (
    <section className="parent-progress-panel" aria-label="Course progress">
      {busy ? <div className="data-state"><span className="data-spinner" />Loading guardian-visible progress…</div> : null}
      {!busy && error ? <div className="data-state data-state-error"><strong>Course progress</strong><span>{error}</span></div> : null}
      {!busy && data ? <div className="parent-progress-list">{data.children.map((child) => <ChildProgress key={child.personId} child={child} />)}</div> : null}
      <p className="read-only-note">Only progress already marked parent-visible by Ilmgaah is shown in this native view.</p>
    </section>
  );
}
