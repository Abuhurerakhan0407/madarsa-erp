-- Private tenant document policies only; no custom storage schema objects.
-- Apply after phase2_tenancy.sql and after creating a private tenant-documents bucket.

create or replace function private.storage_tenant_id(p_object_name text)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case
    when p_object_name ~ '^[0-9]+/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[^/]+$'
      then split_part(p_object_name, '/', 1)::bigint
    else null
  end;
$$;

revoke all on function private.storage_tenant_id(text) from public, anon;
grant execute on function private.storage_tenant_id(text) to authenticated;

drop policy if exists tenant_documents_select on storage.objects;
create policy tenant_documents_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tenant-documents'
    and (
      (select private.has_permission(
        (select private.storage_tenant_id(name)),
        'documents.file.read'
      ))
      or (select private.has_permission(
        (select private.storage_tenant_id(name)),
        'documents.file.manage'
      ))
    )
  );

drop policy if exists tenant_documents_insert on storage.objects;
create policy tenant_documents_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tenant-documents'
    and (select private.has_permission(
      (select private.storage_tenant_id(name)),
      'documents.file.manage'
    ))
  );

drop policy if exists tenant_documents_update on storage.objects;
create policy tenant_documents_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'tenant-documents'
    and (select private.has_permission(
      (select private.storage_tenant_id(name)),
      'documents.file.manage'
    ))
  )
  with check (
    bucket_id = 'tenant-documents'
    and (select private.has_permission(
      (select private.storage_tenant_id(name)),
      'documents.file.manage'
    ))
  );

drop policy if exists tenant_documents_delete on storage.objects;
create policy tenant_documents_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'tenant-documents'
    and (select private.has_permission(
      (select private.storage_tenant_id(name)),
      'documents.file.manage'
    ))
  );
