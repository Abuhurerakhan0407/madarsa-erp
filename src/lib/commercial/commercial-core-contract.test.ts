import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const root=(path:string)=>readFileSync(new URL(`../../../${path}`,import.meta.url),'utf8');
const fees=root('supabase/migrations/20260917200000_minimal_fees_runtime.sql')+root('supabase/migrations/20260917200001_minimal_fees_integrity_hardening.sql');
const contributions=root('supabase/migrations/20260917201000_minimal_contributions_runtime.sql');
const payroll=root('supabase/migrations/20260917202000_minimal_payroll_runtime.sql')+root('supabase/migrations/20260917202001_minimal_payroll_integrity_hardening.sql');
const nav=root('src/lib/navigation/app-navigation.ts');
const assistant=root('src/lib/assistant/operational.ts');
const capability=root('src/lib/capabilities/client-profile.ts');
const aiPermission=root('supabase/migrations/20260917204000_operational_assistant_permission.sql');

describe('locked commercial-core scope',()=>{
 it('removes retired modules from client navigation while keeping required modules',()=>{
  expect(nav).not.toContain('key: "hostel"');expect(nav).not.toContain('key: "transport"');expect(nav).not.toContain('key: "library"');expect(nav).not.toContain('key: "whatsapp"');
  for(const key of ['key: "fees"','key: "donations"','key: "payroll"','key: "portals"','key: "branches"','key: "ai"'])expect(nav).toContain(key);
  for(const capabilityName of ['"hostel_mess"','"transport"','"library"','"whatsapp_automation"'])expect(capability).toContain(capabilityName);
 });

 it('does not inherit sensitive commercial permissions from generic student-read roles',()=>{
  expect(fees).not.toContain("rp.permission_code='students.profile.read'");
  expect(fees).not.toContain("rp.permission_code='students.profile.update'");
  expect(contributions).not.toContain("rp.permission_code='students.profile.read'");
  expect(contributions).not.toContain("rp.permission_code='students.profile.update'");
  expect(payroll).not.toContain("rp.permission_code='hr.employee.read'");
  expect(aiPermission).not.toContain("rp.permission_code='students.profile.read'");
  expect(aiPermission).toContain("rp.permission_code='settings.roles.manage'");
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
