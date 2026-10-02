-- Ilmgaah commercial scope: WhatsApp is retired and must not be exposed or executable.
-- Keep historical notification/audit records intact, but disable active WhatsApp
-- configuration/templates and remove all WhatsApp-specific RPC entrypoints.

do $$
begin
  if to_regclass('public.notification_channel_configs') is not null then
    update public.notification_channel_configs
    set state = 'inactive'
    where channel = 'whatsapp';
  end if;

  if to_regclass('public.notification_templates') is not null then
    update public.notification_templates
    set state = 'archived'
    where channel = 'whatsapp'
      and state <> 'archived';
  end if;
end
$$;

drop function if exists public.get_whatsapp_center_v1(uuid,bigint,bigint);
drop function if exists public.configure_whatsapp_channel_v1(uuid,bigint,bigint,text,text,text,text);
drop function if exists public.upsert_guardian_whatsapp_template_v1(uuid,bigint,bigint,text,text,text,text[]);
drop function if exists public.set_guardian_whatsapp_consent_v1(uuid,bigint,bigint,bigint,text,text,text);
drop function if exists public.queue_guardian_whatsapp_v1(uuid,bigint,bigint,bigint,bigint,jsonb,text);
drop function if exists public.get_whatsapp_dispatch_handoff_v1(bigint);
drop function if exists public.record_whatsapp_dispatch_result_v1(bigint,text,text,jsonb);
drop function if exists public.record_whatsapp_delivery_event_v1(bigint,text,text,boolean,text,timestamptz);
