import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function migration(name:string){return readFileSync(resolve(process.cwd(),"supabase/migrations",name),"utf8").toLowerCase();}
const foundation=migration("20260903100000_client_v2_phase6_notifications.sql");
const corrections=migration("20260903100100_client_v2_phase6_trigger_corrections.sql");
const hardening=migration("20260903102500_phase6_private_function_acl_hardening.sql");

describe("Phase 6 notification database contracts",()=>{
  it("adds explicit notice priorities and secure push subscription storage",()=>{
    expect(foundation).toContain("portal_notices_priority_check");
    expect(foundation).toContain("'normal','important','urgent'");
    expect(foundation).toContain("create table if not exists public.portal_push_subscriptions");
    expect(foundation).toContain("endpoint_hash text not null");
    expect(foundation).toContain("alter table public.portal_push_subscriptions enable row level security");
    expect(foundation).toContain("revoke all on public.portal_push_subscriptions from anon, authenticated");
    expect(foundation).toContain("grant select,insert,update,delete on public.portal_push_subscriptions to service_role");
  });

  it("keeps absence and late notifications disabled until explicitly enabled",()=>{
    expect(foundation).toContain("absence_late_enabled boolean not null default false");
    expect(foundation).toContain("if not coalesce(v_enabled,false) then return new;end if");
  });

  it("deduplicates domain events and per-recipient in-app dispatches",()=>{
    expect(foundation).toContain("v_event_idempotency:='client-v2:'");
    expect(foundation).toContain("on conflict(tenant_id,idempotency_key) do update");
    expect(foundation).toContain("v_dispatch_idempotency:='client-v2:in-app:'");
    expect(foundation).toContain("on conflict(tenant_id,idempotency_key) do nothing");
  });

  it("resolves only verified portal identities and protects read state by recipient",()=>{
    expect(foundation).toContain("l.status='verified'");
    expect(foundation).toContain("r.recipient_identity_id=p_identity_id");
    expect(foundation).toContain("verified portal link required");
  });

  it("installs every Client V2 trigger required by the master handoff",()=>{
    for(const trigger of [
      "client_v2_homework_notification",
      "client_v2_calendar_notification",
      "client_v2_schedule_exception_notification",
      "client_v2_result_publication_notification",
      "client_v2_portal_notice_notification",
      "client_v2_attendance_notification"
    ]) expect(foundation).toContain(`create trigger ${trigger}`);
    expect(foundation).toContain("academics.homework.published");
    expect(foundation).toContain("academics.holiday.created");
    expect(foundation).toContain("academics.event.created");
    expect(foundation).toContain("academics.schedule.changed");
    expect(foundation).toContain("assessment.results.published");
    expect(foundation).toContain("portal.notice.published");
    expect(foundation).toContain("'attendance.'||new.status_category");
  });

  it("aligns result and attendance triggers with their canonical source schemas",()=>{
    expect(corrections).toContain("s.state in('approved','published')");
    expect(corrections).toContain("from public.attendance_sessions a");
    expect(corrections).toContain("a.id=new.attendance_session_id");
    expect(corrections).toContain("'attendance_date',v_attendance_date");
    expect(corrections).toContain("'branch_id',v_branch_id");
  });

  it("keeps all new public notification RPCs service-role-only",()=>{
    for(const rpc of [
      "get_portal_notification_center_v1(uuid,bigint,integer)",
      "mark_portal_notification_read_v1(uuid,bigint,bigint)",
      "upsert_portal_push_subscription_v1(uuid,bigint,jsonb,text)",
      "revoke_portal_push_subscription_v1(uuid,bigint,text)",
      "publish_portal_notice_v2(uuid,bigint,bigint,text,jsonb,jsonb,text,timestamptz)"
    ]){
      expect(foundation).toContain(`revoke all on function public.${rpc} from public,anon,authenticated`);
      expect(foundation).toContain(`grant execute on function public.${rpc} to service_role`);
    }
  });

  it("revokes browser execution from every Phase 6 private definer helper",()=>{
    for(const rpc of [
      "emit_client_v2_in_app_v1(bigint,text,text,text,jsonb,uuid[])",
      "client_v2_guardian_identities_for_students_v1(bigint,bigint[])",
      "client_v2_homework_notification_trigger_v1()",
      "client_v2_calendar_notification_trigger_v1()",
      "client_v2_schedule_exception_notification_trigger_v1()",
      "client_v2_result_publication_notification_trigger_v1()",
      "client_v2_portal_notice_notification_trigger_v1()",
      "client_v2_attendance_notification_trigger_v1()"
    ]){
      expect(hardening).toContain(`revoke all on function private.${rpc} from public, anon, authenticated`);
    }
    expect(hardening).not.toContain("grant execute on function private.");
  });
});
