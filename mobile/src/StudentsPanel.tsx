import { useEffect, useMemo, useState } from 'react';
import type { MobileWorkspace } from './lib/mobile-api';
import { getMobileStudents, type MobileStudentsResponse } from './lib/students-api';

function titleCase(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function StudentsPanel({ workspace, online }: { workspace: MobileWorkspace; online: boolean }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MobileStudentsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!online) {
        setData(null);
        setError('Reconnect to load student records.');
        return;
      }
      if (workspace.surface === 'parent') {
        setData(null);
        setError('Guardian child profiles use a separate child-scoped view.');
        return;
      }

      setBusy(true);
      setError(null);
      try {
        const next = await getMobileStudents(workspace, {
          page,
          pageSize: 30,
          search,
          status: status || undefined,
        });
        if (cancelled) return;
        setData(next);
        if (next.page !== page) setPage(next.page);
      } catch (caught) {
        if (!cancelled) {
          setData(null);
          setError(caught instanceof Error ? caught.message : 'Student records are unavailable.');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [online, page, search, status, workspace]);

  const summary = useMemo(() => ({
    shown: data?.rows.length ?? 0,
    total: data?.total ?? 0,
    active: data?.active ?? 0,
  }), [data]);

  return (
    <section className="students-panel" aria-label="Students">
      <div className="students-toolbar">
        <div>
          <span className="section-kicker">Read-only preview</span>
          <strong>Student register</strong>
        </div>
        <div className="students-summary" aria-label="Student summary">
          <span><b>{summary.active}</b> active</span>
          <span><b>{summary.total}</b> total</span>
        </div>
      </div>

      <div className="students-controls">
        <label className="search-field">
          <span className="sr-only">Search students</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or student number"
            autoComplete="off"
            disabled={busy && !data}
          />
        </label>
        <select
          aria-label="Filter student status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="graduated">Graduated</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
      </div>

      {busy && !data ? (
        <div className="data-state"><span className="data-spinner" />Loading students securely…</div>
      ) : error ? (
        <div className="data-state data-state-error">
          <strong>Student register</strong>
          <span>{error}</span>
        </div>
      ) : data && data.rows.length === 0 ? (
        <div className="data-state">
          <strong>No matching students</strong>
          <span>Try a different name, student number, or status.</span>
        </div>
      ) : data ? (
        <>
          <div className={`native-student-list ${busy ? 'is-refreshing' : ''}`} aria-live="polite">
            {data.rows.map((student) => (
              <article className="native-student-card" key={student.personId}>
                <div className="student-avatar" aria-hidden="true">{student.name.trim().charAt(0).toUpperCase() || 'S'}</div>
                <div className="native-student-copy">
                  <div className="native-student-heading">
                    <strong>{student.name}</strong>
                    <span className={`student-state state-${student.status.toLowerCase()}`}>{titleCase(student.status)}</span>
                  </div>
                  {student.nativeName ? <span className="native-name">{student.nativeName}</span> : null}
                  <div className="student-meta">
                    <span>{student.studentNumber}</span>
                    <span>{student.program}</span>
                    <span>{student.group}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="students-pagination" aria-label="Student register pages">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={busy || data.page <= 1}>Previous</button>
            <span>Page <b>{data.page}</b> of <b>{data.pages}</b> · {summary.shown} shown</span>
            <button type="button" onClick={() => setPage((value) => Math.min(data.pages, value + 1))} disabled={busy || data.page >= data.pages}>Next</button>
          </div>
        </>
      ) : null}

      <p className="read-only-note">Viewing only. Student creation, edits and document uploads remain disabled until native write authorization and device QA are complete.</p>
    </section>
  );
}
