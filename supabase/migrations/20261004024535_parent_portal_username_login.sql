-- Parent portal username login.
-- Generated with Supabase CLI 2.119.0.
-- Validated on Ilmgaah staging only; do not apply to production automatically.

alter table public.guardian_profiles
  add column if not exists portal_username text;

create or replace function private.ensure_guardian_portal_username_v1()
returns trigger
language plpgsql
security definer
set search_path = 'pg_catalog','extensions'
as $$
declare
  v_slug text;
  v_prefix text;
  v_candidate text;
  v_bytes bytea;
  v_suffix text;
  v_chars constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_attempt integer;
  v_char_index integer;
begin
  if tg_op = 'UPDATE'
     and old.portal_username is not null
     and new.portal_username is distinct from old.portal_username then
    raise exception 'guardian portal username cannot be changed';
  end if;

  if new.portal_username is not null then
    new.portal_username := lower(btrim(new.portal_username));
    if new.portal_username !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{3,8}-[abcdefghjkmnpqrstuvwxyz23456789]{6}$' then
      raise exception 'invalid guardian portal username';
    end if;
    return new;
  end if;

  select lower(regexp_replace(t.slug,'[^abcdefghjkmnpqrstuvwxyz23456789]','','g'))
    into v_slug
  from public.tenants t
  where t.id = new.tenant_id;

  if v_slug is not null and length(v_slug) >= 3 then
    v_prefix := left(v_slug,4);
  else
    v_bytes := digest(new.tenant_id::text,'sha256');
    v_prefix := '';
    for v_char_index in 0..3 loop
      v_prefix := v_prefix || substr(v_chars,(get_byte(v_bytes,v_char_index) % length(v_chars)) + 1,1);
    end loop;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('guardian-portal-username:' || new.tenant_id::text,0)
  );

  for v_attempt in 1..50 loop
    v_bytes := gen_random_bytes(6);
    v_suffix := '';
    for v_char_index in 0..5 loop
      v_suffix := v_suffix || substr(v_chars,(get_byte(v_bytes,v_char_index) % length(v_chars)) + 1,1);
    end loop;
    v_candidate := lower(v_prefix || '-' || v_suffix);

    if not exists (
      select 1
      from public.guardian_profiles gp
      where lower(gp.portal_username) = v_candidate
    )
    and not exists (
      select 1
      from auth.users u
      where lower(u.email) = v_candidate || '@parents.ilmgaah.in'
    ) then
      new.portal_username := v_candidate;
      return new;
    end if;
  end loop;

  raise exception 'unable to generate unique guardian portal username';
end;
$$;

revoke all on function private.ensure_guardian_portal_username_v1() from public, anon, authenticated;

drop trigger if exists guardian_profiles_portal_username_assign
  on public.guardian_profiles;

create trigger guardian_profiles_portal_username_assign
before insert or update of portal_username
on public.guardian_profiles
for each row
execute function private.ensure_guardian_portal_username_v1();

update public.guardian_profiles
set portal_username = null
where portal_username is null;

alter table public.guardian_profiles
  drop constraint if exists guardian_profiles_portal_username_shape;

alter table public.guardian_profiles
  add constraint guardian_profiles_portal_username_shape
  check (
    portal_username = lower(portal_username)
    and portal_username ~ '^[abcdefghjkmnpqrstuvwxyz23456789]{3,8}-[abcdefghjkmnpqrstuvwxyz23456789]{6}$'
  );

create unique index if not exists guardian_profiles_portal_username_tenant_ci_idx
  on public.guardian_profiles(tenant_id, lower(portal_username));

-- Auth email identifiers are globally unique, so keep portal usernames
-- globally unique too. This is stronger than the tenant-scoped requirement.
create unique index if not exists guardian_profiles_portal_username_global_ci_idx
  on public.guardian_profiles(lower(portal_username));

alter table public.guardian_profiles
  alter column portal_username set not null;

create or replace function public.ensure_guardian_portal_username_v1(
  p_tenant_id bigint,
  p_person_id bigint
) returns text
language plpgsql
security definer
set search_path = 'pg_catalog','extensions'
as $$
declare
  v_username text;
