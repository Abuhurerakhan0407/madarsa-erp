import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";
const read=(path:string)=>readFileSync(resolve(process.cwd(),path),"utf8");
const integrity=read("supabase/migrations/20260912040000_device_event_integrity_reconciliation.sql");
const processor=read("supabase/migrations/20260912042000_device_event_auto_processor.sql");
const bridge=read("src/lib/attendance/device-bridge.ts");
const ingest=read("src/app/api/attendance/device-ingest/route.ts");

describe("attendance device master-audit remediation",()=>{
 it("hashes the full canonical event and rejects conflicting replay IDs",()=>{expect(integrity).toContain("'external_subject_key',v_subject_key");expect(integrity).toContain("'event_type',v_type");expect(integrity).toContain("'occurred_at',p_occurred_at");expect(integrity).toContain("'metadata',v_metadata");expect(integrity).toContain("conflicting device event replay");expect(integrity).toContain("'unchanged',true")});
 it("keeps operational apply failures retryable instead of poisoning matched events",()=>{expect(integrity).toContain("Keep a valid matched event retryable");expect(integrity).toContain("'retryable',true");expect(integrity).not.toContain("set state='rejected',error_reason")});
 it("reconciles staff rescans with earliest-in/latest-out semantics and an audit correction reason",()=>{expect(integrity).toContain("greatest(v_check_out,v_event.occurred_at)");expect(integrity).toContain("least(v_check_in,v_event.occurred_at)");expect(integrity).toContain("Automated device scan reconciliation")});
 it("does not invent Furkania student shift attendance semantics",()=>{expect(integrity).toContain("t.slug='madrasa-e-furkania'");expect(integrity).toContain("requires confirmed shift attendance policy")});
 it("binds automatic processing to a real active authorized membership",()=>{expect(processor).toContain("attendance_device_processor_configs");expect(processor).toContain("m.status='active'");expect(processor).toContain("operator_has_permission_v1");expect(processor).toContain("processor_authorization_expired");expect(processor).not.toMatch(/create\s+user|auth\.users.*insert/i)});
 it("processes matched events immediately after device ingest and retries after mapping",()=>{expect(ingest).toContain("processAttendanceDeviceEventAutomatically");expect(ingest).toContain("received.matched === true");expect(bridge).toContain("process_pending_attendance_device_events_v1");expect(bridge).toContain("configure_attendance_device_processor_v1")});
 it("keeps processor entrypoints server-only",()=>{for(const name of ["configure_attendance_device_processor_v1","process_attendance_device_event_auto_v1","process_pending_attendance_device_events_v1"]){expect(processor).toMatch(new RegExp(`revoke all on function public\\.${name}[\\s\\S]*from public,anon,authenticated`,`i`));expect(processor).toMatch(new RegExp(`grant execute on function public\\.${name}[\\s\\S]*to service_role`,`i`));}});
});
