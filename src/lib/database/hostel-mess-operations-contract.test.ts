import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,expect,it } from "vitest";

const sql=readFileSync(resolve(process.cwd(),"supabase/migrations/20260831083000_hostel_mess_operations_runtime.sql"),"utf8").toLowerCase();

describe("hostel and mess operations runtime",()=>{
 it("reuses the existing foundation schema",()=>{
  expect(sql).not.toContain("create table public.hostels");
  expect(sql).not.toContain("create table public.hostel_beds");
  expect(sql).not.toContain("create table public.mess_units");
  expect(sql).toContain("public.hostel_allocations");
  expect(sql).toContain("public.mess_meal_services");
 });
 it("separates resident, security and mess permissions",()=>{
  expect(sql).toContain("hostel.resident.manage");
  expect(sql).toContain("hostel.security.manage");
  expect(sql).toContain("mess.service.manage");
  expect(sql).toContain("join public.roles r");
  expect(sql).toContain("r.status='active'");
  expect(sql).toContain("membership_branch_scopes");
 });
 it("serializes bed allocation and prevents overlapping residents",()=>{
  expect(sql).toContain("for update of b");
  expect(sql).toContain("hostel bed is not available");
  expect(sql).toContain("student already has an overlapping hostel allocation");
  expect(sql).toContain("update public.hostel_beds set state='occupied'");
  expect(sql).toContain("update public.hostel_beds set state='available'");
 });
 it("keeps visitor and incident operations behind hostel security permission",()=>{
  expect(sql).toContain("check_in_hostel_visitor_v1");
  expect(sql).toContain("check_out_hostel_visitor_v1");
  expect(sql).toContain("record_hostel_incident_v1");
  expect(sql).toContain("hostel security permission denied");
  expect(sql).toContain("restricted incident details must be a json object");
 });
 it("keeps mess attendance idempotent and eligibility scoped",()=>{
  expect(sql).toContain("valid mess attendance request key required");
  expect(sql).toContain("idempotency_key=p_request_key");
  expect(sql).toContain("person is not eligible for this branch mess service");
  expect(sql).toContain("active_hostel_residents_or_branch_staff");
 });
 it("does not fabricate deferred fee or subsidy accounting",()=>{
  expect(sql).toContain("fee_item_id,state");
  expect(sql).toContain("null,'available'");
  expect(sql).toContain("cost_account_id,state");
  expect(sql).toContain("null,'active'");
  expect(sql).toContain("subsidy_fund_id,idempotency_key");
  expect(sql).toContain("p_served_count,null,p_request_key");
  expect(sql).not.toContain("insert into public.fee_");
  expect(sql).not.toContain("insert into public.ledger_");
 });
 it("keeps every runtime function service-role only",()=>{
  expect(sql).toContain("revoke all on function public.get_hostel_mess_center_v1");
  expect(sql).toContain("revoke all on function public.allocate_hostel_bed_v1");
  expect(sql).toContain("revoke all on function public.record_mess_attendance_v1");
  expect(sql).not.toContain("to authenticated;");
  expect(sql).toContain("to service_role;");
  expect(sql).toContain("set search_path to pg_catalog,extensions");
 });
});