begin
  select gp.portal_username
    into v_username
  from public.guardian_profiles gp
  where gp.tenant_id = p_tenant_id
    and gp.person_id = p_person_id;

  if not found then
    raise exception 'guardian not found';
  end if;

  if v_username is null then
    update public.guardian_profiles
    set portal_username = null
    where tenant_id = p_tenant_id
      and person_id = p_person_id
    returning portal_username into v_username;
  end if;

  return v_username;
end;
$$;

revoke all on function public.ensure_guardian_portal_username_v1(bigint,bigint)
  from public,anon,authenticated;
grant execute on function public.ensure_guardian_portal_username_v1(bigint,bigint)
  to service_role;

create index if not exists security_rate_limit_events_source_idx
  on public.security_rate_limit_events(action_key,source_hash,occurred_at desc);

create index if not exists security_rate_limit_events_actor_idx
  on public.security_rate_limit_events(action_key,actor_hash,occurred_at desc)
  where actor_hash is not null;

create or replace function public.consume_parent_portal_login_rate_limit_v1(
  p_source_key text,
  p_username text default null
) returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog','extensions'
as $$
declare
  v_now timestamptz := now();
  v_source_hash text;
  v_actor_hash text;
  v_source_count integer;
  v_actor_count integer := 0;
  v_ip_limit constant integer := 60;
  v_username_limit constant integer := 8;
  v_window constant interval := interval '10 minutes';
  v_throttled boolean := false;
begin
  if p_source_key is null or length(p_source_key) > 256 then
    raise exception 'invalid login source key';
  end if;
  if p_username is not null and length(p_username) > 128 then
    raise exception 'invalid login username key';
  end if;

  v_source_hash := encode(
    digest(coalesce(p_source_key,'unknown'),'sha256'),
    'hex'
  );
  v_actor_hash := case
    when p_username is null then null
    else encode(digest(lower(btrim(p_username)),'sha256'),'hex')
  end;

  perform pg_advisory_xact_lock(
    hashtextextended('parent-login-ip:' || v_source_hash,0)
  );
  if v_actor_hash is not null then
    perform pg_advisory_xact_lock(
      hashtextextended('parent-login-user:' || v_actor_hash,0)
    );
  end if;

  select count(*)::integer
    into v_source_count
  from public.security_rate_limit_events e
  where e.action_key = 'parent.portal.login'
    and e.source_hash = v_source_hash
    and e.occurred_at >= v_now - v_window;

  if v_actor_hash is not null then
    select count(*)::integer
      into v_actor_count
    from public.security_rate_limit_events e
    where e.action_key = 'parent.portal.login'
      and e.actor_hash = v_actor_hash
      and e.occurred_at >= v_now - v_window;
  end if;

  v_throttled := v_source_count >= v_ip_limit
    or (v_actor_hash is not null and v_actor_count >= v_username_limit);

  insert into public.security_rate_limit_events(
    tenant_id,
    action_key,
    actor_hash,
    source_hash,
    decision,
    limit_snapshot,
    correlation_id
  ) values (
    null,
    'parent.portal.login',
    v_actor_hash,
    v_source_hash,
    case when v_throttled then 'throttled' else 'allowed' end,
    jsonb_build_object(
      'window_seconds',600,
      'ip_attempts',v_ip_limit,
      'username_attempts',v_username_limit
    ),
    gen_random_uuid()
  );

  return jsonb_build_object(
    'allowed',not v_throttled,
    'retry_after_seconds',case when v_throttled then 600 else 0 end
  );
end;
$$;

revoke all on function public.consume_parent_portal_login_rate_limit_v1(text,text)
  from public,anon,authenticated;
grant execute on function public.consume_parent_portal_login_rate_limit_v1(text,text)
  to service_role;

