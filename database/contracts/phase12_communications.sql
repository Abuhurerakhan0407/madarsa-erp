-- Phase 12 executable database contract: documents, notifications, messaging, imports, and reports.

insert into public.permissions (code, description) values
  ('document.template.manage', 'Manage document templates'),
  ('document.job.manage', 'Generate and issue documents'),
  ('notification.policy.manage', 'Manage notification policies and templates'),
  ('notification.message.send', 'Send scoped external notifications'),
  ('notification.usage.read', 'Read communication usage and cost'),
  ('data.import.manage', 'Run validated data imports'),
  ('data.export.manage', 'Run scoped exports'),
  ('report.definition.manage', 'Manage report definitions'),
  ('report.run.execute', 'Execute scoped reports')
on conflict (code) do nothing;

create table public.document_templates (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null, document_type text not null,
  labels jsonb not null, state text not null default 'active' check (state in ('active','inactive','archived')),
  unique (tenant_id, id), unique (tenant_id, key)
);

create table public.document_template_versions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  template_id bigint not null, version integer not null check (version > 0),
  locale text not null, direction text not null check (direction in ('ltr','rtl')),
  renderer text not null check (renderer in ('html_pdf','html_image','zpl','json')),
  source text not null, variables jsonb not null, font_manifest jsonb not null,
  layout_rules jsonb not null default '{}'::jsonb,
  state text not null default 'draft' check (state in ('draft','validated','published','superseded','archived')),
  validation_result jsonb not null default '{}'::jsonb, published_at timestamptz,
  unique (tenant_id, id), unique (tenant_id, template_id, version, locale),
  foreign key (tenant_id, template_id) references public.document_templates(tenant_id, id) on delete cascade,
  constraint document_template_publish_check check (state <> 'published' or published_at is not null)
);

create table public.document_generation_jobs (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint, template_version_id bigint not null, job_type text not null check (job_type in ('single','bulk')),
  requested_by_membership_id bigint not null, input_digest text not null check (length(input_digest) between 32 and 128),
  input_reference jsonb not null, state text not null default 'queued' check (state in ('queued','running','completed','partial','failed','cancelled')),
  total_items integer not null default 1 check (total_items > 0), completed_items integer not null default 0 check (completed_items >= 0),
  error_summary jsonb not null default '{}'::jsonb, idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz,
  unique (tenant_id, id), unique (tenant_id, idempotency_key),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, template_version_id) references public.document_template_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, requested_by_membership_id) references public.memberships(tenant_id, id) on delete restrict
);

create table public.issued_document_records (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  generation_job_id bigint not null, template_version_id bigint not null, document_id bigint not null,
  subject_type text not null, subject_id text not null, revision integer not null default 1 check (revision > 0),
  verification_code text not null unique, content_digest text not null check (length(content_digest) between 32 and 128),
  state text not null default 'active' check (state in ('active','superseded','revoked','void')),
  issued_at timestamptz not null default now(), state_reason text,
  unique (tenant_id, id), unique (tenant_id, subject_type, subject_id, revision),
  foreign key (tenant_id, generation_job_id) references public.document_generation_jobs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, template_version_id) references public.document_template_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, document_id) references public.documents(tenant_id, id) on delete restrict,
  constraint issued_document_state_reason_check check (state = 'active' or length(btrim(state_reason)) >= 4)
);

create table public.notification_channel_configs (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  channel text not null check (channel in ('in_app','email','whatsapp')),
  provider text not null, sender_reference text, encrypted_config_reference text,
  monthly_allowance bigint not null default 0 check (monthly_allowance >= 0), prepaid_units bigint not null default 0 check (prepaid_units >= 0),
  state text not null default 'inactive' check (state in ('active','inactive','suspended','archived')),
  unique (tenant_id, id), unique (tenant_id, channel)
);

