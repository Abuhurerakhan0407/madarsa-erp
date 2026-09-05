import {describe,expect,it} from "vitest";
import {classifyNavigationAudience} from "./audience-classifier";
import {getClientV3Navigation} from "./client-v3-navigation";

describe("Client V3 navigation",()=>{
 it("uses exact task-first office IA without unfinished modules",()=>{const nav=getClientV3Navigation("office");expect(nav.primary.map(i=>i.key)).toEqual(["home","admissions","students","attendance","quran"]);expect(nav.more.map(i=>i.key)).toEqual(["teachers","exams","documents","reports","settings"]);expect(nav.mobile.map(i=>i.key)).toEqual(["home","admissions","students","attendance"]);expect([...nav.primary,...nav.more].map(i=>i.href("en")).join(" ")).not.toMatch(/demo|fees|preview|lifecycle|donation|whatsapp|ai/)});
 it("uses teacher-first navigation",()=>{const nav=getClientV3Navigation("teacher");expect(nav.primary.map(i=>i.key)).toEqual(["home","my-students","attendance","quran"]);expect(nav.mobile.map(i=>i.key)).toEqual(["home","my-students","attendance","quran"])});
 it("classifies teaching-only memberships as teacher",()=>expect(classifyNavigationAudience(["teacher"],["students.profile.read","attendance.student.read","attendance.student.mark","learning.progress.read"])).toBe("teacher"));
 it("fails ambiguous or office-capable memberships to office",()=>{expect(classifyNavigationAudience(["teacher"],["students.profile.read","attendance.student.mark","settings.configuration.read"])).toBe("office");expect(classifyNavigationAudience([],[])).toBe("office")});
});