create or replace function public.upsert_student_primary_guardian_v2(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_student_person_id bigint,
  p_name text,
  p_relationship text,
  p_phone text default null,
  p_occupation text default null,
  p_education text default null,
  p_can_collect boolean default true,
  p_guardian_person_id bigint default null
) returns jsonb
language plpgsql
set search_path to 'pg_catalog','extensions'
as $function$
declare
  v_membership_id bigint;
  v_guardian_person_id bigint;
  v_relationship_id bigint;
  v_phone_contact_id bigint;
  v_name text := btrim(coalesce(p_name,''));
  v_phone text := nullif(btrim(coalesce(p_phone,'')),'');
  v_occupation text := nullif(btrim(coalesce(p_occupation,'')),'');
  v_education text := nullif(btrim(coalesce(p_education,'')),'');
  v_correlation_id uuid := gen_random_uuid();
  v_before jsonb;
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null or p_student_person_id is null then
    raise exception 'identity, tenant, branch, and student are required';
  end if;

  if length(v_name) not between 2 and 160 then
    raise exception 'guardian name must be between 2 and 160 characters';
  end if;
  if p_relationship not in ('father','mother','guardian') then
    raise exception 'guardian relationship is invalid';
  end if;
  if v_phone is not null and length(v_phone) > 80 then
    raise exception 'guardian phone is too long';
  end if;
  if v_occupation is not null and length(v_occupation) > 160 then
    raise exception 'guardian occupation is too long';
  end if;
  if v_education is not null and length(v_education) > 160 then
    raise exception 'guardian education is too long';
  end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id
    and m.identity_id=p_identity_id
    and m.status='active'
    and (m.starts_at is null or m.starts_at<=now())
    and (m.ends_at is null or m.ends_at>now())
    and (
      m.all_branches
      or exists(
        select 1
        from public.membership_branch_scopes mbs
        where mbs.tenant_id=m.tenant_id
          and mbs.membership_id=m.id
          and mbs.branch_id=p_branch_id
      )
    )
    and exists(
      select 1
      from public.membership_roles mr
      join public.roles r
        on r.tenant_id=mr.tenant_id
       and r.id=mr.role_id
       and r.status='active'
      join public.role_permissions rp
        on rp.tenant_id=r.tenant_id
       and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id
        and mr.membership_id=m.id
        and rp.permission_code in ('people.person.manage','students.profile.update')
      group by mr.membership_id
      having count(distinct rp.permission_code)=2
    )
  order by m.created_at asc
  limit 1;

  if v_membership_id is null then
    raise exception 'guardian management permission denied';
  end if;

  if not exists(
    select 1
    from public.student_profiles sp
    join public.enrollments e
      on e.tenant_id=sp.tenant_id
     and e.student_person_id=sp.person_id
    where sp.tenant_id=p_tenant_id
      and sp.person_id=p_student_person_id
      and e.branch_id=p_branch_id
      and e.status<>'cancelled'
  ) then
    raise exception 'student is not available in the active branch';
  end if;

  if p_guardian_person_id is not null then
    if not exists(
      select 1
      from public.guardian_profiles gp
      where gp.tenant_id=p_tenant_id
        and gp.person_id=p_guardian_person_id
    ) then
      raise exception 'selected guardian is not available';
    end if;

    v_guardian_person_id := p_guardian_person_id;

    select pr.id
      into v_relationship_id
    from public.person_relationships pr
    where pr.tenant_id=p_tenant_id
      and pr.source_person_id=v_guardian_person_id
      and pr.target_person_id=p_student_person_id
      and pr.status<>'revoked'
    order by pr.is_primary desc,pr.updated_at desc,pr.id desc
    limit 1;

    update public.person_relationships
    set is_primary=false,updated_at=now()
    where tenant_id=p_tenant_id
      and target_person_id=p_student_person_id
      and is_primary=true
      and (v_relationship_id is null or id<>v_relationship_id);

    if v_relationship_id is null then
      insert into public.person_relationships(
        tenant_id,source_person_id,target_person_id,relationship_type,status,
        is_primary,can_collect_student,portal_visibility,verified_at,verified_by_membership_id
      ) values(
        p_tenant_id,v_guardian_person_id,p_student_person_id,p_relationship,'verified',
        true,coalesce(p_can_collect,true),'standard',now(),v_membership_id
      )
      returning id into v_relationship_id;
    else
      update public.person_relationships
      set relationship_type=p_relationship,
          status='verified',
          is_primary=true,
          can_collect_student=coalesce(p_can_collect,true),
          portal_visibility='standard',
          verified_at=now(),
          verified_by_membership_id=v_membership_id,
          updated_at=now()
      where tenant_id=p_tenant_id
        and id=v_relationship_id;
    end if;
  else
    select pr.id,pr.source_person_id
      into v_relationship_id,v_guardian_person_id
    from public.person_relationships pr
    where pr.tenant_id=p_tenant_id
      and pr.target_person_id=p_student_person_id
      and pr.is_primary=true
      and pr.status='verified'
    order by pr.updated_at desc
    limit 1;

    if v_guardian_person_id is null then
      insert into public.persons(tenant_id,display_name,preferred_locale,status,metadata)
      values(
        p_tenant_id,v_name,'en','active',
        jsonb_build_object('created_via','student_guardian_workspace')
      )
      returning id into v_guardian_person_id;

      insert into public.guardian_profiles(
        person_id,tenant_id,occupation,education,preferred_contact_type,portal_invitation_status
      ) values(
        v_guardian_person_id,p_tenant_id,v_occupation,v_education,
        case when v_phone is null then null else 'phone' end,'not_invited'
      );

      insert into public.person_relationships(
        tenant_id,source_person_id,target_person_id,relationship_type,status,
        is_primary,can_collect_student,portal_visibility,verified_at,verified_by_membership_id
      ) values(
        p_tenant_id,v_guardian_person_id,p_student_person_id,p_relationship,'verified',
        true,coalesce(p_can_collect,true),'standard',now(),v_membership_id
      )
      returning id into v_relationship_id;
    end if;
  end if;

  select jsonb_build_object(
    'guardian_person_id',v_guardian_person_id,
    'name',p.display_name,
    'relationship',pr.relationship_type,
    'can_collect',pr.can_collect_student,
    'occupation',gp.occupation,
    'education',gp.education
  )
  into v_before
  from public.persons p
  join public.person_relationships pr
    on pr.tenant_id=p.tenant_id
   and pr.id=v_relationship_id
  left join public.guardian_profiles gp
    on gp.tenant_id=p.tenant_id
   and gp.person_id=p.id
  where p.tenant_id=p_tenant_id
    and p.id=v_guardian_person_id;

  update public.persons
  set display_name=v_name,updated_at=now()
  where tenant_id=p_tenant_id
    and id=v_guardian_person_id;

  insert into public.guardian_profiles(
    person_id,tenant_id,occupation,education,preferred_contact_type,portal_invitation_status
  ) values(
    v_guardian_person_id,p_tenant_id,v_occupation,v_education,
    case when v_phone is null then null else 'phone' end,'not_invited'
  )
  on conflict (person_id) do update
  set occupation=excluded.occupation,
      education=excluded.education,
      preferred_contact_type=coalesce(
        excluded.preferred_contact_type,
        public.guardian_profiles.preferred_contact_type
      ),
      updated_at=now();

  update public.person_relationships
  set relationship_type=p_relationship,
      is_primary=true,
      can_collect_student=coalesce(p_can_collect,true),
      status='verified',
      portal_visibility='standard',
      verified_at=coalesce(verified_at,now()),
      verified_by_membership_id=coalesce(verified_by_membership_id,v_membership_id),
      updated_at=now()
  where tenant_id=p_tenant_id
    and id=v_relationship_id;

  if v_phone is not null then
    select pc.id into v_phone_contact_id
    from public.person_contacts pc
    where pc.tenant_id=p_tenant_id
      and pc.person_id=v_guardian_person_id
      and pc.type='phone'
    order by pc.is_primary desc,pc.updated_at desc
    limit 1;

    if v_phone_contact_id is null then
      insert into public.person_contacts(
        tenant_id,person_id,type,label,value,normalized_value,is_primary,visibility
      ) values(
        p_tenant_id,v_guardian_person_id,'phone','Primary',
        v_phone,regexp_replace(v_phone,'[^0-9+]','','g'),true,'staff'
      );
    else
      update public.person_contacts
      set value=v_phone,
          normalized_value=regexp_replace(v_phone,'[^0-9+]','','g'),
          is_primary=true,
          updated_at=now()
      where tenant_id=p_tenant_id
        and id=v_phone_contact_id;
    end if;
  end if;

  insert into public.audit_events(
    tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,
    entity_type,entity_id,correlation_id,before_state,after_state
  ) values(
    p_tenant_id,p_branch_id,p_identity_id,v_membership_id,
    'students.guardian.upsert','succeeded','student',
    p_student_person_id::text,v_correlation_id,v_before,
    jsonb_build_object(
      'guardian_person_id',v_guardian_person_id,
      'name',v_name,
      'relationship',p_relationship,
      'phone_recorded',v_phone is not null,
      'occupation',v_occupation,
      'education',v_education,
      'can_collect',coalesce(p_can_collect,true),
      'linked_existing_guardian',p_guardian_person_id is not null
    )
  );

  return jsonb_build_object(
    'updated',true,
    'guardian_person_id',v_guardian_person_id,
    'relationship_id',v_relationship_id
  );