create table public.notification_policies (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  event_key text not null, version integer not null check (version > 0),
  channels text[] not null, audience_rules jsonb not null, consent_basis jsonb not null,
  quiet_hours jsonb not null default '{}'::jsonb, retry_policy jsonb not null default '{}'::jsonb,
  state text not null default 'draft' check (state in ('draft','published','superseded','archived')),
  published_at timestamptz, unique (tenant_id, id), unique (tenant_id, event_key, version),
  constraint notification_policy_publish_check check (state <> 'published' or published_at is not null)
);

create table public.notification_templates (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  policy_id bigint not null, channel text not null check (channel in ('in_app','email','whatsapp')),
  locale text not null, provider_template_reference text, category text,
  subject_template text, body_template text not null, required_variables text[] not null default array[]::text[],
  state text not null default 'draft' check (state in ('draft','validated','published','rejected','archived')),
  validation_result jsonb not null default '{}'::jsonb, published_at timestamptz,
  unique (tenant_id, id), unique (tenant_id, policy_id, channel, locale),
  foreign key (tenant_id, policy_id) references public.notification_policies(tenant_id, id) on delete cascade,
  constraint notification_template_publish_check check (state <> 'published' or published_at is not null)
);

create table public.domain_notification_events (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  event_key text not null, aggregate_type text not null, aggregate_id text not null,
  payload jsonb not null, payload_digest text not null check (length(payload_digest) between 32 and 128),
  occurred_at timestamptz not null, idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  created_at timestamptz not null default now(), unique (tenant_id, id), unique (tenant_id, idempotency_key)
);

create table public.notification_recipient_resolutions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  event_id bigint not null, recipient_identity_id uuid not null, related_person_id bigint,
  relationship_evidence jsonb not null, locale text not null, channels text[] not null,
  consent_snapshot jsonb not null, resolved_at timestamptz not null default now(),
  unique (tenant_id, id), unique (tenant_id, event_id, recipient_identity_id),
  foreign key (tenant_id, event_id) references public.domain_notification_events(tenant_id, id) on delete cascade,
  foreign key (tenant_id, related_person_id) references public.persons(tenant_id, id) on delete restrict
);

create table public.notification_dispatches (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  event_id bigint not null, recipient_resolution_id bigint not null, template_id bigint not null,
  channel text not null check (channel in ('in_app','email','whatsapp')),
  destination_hash text not null, tokenized_link_reference text,
  rendered_digest text not null check (length(rendered_digest) between 32 and 128),
  provider_message_id text, usage_units numeric(18,4) not null default 0 check (usage_units >= 0),
  estimated_cost numeric(18,4) not null default 0 check (estimated_cost >= 0), currency_code text,
  state text not null default 'queued' check (state in ('queued','sending','sent','delivered','read','failed','blocked','opted_out','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0), last_error jsonb,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  created_at timestamptz not null default now(), sent_at timestamptz,
  unique (tenant_id, id), unique (tenant_id, idempotency_key),
  foreign key (tenant_id, event_id) references public.domain_notification_events(tenant_id, id) on delete restrict,
  foreign key (tenant_id, recipient_resolution_id) references public.notification_recipient_resolutions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, template_id) references public.notification_templates(tenant_id, id) on delete restrict
);
create unique index notification_provider_message_idx on public.notification_dispatches (tenant_id, channel, provider_message_id) where provider_message_id is not null;

create table public.notification_delivery_events (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  dispatch_id bigint not null, provider_event_id text, state text not null,
  signature_verified boolean not null default false, payload_digest text not null check (length(payload_digest) between 32 and 128),
  occurred_at timestamptz not null, received_at timestamptz not null default now(),
  foreign key (tenant_id, dispatch_id) references public.notification_dispatches(tenant_id, id) on delete restrict
);
create unique index notification_delivery_provider_idx on public.notification_delivery_events (tenant_id, provider_event_id) where provider_event_id is not null;

create table public.bulk_message_campaigns (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  policy_id bigint not null, labels jsonb not null, audience_query jsonb not null,
  audience_count integer not null default 0 check (audience_count >= 0), exclusion_count integer not null default 0 check (exclusion_count >= 0),
  estimated_units numeric(18,4) not null default 0, estimated_cost numeric(18,4) not null default 0,
  throttle_per_minute integer not null default 30 check (throttle_per_minute > 0),
  state text not null default 'draft' check (state in ('draft','previewed','approved','queued','sending','completed','partial','cancelled')),
  approved_by_membership_id bigint, approved_at timestamptz, created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, policy_id) references public.notification_policies(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint bulk_campaign_approval_check check (state not in ('approved','queued','sending','completed','partial') or (approved_by_membership_id is not null and approved_at is not null))
);

create table public.communication_usage_daily (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  usage_date date not null, channel text not null, category text not null,
  units numeric(18,4) not null default 0, cost numeric(18,4) not null default 0, currency_code text,
  event_count bigint not null default 0, source_digest text not null,
  unique (tenant_id, usage_date, channel, category)
);

create table public.data_import_jobs (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  import_type text not null, source_document_id bigint not null, mapping_version jsonb not null,
  mode text not null check (mode in ('validate','commit')), state text not null default 'queued' check (state in ('queued','validating','validated','committing','completed','partial','failed','cancelled')),
  total_rows integer not null default 0, valid_rows integer not null default 0, invalid_rows integer not null default 0,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128), requested_by_membership_id bigint not null,
  created_at timestamptz not null default now(), unique (tenant_id, id), unique (tenant_id, idempotency_key),
  foreign key (tenant_id, source_document_id) references public.documents(tenant_id, id) on delete restrict,
  foreign key (tenant_id, requested_by_membership_id) references public.memberships(tenant_id, id) on delete restrict
);

