import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,expect,it } from "vitest";

const sql=readFileSync(resolve(process.cwd(),"supabase/migrations/20260831083500_hostel_mess_operations_hardening.sql"),"utf8").toLowerCase();

describe("hostel resident hardening",()=>{
 it("normalizes and validates structural bed keys",()=>{
  expect(sql).toContain("v_building text:=lower");
  expect(sql).toContain("valid building, room and bed keys required");
  expect(sql).toContain("valid floor key required");
 });
 it("blocks a second open hostel allocation for one student",()=>{
  expect(sql).toContain("student already has an open hostel allocation");
  expect(sql).toContain("a.state in('allocated','occupied','temporary_leave')");
 });
 it("keeps deferred financial clearance explicit",()=>{
  expect(sql).toContain("'financial_clearance','deferred'");
  expect(sql).toContain("'fee_assignment_id',null");
  expect(sql).not.toContain("insert into public.fee_");
 });
 it("keeps hardened functions service-role only",()=>{
  expect(sql).toContain("revoke all on function public.add_hostel_bed_v1");
  expect(sql).toContain("revoke all on function public.allocate_hostel_bed_v1");
  expect(sql).toContain("revoke all on function public.vacate_hostel_allocation_v1");
  expect(sql).not.toContain("to authenticated;");
 });
});
