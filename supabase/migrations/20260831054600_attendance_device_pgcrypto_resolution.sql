alter function public.create_attendance_device_v1(uuid,bigint,bigint,text,text,text,text,text)
  set search_path to pg_catalog, extensions;

alter function public.rotate_attendance_device_token_v1(uuid,bigint,bigint,bigint)
  set search_path to pg_catalog, extensions;

alter function public.receive_attendance_device_event_v1(text,text,text,text,text,text,timestamptz,jsonb)
  set search_path to pg_catalog, extensions;