end;
$function$;

revoke all on function public.upsert_student_primary_guardian_v2(
  uuid,bigint,bigint,bigint,text,text,text,text,text,boolean,bigint
) from public,anon,authenticated;
grant execute on function public.upsert_student_primary_guardian_v2(
  uuid,bigint,bigint,bigint,text,text,text,text,text,boolean,bigint
) to service_role;

create or replace function public.get_portal_access_center_v2(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','extensions'
as $$
declare
  v_membership bigint;
begin
  v_membership:=public.resolve_portal_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'portal administration permission denied';end if;

  return jsonb_build_object(
    'parents',coalesce((select jsonb_agg(to_jsonb(x) order by x.name,x.person_id) from (
      select distinct gp.person_id,p.display_name name,
        gp.portal_username portal_username,
        email.value email,
        case when a.identity_id is null then 'not_created' when a.link_status='verified' then 'active' else 'disabled' end account_status,
        a.last_sign_in_at last_login,
        coalesce(a.erp_managed,false) erp_managed,
        case when a.identity_id is null then null
             when lower(coalesce(a.email,'')) like '%@parents.ilmgaah.in' then 'username'
             else 'email' end login_method,
        coalesce(children.items,'[]'::jsonb) linked_scope,
        codes.last_code_at
      from public.guardian_profiles gp
      join public.persons p on p.tenant_id=gp.tenant_id and p.id=gp.person_id and p.status='active'
      join public.person_relationships pr on pr.tenant_id=gp.tenant_id and pr.source_person_id=gp.person_id and pr.status='verified' and pr.portal_visibility in('limited','standard')
      join public.enrollments e on e.tenant_id=pr.tenant_id and e.student_person_id=pr.target_person_id and e.branch_id=p_branch_id and e.status in('active','paused')
      left join lateral (
        select pc.value
        from public.person_contacts pc
        where pc.tenant_id=gp.tenant_id
          and pc.person_id=gp.person_id
          and pc.type='email'
        order by pc.is_primary desc,pc.is_verified desc,pc.id
        limit 1
      ) email on true
      left join lateral (
        select l.identity_id,l.status link_status,u.last_sign_in_at,u.email,
          coalesce((u.raw_app_meta_data->>'portal_account')::boolean,false) erp_managed
        from public.identity_person_links l
        join auth.users u on u.id=l.identity_id
        where l.tenant_id=gp.tenant_id
          and l.person_id=gp.person_id
          and l.link_type='guardian'
        order by (l.status='verified') desc,l.updated_at desc,l.id desc
        limit 1
      ) a on true
      left join lateral (
        select jsonb_agg(
          jsonb_build_object(
            'student_person_id',q.person_id,
            'student_number',q.student_number,
            'name',q.name,
            'father_name',q.father_name,
            'group_id',q.group_id,
            'group_labels',q.group_labels
          )
          order by q.name
        ) items
        from (
          select distinct
            sp.person_id,
            sp.student_number,
            cp.display_name name,
            father.display_name father_name,
            g.id group_id,
            g.labels group_labels
          from public.person_relationships pr2
          join public.student_profiles sp
            on sp.tenant_id=pr2.tenant_id
           and sp.person_id=pr2.target_person_id
           and sp.status in('active','admitted')
          join public.persons cp
            on cp.tenant_id=sp.tenant_id
           and cp.id=sp.person_id
          join public.enrollments e2
            on e2.tenant_id=sp.tenant_id
           and e2.student_person_id=sp.person_id
           and e2.branch_id=p_branch_id
           and e2.status in('active','paused')
          left join public.academic_groups g
            on g.tenant_id=e2.tenant_id
           and g.id=e2.group_id
          left join lateral (
            select fp.display_name
            from public.person_relationships fr
            join public.persons fp
              on fp.tenant_id=fr.tenant_id
             and fp.id=fr.source_person_id
            where fr.tenant_id=sp.tenant_id
              and fr.target_person_id=sp.person_id
              and fr.relationship_type='father'
              and fr.status='verified'
            order by fr.is_primary desc,fr.updated_at desc,fr.id desc
            limit 1
          ) father on true
          where pr2.tenant_id=gp.tenant_id
            and pr2.source_person_id=gp.person_id
            and pr2.status='verified'
            and pr2.portal_visibility in('limited','standard')
        ) q
      ) children on true
      left join lateral (
        select max(c.created_at) last_code_at
        from public.portal_access_codes c
        where c.tenant_id=gp.tenant_id
          and c.person_id=gp.person_id
          and c.link_type='guardian'
      ) codes on true
      where gp.tenant_id=p_tenant_id
    ) x),'[]'::jsonb),
    'teachers',coalesce((select jsonb_agg(to_jsonb(x) order by x.name,x.person_id) from (
      select he.employee_person_id person_id,p.display_name name,he.employee_number reference,
        email.value email,
        case when a.identity_id is null then case when email.value is null then 'email_required' else 'not_created' end when a.link_status='verified' then 'active' else 'disabled' end account_status,
        a.last_sign_in_at last_login,coalesce(a.erp_managed,false) erp_managed,
        coalesce(scope.items,'[]'::jsonb) linked_scope,codes.last_code_at
      from public.hr_employments he
      join public.persons p on p.tenant_id=he.tenant_id and p.id=he.employee_person_id and p.status='active'
      left join lateral (select pc.value from public.person_contacts pc where pc.tenant_id=he.tenant_id and pc.person_id=he.employee_person_id and pc.type='email' order by pc.is_primary desc,pc.is_verified desc,pc.id limit 1) email on true
      left join lateral (
        select l.identity_id,l.status link_status,u.last_sign_in_at,coalesce((u.raw_app_meta_data->>'portal_account')::boolean,false) erp_managed
        from public.identity_person_links l join auth.users u on u.id=l.identity_id
        where l.tenant_id=he.tenant_id and l.person_id=he.employee_person_id and l.link_type='employee'
        order by (l.status='verified') desc,l.updated_at desc,l.id desc limit 1
      ) a on true
      left join lateral (
        select jsonb_agg(jsonb_build_object('group_id',q.id,'group_labels',q.labels) order by q.id) items from (
          select distinct g.id,g.labels from public.academic_groups g where g.tenant_id=he.tenant_id and g.branch_id=he.branch_id and g.status='active' and g.primary_teacher_person_id=he.employee_person_id
          union
          select distinct g.id,g.labels from public.curriculum_teaching_assignments c join public.academic_groups g on g.tenant_id=c.tenant_id and g.id=c.group_id where c.tenant_id=he.tenant_id and c.teacher_person_id=he.employee_person_id and c.status='active' and c.group_id is not null
          union
          select distinct g.id,g.labels from public.timetable_entries te join public.academic_groups g on g.tenant_id=te.tenant_id and g.id=te.group_id where te.tenant_id=he.tenant_id and te.branch_id=p_branch_id and te.teacher_person_id=he.employee_person_id and te.status='active'
        ) q
      ) scope on true
      left join lateral (select max(c.created_at) last_code_at from public.portal_access_codes c where c.tenant_id=he.tenant_id and c.person_id=he.employee_person_id and c.link_type='employee') codes on true
      where he.tenant_id=p_tenant_id and he.branch_id=p_branch_id and he.state in('active','on_leave')
    ) x),'[]'::jsonb),
    'access_codes',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc) from (
      select c.id,c.person_id,c.link_type,c.state,c.expires_at,c.claimed_at,c.created_at,p.display_name name
      from public.portal_access_codes c join public.persons p on p.tenant_id=c.tenant_id and p.id=c.person_id
      where c.tenant_id=p_tenant_id and c.branch_id=p_branch_id order by c.created_at desc,c.id desc limit 50
    ) x),'[]'::jsonb),
    'notices',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc) from (
      select n.id,n.audience_type,n.labels,n.body,n.priority,n.state,n.published_at,n.expires_at,n.created_at
      from public.portal_notices n where n.tenant_id=p_tenant_id and (n.branch_id is null or n.branch_id=p_branch_id)
      order by n.created_at desc,n.id desc limit 30
    ) x),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_portal_access_center_v2(uuid,bigint,bigint)
  from public,anon,authenticated;
grant execute on function public.get_portal_access_center_v2(uuid,bigint,bigint)
  to service_role;
