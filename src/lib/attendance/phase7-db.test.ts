import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";

function migration(name:string){return readFileSync(resolve(process.cwd(),"supabase/migrations",name),"utf8").toLowerCase();}
const foundation=migration("20260903110000_client_v2_phase7_attendance_v2.sql");
const portal=migration("20260903113000_client_v2_phase7_portal_attendance.sql");

describe("Phase 7 Attendance V2 database contracts",()=>{
 it("creates scoped expiring emergency authorization windows",()=>{expect(foundation).toContain("emergency_manual_attendance_authorizations");expect(foundation).toContain("attendance_date");expect(foundation).toContain("starts_at");expect(foundation).toContain("expires_at");expect(foundation).toContain("scope_type");expect(foundation).toContain("reason");});
 it("keeps emergency student and staff marks database-governed",()=>{expect(foundation).toContain("mark_student_emergency_attendance_v1");expect(foundation).toContain("record_hr_emergency_attendance_v1");expect(foundation).toContain("emergency:");expect(foundation).toContain("'manual'");});
 it("auto-validates active windows instead of trusting the browser",()=>{expect(foundation).toContain("expires_at>now()");expect(foundation).toContain("starts_at<=now()");expect(foundation).toContain("attendance_date=p_attendance_date");});
 it("exposes trend and scan insight read models",()=>{expect(foundation).toContain("get_attendance_v2_insights_v1");expect(foundation).toContain("get_hr_attendance_v2_insights_v1");expect(foundation).toContain("first_scan");expect(foundation).toContain("last_scan");});
 it("keeps parent attendance verified-guardian-only and service-role-only",()=>{expect(portal).toContain("verified guardian portal link required");expect(portal).toContain("l.link_type='guardian'");expect(portal).toContain("pr.status='verified'");expect(portal).toContain("pr.portal_visibility in('limited','standard')");expect(portal).toContain("revoke all on function public.get_portal_attendance_v2_v1(uuid,bigint) from public,anon,authenticated");expect(portal).toContain("grant execute on function public.get_portal_attendance_v2_v1(uuid,bigint) to service_role");});
});