create table public.data_import_rows (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  import_job_id bigint not null, row_number integer not null check (row_number > 0),
  source_data jsonb not null, normalized_data jsonb, validation_errors jsonb not null default '[]'::jsonb,
  commit_reference jsonb, state text not null check (state in ('valid','invalid','committed','skipped','failed')),
  unique (tenant_id, import_job_id, row_number),
  foreign key (tenant_id, import_job_id) references public.data_import_jobs(tenant_id, id) on delete cascade
);

create table public.report_definitions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null, labels jsonb not null, version integer not null check (version > 0),
  domain text not null, parameter_schema jsonb not null, query_reference text not null,
  allowed_columns text[] not null, scope_rules jsonb not null,
  state text not null default 'draft' check (state in ('draft','published','superseded','archived')),
  unique (tenant_id, id), unique (tenant_id, key, version)
);

create table public.report_runs (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  report_definition_id bigint not null, parameters jsonb not null, scope_snapshot jsonb not null,
  output_format text not null check (output_format in ('screen','csv','xlsx','pdf','json')),
  state text not null default 'queued' check (state in ('queued','running','completed','failed','expired','cancelled')),
  row_count bigint, output_document_id bigint, output_digest text,
  requested_by_membership_id bigint not null, idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  created_at timestamptz not null default now(), completed_at timestamptz,
  unique (tenant_id, id), unique (tenant_id, idempotency_key),
  foreign key (tenant_id, report_definition_id) references public.report_definitions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, output_document_id) references public.documents(tenant_id, id) on delete restrict,
  foreign key (tenant_id, requested_by_membership_id) references public.memberships(tenant_id, id) on delete restrict
);

