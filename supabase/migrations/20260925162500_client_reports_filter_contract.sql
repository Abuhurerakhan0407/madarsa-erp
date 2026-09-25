begin;

update public.report_definitions
set parameter_schema=jsonb_build_object(
  'date_from','date',
  'date_to','date',
  'program_id','bigint',
  'group_id','bigint'
)
where state='published'
  and key in ('student_strength','absence_trend','late_trend','new_admissions');

commit;
