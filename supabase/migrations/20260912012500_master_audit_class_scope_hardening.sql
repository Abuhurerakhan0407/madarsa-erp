-- Follow-up to master audit Phase 0: direct sensitive reads must respect teacher/class scope,
-- not merely tenant or branch scope.

create or replace function private.identity_assigned_teacher_for_student_v1(
  p_tenant_id bigint,
  p_student_person_id bigint
) returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.identity_person_links ipl
    join public.enrollments e
      on e.tenant_id = ipl.tenant_id
     and e.student_person_id = p_student_person_id
     and e.status in ('active','paused')
    left join public.academic_groups g
      on g.tenant_id = e.tenant_id
     and g.id = e.group_id
    where ipl.tenant_id = p_tenant_id
      and ipl.identity_id = (select auth.uid())
      and ipl.link_type = 'employee'
      and ipl.status = 'verified'
      and (
        g.primary_teacher_person_id = ipl.person_id
        or exists (
          select 1
          from public.timetable_entries te
          where te.tenant_id = e.tenant_id
            and te.branch_id = e.branch_id
            and te.group_id = e.group_id
            and te.teacher_person_id = ipl.person_id
            and te.status = 'active'
            and (te.effective_from is null or te.effective_from <= public.institution_local_date(p_tenant_id))
            and (te.effective_to is null or te.effective_to >= public.institution_local_date(p_tenant_id))
        )
      )
  );
$$;

revoke all on function private.identity_assigned_teacher_for_student_v1(bigint,bigint) from public, anon;
grant execute on function private.identity_assigned_teacher_for_student_v1(bigint,bigint) to authenticated, service_role;

create or replace function private.person_branch_read_allowed_v1(
  p_tenant_id bigint,
  p_person_id bigint
) returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select
    exists (
      select 1
      from public.enrollments e
      where e.tenant_id = p_tenant_id
        and e.student_person_id = p_person_id
        and (
          private.has_permission(p_tenant_id, 'people.person.read', e.branch_id)
          or private.has_permission(p_tenant_id, 'students.profile.update', e.branch_id)
          or (
            e.status in ('active','paused')
            and private.has_permission(p_tenant_id, 'students.profile.read', e.branch_id)
            and private.identity_assigned_teacher_for_student_v1(p_tenant_id,p_person_id)
          )
        )
    )
    or exists (
      select 1
      from public.hr_employments he
      where he.tenant_id = p_tenant_id
        and he.employee_person_id = p_person_id
        and private.has_permission(p_tenant_id, 'people.person.read', he.branch_id)
    )
    or exists (
      select 1
      from public.person_relationships pr
      join public.enrollments e
        on e.tenant_id = pr.tenant_id
       and e.student_person_id = pr.target_person_id
      where pr.tenant_id = p_tenant_id
        and pr.source_person_id = p_person_id
        and pr.status = 'verified'
        and private.has_permission(p_tenant_id, 'people.person.read', e.branch_id)
    );
$$;

create or replace function private.student_profile_branch_read_allowed_v1(
  p_tenant_id bigint,
  p_person_id bigint
) returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.enrollments e
    where e.tenant_id = p_tenant_id
      and e.student_person_id = p_person_id
      and (
        private.has_permission(p_tenant_id, 'people.person.read', e.branch_id)
        or private.has_permission(p_tenant_id, 'students.profile.update', e.branch_id)
        or (
          e.status in ('active','paused')
          and private.has_permission(p_tenant_id, 'students.profile.read', e.branch_id)
          and private.identity_assigned_teacher_for_student_v1(p_tenant_id,p_person_id)
        )
      )
  );
$$;

create or replace function private.attendance_record_scoped_read_allowed_v2(
  p_tenant_id bigint,
  p_attendance_session_id bigint,
  p_enrollment_id bigint,
  p_person_id bigint
) returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select
    exists (
      select 1
      from public.enrollments e
      where e.tenant_id = p_tenant_id
        and e.id = p_enrollment_id
        and (
          private.has_permission(p_tenant_id, 'people.person.read', e.branch_id)
          or private.has_permission(p_tenant_id, 'attendance.student.approve', e.branch_id)
          or private.has_permission(p_tenant_id, 'attendance.student.correct', e.branch_id)
          or (
            private.has_permission(p_tenant_id, 'attendance.student.read', e.branch_id)
            and private.identity_assigned_teacher_for_student_v1(p_tenant_id,p_person_id)
          )
        )
    )
    or exists (
      select 1
      from public.attendance_sessions s
      where s.tenant_id = p_tenant_id
        and s.id = p_attendance_session_id
        and private.has_permission(p_tenant_id, 'attendance.staff.read', s.branch_id)
    );
$$;

revoke all on function private.attendance_record_scoped_read_allowed_v2(bigint,bigint,bigint,bigint) from public, anon;
grant execute on function private.attendance_record_scoped_read_allowed_v2(bigint,bigint,bigint,bigint) to authenticated, service_role;

create or replace function private.mark_entry_scoped_read_allowed_v2(
  p_tenant_id bigint,
  p_enrollment_id bigint,
  p_student_person_id bigint,
  p_marksheet_id bigint
) returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.enrollments e
    where e.tenant_id = p_tenant_id
      and e.id = p_enrollment_id
      and (
        private.has_permission(p_tenant_id, 'assessment.marks.moderate', e.branch_id)
        or private.has_permission(p_tenant_id, 'assessment.setup.manage', e.branch_id)
        or private.has_permission(p_tenant_id, 'assessment.results.approve', e.branch_id)
        or private.has_permission(p_tenant_id, 'assessment.results.publish', e.branch_id)
        or (
          private.has_permission(p_tenant_id, 'assessment.marks.read', e.branch_id)
          and (
            private.identity_assigned_teacher_for_student_v1(p_tenant_id,p_student_person_id)
            or exists (
              select 1
              from public.marksheets ms
              join public.identity_person_links ipl
                on ipl.tenant_id = ms.tenant_id
               and ipl.person_id = ms.evaluator_person_id
               and ipl.identity_id = (select auth.uid())
               and ipl.link_type = 'employee'
               and ipl.status = 'verified'
              where ms.tenant_id = p_tenant_id
                and ms.id = p_marksheet_id
            )
          )
        )
      )
  );
$$;

revoke all on function private.mark_entry_scoped_read_allowed_v2(bigint,bigint,bigint,bigint) from public, anon;
grant execute on function private.mark_entry_scoped_read_allowed_v2(bigint,bigint,bigint,bigint) to authenticated, service_role;

drop policy if exists attendance_records_scoped_read on public.attendance_records;
create policy attendance_records_scoped_read on public.attendance_records
for select to authenticated
using (
  private.attendance_record_scoped_read_allowed_v2(tenant_id, attendance_session_id, enrollment_id, person_id)
  or private.has_relationship(tenant_id, person_id::text, 'read')
);

drop policy if exists mark_entries_staff_read on public.mark_entries;
create policy mark_entries_staff_read on public.mark_entries
for select to authenticated
using (
  private.mark_entry_scoped_read_allowed_v2(tenant_id, enrollment_id, student_person_id, marksheet_id)
);
