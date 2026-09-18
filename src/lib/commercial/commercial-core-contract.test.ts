import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const root=(path:string)=>readFileSync(new URL(`../../../${path}`,import.meta.url),'utf8');
const fees=root('supabase/migrations/20260917200000_minimal_fees_runtime.sql')+root('supabase/migrations/20260917200001_minimal_fees_integrity_hardening.sql');
const contributions=root('supabase/migrations/20260917201000_minimal_contributions_runtime.sql');
const payroll=root('supabase/migrations/20260917202000_minimal_payroll_runtime.sql')+root('supabase/migrations/20260917202001_minimal_payroll_integrity_hardening.sql');
const retiredRuntime=root('supabase/migrations/20260918100000_retire_whatsapp_runtime.sql');
const nav=root('src/lib/navigation/client-v3-navigation.ts');
const assistant=root('src/lib/assistant/operational.ts');
const capability=root('src/lib/capabilities/client-profile.ts');

describe('locked commercial-core scope',()=>{
 it('removes retired modules from navigation and capability definitions while keeping required modules',()=>{
  for(const value of ['hostel','transport','library','whatsapp','student portal'])expect(nav.toLowerCase()).not.toContain(value);
  for(const capabilityName of ['"hostel_mess"','"transport"','"library"','"whatsapp_automation"','"internal_demo_suite"'])expect(capability).not.toContain(capabilityName);
  for(const key of ['fees','contributions','payroll','portals','access','assistant'])expect(nav).toContain(`item("${key}"`);
 });

 it('retires WhatsApp runtime without deleting generic notification history tables',()=>{
  for(const fn of ['get_whatsapp_center_v1','configure_whatsapp_channel_v1','upsert_guardian_whatsapp_template_v1','set_guardian_whatsapp_consent_v1','queue_guardian_whatsapp_v1','get_whatsapp_dispatch_handoff_v1','record_whatsapp_dispatch_result_v1','record_whatsapp_delivery_event_v1'])
    expect(retiredRuntime).toContain(`drop function if exists public.${fn}`);
  expect(retiredRuntime).toContain("set state = 'inactive'");
  expect(retiredRuntime).toContain("set state = 'archived'");
  expect(retiredRuntime).not.toMatch(/drop table/i);
 });

 it('keeps browser writes closed for new money modules',()=>{
  for(const sql of [fees,contributions,payroll]){
   expect(sql).toMatch(/force row level security/i);
   expect(sql).toMatch(/revoke all on/i);
   expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)\s+on\s+(?:table\s+)?public\.minimal_/i);
  }
 });

 it('makes fee collection branch-scoped and prevents overpayment or over-concession',()=>{
  expect(fees).toContain("e.branch_id=p_branch_id");
  expect(fees).toContain("payment exceeds outstanding amount");
  expect(fees).toContain("concession cannot exceed unpaid fee amount");
  expect(fees).toContain("for update");
  expect(fees).toContain("to service_role");
 });

 it('keeps contribution types intentionally small and beneficiary scoped',()=>{
  expect(contributions).toContain("contribution_type in('donation','zakat','sponsorship')");
  expect(contributions).toContain("beneficiary student not active in branch");
  expect(contributions).toContain("receipt_number");
  expect(contributions).toContain("to service_role");
 });

 it('keeps payroll intentionally small with guarded lifecycle',()=>{
  expect(payroll).toContain("state in('draft','finalized','paid')");
  expect(payroll).toContain("cannot finalize an empty payroll run");
  expect(payroll).toContain("invalid payroll state transition");
  expect(payroll).toContain("v_deduction>v_base+v_allowance");
  expect(payroll).toContain("to service_role");
 });

 it('keeps assistant context aggregate-only with a deterministic fallback',()=>{
  expect(assistant).toContain('getOperationalDashboard');
  expect(assistant).toContain('getMinimalFeesWorkspace');
  expect(assistant).toContain('getContributionsWorkspace');
  expect(assistant).toContain('getPayrollWorkspace');
  expect(assistant).toContain("generated??deterministic");
  expect(assistant).not.toContain('getStudentRegister');
  expect(assistant).not.toContain('person_contacts');
  expect(assistant).not.toContain('medical_summary');
 });
});
