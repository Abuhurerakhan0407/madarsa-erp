begin;

create table if not exists public.academic_attachment_uploads (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  token_digest text not null unique,
  kind text not null,
  storage_path text not null unique,
  content_type text not null,
  size_bytes bigint not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  entity_type text,
  entity_id bigint,
  created_at timestamptz not null default now(),
  constraint academic_attachment_uploads_digest_check check (token_digest ~ '^[a-f0-9]{64}$'),
  constraint academic_attachment_uploads_kind_check check (kind in ('homework','calendar')),
  constraint academic_attachment_uploads_content_type_check check (content_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  constraint academic_attachment_uploads_size_check check (size_bytes between 1 and 8388608),
  constraint academic_attachment_uploads_entity_check check ((consumed_at is null and entity_type is null and entity_id is null) or (consumed_at is not null and entity_type in ('homework_assignment','academic_calendar_event') and entity_id is not null)),
  constraint academic_attachment_uploads_path_check check (storage_path ~ '^[0-9]+/academics/(homework|calendar)/[a-f0-9]{24,64}\.[a-z0-9]{2,8}$')
);

create index if not exists academic_attachment_uploads_expiry_idx on public.academic_attachment_uploads(expires_at) where consumed_at is null;
create index if not exists academic_attachment_uploads_entity_idx on public.academic_attachment_uploads(tenant_id,entity_type,entity_id) where consumed_at is not null;

alter table public.academic_attachment_uploads enable row level security;
alter table public.academic_attachment_uploads force row level security;
revoke all on public.academic_attachment_uploads from public,anon,authenticated;
grant select,insert,update,delete on public.academic_attachment_uploads to service_role;
grant usage,select on sequence public.academic_attachment_uploads_id_seq to service_role;

create or replace function public.mutate_academics_timetable_v2(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_action text,
  p_payload jsonb,
  p_attachment_token_digest text default null
)
returns jsonb
language plpgsql
set search_path=''
as $$
declare
  v_action text:=lower(btrim(coalesce(p_action,'')));
  v_kind text;
  v_storage_path text;
  v_result jsonb;
  v_entity_id bigint;
begin
  if p_attachment_token_digest is null then
    return public.mutate_academics_timetable_v1(p_identity_id,p_tenant_id,p_branch_id,v_action,p_payload);
  end if;
  if p_attachment_token_digest !~ '^[a-f0-9]{64}$' then raise exception 'Academic attachment token is invalid'; end if;
  v_kind:=case when v_action='create_homework' then 'homework' when v_action='create_calendar_event' then 'calendar' else null end;
  if v_kind is null then raise exception 'Academic attachment is not supported for this action'; end if;

  select a.storage_path into v_storage_path
  from public.academic_attachment_uploads a
  where a.tenant_id=p_tenant_id and a.kind=v_kind and a.token_digest=p_attachment_token_digest
    and a.consumed_at is null and a.expires_at>now()
  for update;
  if v_storage_path is null then raise exception 'Academic attachment token is expired or invalid'; end if;

  v_result:=public.mutate_academics_timetable_v1(
    p_identity_id,p_tenant_id,p_branch_id,v_action,
    p_payload||jsonb_build_object('attachmentStoragePath',v_storage_path)
  );
  v_entity_id:=nullif(v_result->>'id','')::bigint;
  if v_entity_id is null then raise exception 'Academic attachment could not be bound to its record'; end if;

  update public.academic_attachment_uploads set
    consumed_at=clock_timestamp(),
    entity_type=case when v_kind='homework' then 'homework_assignment' else 'academic_calendar_event' end,
    entity_id=v_entity_id
  where tenant_id=p_tenant_id and token_digest=p_attachment_token_digest and consumed_at is null;
  if not found then raise exception 'Academic attachment token could not be consumed'; end if;
  return v_result||jsonb_build_object('attachment_bound',true);
end;
$$;

revoke all on function public.mutate_academics_timetable_v2(uuid,bigint,bigint,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.mutate_academics_timetable_v2(uuid,bigint,bigint,text,jsonb,text) to service_role;

commit;
