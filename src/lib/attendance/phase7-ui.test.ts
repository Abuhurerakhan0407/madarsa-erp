import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";
const read=(path:string)=>readFileSync(resolve(process.cwd(),path),"utf8");

describe("Phase 7 Attendance V2 UI boundaries",()=>{
 it("shows student manual marks only under an active emergency match",()=>{const source=read("src/components/attendance-v2-workspace.tsx");expect(source).toContain("row.emergencyManualAuthorized");expect(source).toContain("EmergencyAttendancePanel");expect(source).toContain('sourceRef?.startsWith("emergency:")');});
 it("shows teacher manual marks only under an active emergency match",()=>{const source=read("src/components/hr-attendance-v2-workspace.tsx");expect(source).toContain("row.emergencyManualAuthorized&&data.canManage");expect(source).toContain("EmergencyAttendancePanel");});
 it("keeps device administration under Institution Configuration",()=>{const daily=read("src/app/[locale]/attendance/page.tsx");const legacy=read("src/app/[locale]/attendance/devices/page.tsx");const config=read("src/app/[locale]/settings/configuration/page.tsx");expect(daily).toContain("/settings/configuration/attendance-devices");expect(legacy).toContain("/settings/configuration/attendance-devices");expect(config).toContain("Attendance & Biometric Devices");});
 it("adds verified parent Attendance V2 summaries",()=>{const portal=read("src/components/portal-attendance-v2-section.tsx");expect(portal).toContain("get_portal_attendance_v2_v1");expect(portal).toContain("Today");expect(portal).toContain("7 days");expect(portal).toContain("30 days");expect(portal).toContain("Emergency manual");});
});
