import { useEffect, useMemo, useState } from 'react';
import type { MobileWorkspace } from './lib/mobile-api';
import { getTeacherPortalClasses, type TeacherPortalClasses } from './lib/portal-api';

export default function TeacherClassesPanel({
  workspace,
  online,
  mode,
}: {
  workspace: MobileWorkspace;
  online: boolean;
  mode: 'classes' | 'students';
}) {
  const [data, setData] = useState<TeacherPortalClasses | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!online) {
        setData(null);
        setError('Reconnect to load your assigned classes.');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const next = await getTeacherPortalClasses(workspace);
        if (!cancelled) {
          setData(next);
          setSelectedGroup((current) => current && next.groups.some((group) => group.id === current) ? current : null);
        }
      } catch (caught) {
        if (!cancelled) {
          setData(null);
          setError(caught instanceof Error ? caught.message : 'Assigned classes are unavailable.');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [online, workspace]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.students.filter((student) => {
      if (selectedGroup && student.groupId !== selectedGroup) return false;
      if (!needle) return true;
      return `${student.name} ${student.nativeName ?? ''} ${student.studentNumber} ${student.groupName}`.toLowerCase().includes(needle);
    });
  }, [data, query, selectedGroup]);

  if (busy && !data) return <section className="teacher-scope-panel"><div className="data-state"><span className="data-spinner" />Loading assigned teaching scope…</div></section>;
  if (error) return <section className="teacher-scope-panel"><div className="data-state data-state-error"><strong>Teaching scope</strong><span>{error}</span></div></section>;
  if (!data) return null;

  if (mode === 'classes') {
    return (
      <section className="teacher-scope-panel" aria-label="My classes">
        <div className="teacher-scope-heading">
          <div><span className="section-kicker">Verified assignments</span><strong>My classes</strong></div>
          <span className="read-only-pill">{data.groups.length} groups</span>
        </div>
        {data.groups.length ? (
          <div className="teacher-group-grid">
            {data.groups.map((group) => (
              <button
                className={`teacher-group-card ${selectedGroup === group.id ? 'is-active' : ''}`}
                type="button"
                key={group.id}
                onClick={() => setSelectedGroup((current) => current === group.id ? null : group.id)}
              >
                <span className="group-monogram" aria-hidden="true">{group.name.trim().charAt(0).toUpperCase() || 'C'}</span>
                <div><strong>{group.name}</strong><span>{group.studentCount} students</span></div>
                <span className="profile-chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="data-state"><strong>No assigned groups</strong><span>No active primary-teacher, curriculum or timetable group assignment was found for this branch.</span></div>
        )}
        {selectedGroup ? (
          <div className="teacher-class-roster">
            <div className="teacher-scope-heading compact-heading"><div><span className="section-kicker">Roster</span><strong>{data.groups.find((group) => group.id === selectedGroup)?.name ?? 'Class'}</strong></div></div>
            {filteredStudents.map((student) => (
              <div className="teacher-student-row" key={`${student.personId}-${student.groupId}`}>
                <span className="student-avatar" aria-hidden="true">{student.name.charAt(0).toUpperCase()}</span>
                <div><strong>{student.name}</strong><span>{student.studentNumber}{student.nativeName ? ` · ${student.nativeName}` : ''}</span></div>
                <span className="student-state state-active">{student.enrollmentStatus}</span>
              </div>
            ))}
          </div>
        ) : null}
        <p className="read-only-note">Class access is derived only from your primary-teacher, curriculum and timetable assignments in this branch.</p>
      </section>
    );
  }

  return (
    <section className="teacher-scope-panel" aria-label="My students">
      <div className="teacher-scope-heading">
        <div><span className="section-kicker">Assigned scope only</span><strong>My students</strong></div>
        <span className="read-only-pill">{filteredStudents.length} visible</span>
      </div>
      <div className="teacher-student-controls">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assigned students" aria-label="Search assigned students" />
        <select value={selectedGroup ?? ''} onChange={(event) => setSelectedGroup(event.target.value ? Number(event.target.value) : null)} aria-label="Filter by assigned class">
          <option value="">All my classes</option>
          {data.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
      </div>
      {filteredStudents.length ? (
        <div className="teacher-student-list">
          {filteredStudents.map((student) => (
            <article className="teacher-student-row" key={`${student.personId}-${student.groupId}`}>
              <span className="student-avatar" aria-hidden="true">{student.name.charAt(0).toUpperCase()}</span>
              <div><strong>{student.name}</strong><span>{student.studentNumber} · {student.groupName}{student.nativeName ? ` · ${student.nativeName}` : ''}</span></div>
              <span className="student-state state-active">{student.status}</span>
            </article>
          ))}
        </div>
      ) : <div className="data-state"><strong>No matching assigned students</strong><span>Try another search or assigned class.</span></div>}
      <p className="read-only-note">No contact, guardian, medical or institution-wide student data is exposed in this teacher portal view.</p>
    </section>
  );
}
