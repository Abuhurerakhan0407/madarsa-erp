import { useEffect, useMemo, useState } from 'react';
import type { MobileWorkspace } from './lib/mobile-api';
import {
  getMobileStudentProfile,
  getMobileStudents,
  type MobileStudentProfileResponse,
  type MobileStudentsResponse,
} from './lib/students-api';

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
  const [profile, setProfile] = useState<MobileStudentProfileResponse | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

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

  useEffect(() => {
    setProfile(null);
    setProfileError(null);
  }, [workspace]);

  const summary = useMemo(() => ({
    shown: data?.rows.length ?? 0,
    total: data?.total ?? 0,
    active: data?.active ?? 0,
  }), [data]);

  async function openProfile(personId: number) {
    if (!online) {
      setProfile(null);
      setProfileError('Reconnect to open this student profile.');
      return;
    }
    setProfile(null);
    setProfileError(null);
    setProfileBusy(true);
    try {
      setProfile(await getMobileStudentProfile(workspace, personId));
    } catch (caught) {
      setProfileError(caught instanceof Error ? caught.message : 'Student profile is unavailable.');
    } finally {
      setProfileBusy(false);
    }
  }

  const closeProfile = () => {
    setProfile(null);
    setProfileError(null);
    setProfileBusy(false);
  };

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
              <button className="native-student-card" type="button" key={student.personId} onClick={() => void openProfile(student.personId)}>
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
                <span className="profile-chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>

          <div className="students-pagination" aria-label="Student register pages">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={busy || data.page <= 1}>Previous</button>
            <span>Page <b>{data.page}</b> of <b>{data.pages}</b> · {summary.shown} shown</span>
            <button type="button" onClick={() => setPage((value) => Math.min(data.pages, value + 1))} disabled={busy || data.page >= data.pages}>Next</button>
          </div>
        </>
      ) : null}

      {(profileBusy || profileError || profile) ? (
        <div className="profile-sheet-backdrop" role="presentation" onClick={closeProfile}>
          <section className="profile-sheet" role="dialog" aria-modal="true" aria-label="Student profile" onClick={(event) => event.stopPropagation()}>
            <div className="profile-sheet-handle" aria-hidden="true" />
            <button className="profile-close" type="button" onClick={closeProfile} aria-label="Close student profile">×</button>
            {profileBusy ? (
              <div className="data-state profile-loading"><span className="data-spinner" />Loading profile securely…</div>
            ) : profileError ? (
              <div className="data-state data-state-error"><strong>Student profile</strong><span>{profileError}</span></div>
            ) : profile ? (
              <>
                <div className="profile-identity">
                  <div className="student-avatar profile-avatar" aria-hidden="true">{profile.student.name.trim().charAt(0).toUpperCase() || 'S'}</div>
                  <div><span className="section-kicker">Student profile</span><h2>{profile.student.name}</h2>{profile.student.nativeName ? <p>{profile.student.nativeName}</p> : null}</div>
                </div>
                <div className="profile-tags">
                  <span>{profile.student.studentNumber}</span>
                  <span>{profile.student.program}</span>
                  <span>{profile.student.group}</span>
                  <span>{titleCase(profile.student.status)}</span>
                </div>
                <div className="profile-metrics">
                  <div><span>Present</span><strong>{profile.attendance.present}</strong></div>
                  <div><span>Absent</span><strong>{profile.attendance.absent}</strong></div>
                  <div><span>Late</span><strong>{profile.attendance.late}</strong></div>
                  <div><span>Results</span><strong>{profile.resultCount ?? '—'}</strong></div>
                </div>
                <div className="profile-facts">
                  <div><span>Admission no.</span><strong>{profile.student.admissionNumber || '—'}</strong></div>
                  <div><span>Joined</span><strong>{profile.student.joinedOn || '—'}</strong></div>
                  <div><span>Qur’an attempts</span><strong>{profile.quranAttempts ?? '—'}</strong></div>
                  <div><span>Attendance records</span><strong>{profile.attendance.total}</strong></div>
                </div>
                <p className="privacy-note profile-privacy">Mobile profile intentionally excludes medical notes, guardian contact details and other sensitive fields.</p>
              </>
            ) : null}
          </section>
        </div>
      ) : null}

      <p className="read-only-note">Viewing only. Student creation, edits and document uploads remain disabled until native write authorization and device QA are complete.</p>
    </section>
  );
}
