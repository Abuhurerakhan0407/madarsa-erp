import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,expect,it } from "vitest";

const sql=readFileSync(resolve(process.cwd(),"supabase/migrations/20260831080000_transport_operations_runtime.sql"),"utf8").toLowerCase();

describe("transport operations runtime contract",()=>{
 it("reuses the existing phase transport schema",()=>{
  expect(sql).not.toContain("create table public.transport_vehicles");
  expect(sql).not.toContain("create table public.transport_routes");
  expect(sql).not.toContain("create table public.transport_stops");
  expect(sql).not.toContain("create table public.transport_assignments");
  expect(sql).toContain("public.transport_vehicles");
  expect(sql).toContain("public.transport_assignments");
 });
 it("enforces active-role branch-scoped transport permission",()=>{
  expect(sql).toContain("transport.route.manage");
  expect(sql).toContain("membership_branch_scopes");
  expect(sql).toContain("join public.roles r");
  expect(sql).toContain("r.status='active'");
 });
 it("never fabricates transport fee assignments",()=>{
  expect(sql).toContain("fee_assignment_id,approved_by_membership_id");
  expect(sql).toContain("v_state,null,v_membership");
  expect(sql).toContain("'fee_assignment_id',null");
 });
 it("serializes capacity checks and prevents overlapping student assignments",()=>{
  expect(sql).toContain("student already has an overlapping transport assignment");
  expect(sql).toContain("pg_advisory_xact_lock");
  expect(sql).toContain("route vehicle capacity reached");
  expect(sql).toContain("daterange(");
 });
 it("requires stops to belong to the selected active route",()=>{
  expect(sql).toContain("stop must belong to the selected route");
  expect(sql).toContain("active route in this branch required");
  expect(sql).toContain("stop sequence is already used on this route");
 });
 it("records audited vehicle, route, stop and assignment mutations",()=>{
  expect(sql).toContain("'transport.vehicle.create'");
  expect(sql).toContain("'transport.route.create'");
  expect(sql).toContain("'transport.stop.create'");
  expect(sql).toContain("'transport.assignment.create'");
  expect(sql).toContain("'transport.assignment.end'");
  expect(sql).toContain("public.audit_events");
 });
 it("keeps transport functions service-role only",()=>{
  expect(sql).toContain("revoke all on function public.get_transport_center_v1");
  expect(sql).toContain("grant execute on function public.get_transport_center_v1");
  expect(sql).not.toContain("to authenticated;");
  expect(sql).toContain("set search_path to pg_catalog,extensions");
 });
});
