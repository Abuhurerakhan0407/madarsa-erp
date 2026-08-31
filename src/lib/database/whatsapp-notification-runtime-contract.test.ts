import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql=readFileSync(resolve(process.cwd(),"supabase/migrations/20260831060000_whatsapp_notification_runtime.sql"),"utf8").toLowerCase();

describe("WhatsApp notification runtime contract",()=>{
 it("supports person recipients without requiring a portal identity",()=>{
  expect(sql).toContain("alter column recipient_identity_id drop not null");
  expect(sql).toContain("notification_recipient_subject_required");
  expect(sql).toContain("notification_recipient_person_event_unique");
 });
 it("requires explicit guardian opt-in before queueing",()=>{
  expect(sql).toContain("v_consent<>'opted_in'");
  expect(sql).toContain("whatsapp opt-in is not recorded");
  expect(sql).toContain("set_guardian_whatsapp_consent_v1");
 });
 it("blocks dispatches until provider configuration and provider template are ready",()=>{
  expect(sql).toContain("whatsapp provider is not fully configured");
  expect(sql).toContain("provider-approved whatsapp template reference is missing");
  expect(sql).toContain("else v_state:='queued'");
 });
 it("does not expose provider secret references from the operator center",()=>{
  expect(sql).toContain("to_jsonb(c) - 'encrypted_config_reference'");
  expect(sql).toContain("get_whatsapp_dispatch_handoff_v1");
 });
 it("keeps all WhatsApp RPCs service-role only",()=>{
  expect(sql).toContain("revoke all on function public.queue_guardian_whatsapp_v1");
  expect(sql).toContain("grant execute on function public.queue_guardian_whatsapp_v1");
  expect(sql).not.toContain("queue_guardian_whatsapp_v1(uuid,bigint,bigint,bigint,bigint,jsonb,text) to authenticated");
  expect(sql).not.toContain("get_whatsapp_dispatch_handoff_v1(bigint) to authenticated");
 });
 it("stores destination and rendered message only as digests in dispatches",()=>{
  expect(sql).toContain("destination_hash");
  expect(sql).toContain("rendered_digest");
  expect(sql).toContain("digest(coalesce(v_contact.normalized_value,v_contact.value),'sha256')");
 });
});