create index dispatches_state_idx on public.notification_dispatches (tenant_id, state, created_at);
create index domain_events_aggregate_idx on public.domain_notification_events (tenant_id, aggregate_type, aggregate_id, occurred_at desc);
create index import_rows_state_idx on public.data_import_rows (tenant_id, import_job_id, state);
create index report_runs_requester_idx on public.report_runs (tenant_id, requested_by_membership_id, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'document_templates','document_template_versions','document_generation_jobs','issued_document_records',
    'notification_channel_configs','notification_policies','notification_templates','domain_notification_events',
    'notification_recipient_resolutions','notification_dispatches','notification_delivery_events',
    'bulk_message_campaigns','communication_usage_daily','data_import_jobs','data_import_rows',
    'report_definitions','report_runs'
  ] loop
    execute format('create trigger %I before update of tenant_id on public.%I for each row execute function private.enforce_immutable_tenant_id()', table_name || '_immutable_tenant', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

create trigger domain_notification_events_append_only before update or delete on public.domain_notification_events for each row execute function private.reject_append_only_mutation();
create trigger recipient_resolutions_append_only before update or delete on public.notification_recipient_resolutions for each row execute function private.reject_append_only_mutation();
create trigger notification_delivery_events_append_only before update or delete on public.notification_delivery_events for each row execute function private.reject_append_only_mutation();
create trigger communication_usage_append_only before update or delete on public.communication_usage_daily for each row execute function private.reject_append_only_mutation();

grant select on table
  public.document_templates, public.document_template_versions, public.document_generation_jobs,
  public.issued_document_records, public.notification_channel_configs, public.notification_policies,
  public.notification_templates, public.domain_notification_events, public.notification_recipient_resolutions,
  public.notification_dispatches, public.notification_delivery_events, public.bulk_message_campaigns,
  public.communication_usage_daily, public.data_import_jobs, public.data_import_rows,
  public.report_definitions, public.report_runs
to authenticated;

create policy document_templates_staff_read on public.document_templates for select to authenticated using (private.has_permission(tenant_id, 'document.template.manage', null));
create policy document_versions_staff_read on public.document_template_versions for select to authenticated using (private.has_permission(tenant_id, 'document.template.manage', null));
create policy document_jobs_staff_read on public.document_generation_jobs for select to authenticated using (private.has_permission(tenant_id, 'document.job.manage', branch_id));
create policy issued_documents_staff_read on public.issued_document_records for select to authenticated using (private.has_permission(tenant_id, 'document.job.manage', null));
create policy channel_configs_staff_read on public.notification_channel_configs for select to authenticated using (private.has_permission(tenant_id, 'notification.policy.manage', null));
create policy notification_policies_staff_read on public.notification_policies for select to authenticated using (private.has_permission(tenant_id, 'notification.policy.manage', null));
create policy notification_templates_staff_read on public.notification_templates for select to authenticated using (private.has_permission(tenant_id, 'notification.policy.manage', null));
create policy notification_events_staff_read on public.domain_notification_events for select to authenticated using (private.has_permission(tenant_id, 'notification.message.send', null));
create policy recipient_resolutions_staff_read on public.notification_recipient_resolutions for select to authenticated using (private.has_permission(tenant_id, 'notification.message.send', null));
create policy notification_dispatches_staff_read on public.notification_dispatches for select to authenticated using (private.has_permission(tenant_id, 'notification.message.send', null));
create policy delivery_events_staff_read on public.notification_delivery_events for select to authenticated using (private.has_permission(tenant_id, 'notification.message.send', null));
create policy bulk_campaigns_staff_read on public.bulk_message_campaigns for select to authenticated using (private.has_permission(tenant_id, 'notification.message.send', null));
create policy communication_usage_staff_read on public.communication_usage_daily for select to authenticated using (private.has_permission(tenant_id, 'notification.usage.read', null));
create policy import_jobs_staff_read on public.data_import_jobs for select to authenticated using (private.has_permission(tenant_id, 'data.import.manage', null));
create policy import_rows_staff_read on public.data_import_rows for select to authenticated using (private.has_permission(tenant_id, 'data.import.manage', null));
create policy report_definitions_staff_read on public.report_definitions for select to authenticated using (private.has_permission(tenant_id, 'report.definition.manage', null));
create policy report_runs_staff_read on public.report_runs for select to authenticated using (private.has_permission(tenant_id, 'report.run.execute', null));
