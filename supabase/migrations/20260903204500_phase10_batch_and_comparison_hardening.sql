begin;

-- Phase 10 hardening: constrain group/program comparison exam averages to exams
-- whose series overlaps the requested report date window. The preceding Phase 10
-- migration owns the full report runtime; this migration applies only the delta
-- so recovery/replay does not duplicate the entire engine definition.
do $hardening$
declare
  v_definition text;
  v_before constant text := 'case when me.raw_marks is null or es.maximum_marks=0 then null else';
  v_after constant text := 'case when ex.id is null or me.raw_marks is null or es.maximum_marks=0 then null else';
begin
  select pg_get_functiondef('public.run_operational_report_v1(uuid,bigint,bigint,text,jsonb,text,text)'::regprocedure)
    into v_definition;

  if position(v_after in v_definition) > 0 then
    return;
  end if;
  if position(v_before in v_definition) = 0 then
    raise exception 'Phase 10 report runtime shape changed before comparison hardening';
  end if;

  execute replace(v_definition,v_before,v_after);
end;
$hardening$;

revoke all on function public.run_operational_report_v1(uuid,bigint,bigint,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.run_operational_report_v1(uuid,bigint,bigint,text,jsonb,text,text) to service_role;

commit;
