import type { NavigationAudience } from "./client-v3-navigation";

const OFFICE_PREFIXES=["settings.","admissions.","people.employee.","hr.employee.","finance.","report.","document.","documents."];
const TEACHING_PREFIXES=["attendance.student.","learning.","assessment.marks."];

export function classifyNavigationAudience(roleKeys:string[],permissions:string[]):NavigationAudience{
 const normalized=roleKeys.map(value=>value.toLowerCase());
 const office=permissions.some(code=>OFFICE_PREFIXES.some(prefix=>code.startsWith(prefix)));
 const teaching=permissions.some(code=>TEACHING_PREFIXES.some(prefix=>code.startsWith(prefix)));
 const studentRead=permissions.includes("students.profile.read");
 const teacherRole=normalized.some(key=>key==="teacher"||key.startsWith("teacher_")||key.endsWith("_teacher"));
 return !office&&studentRead&&teaching&&(teacherRole||permissions.includes("attendance.student.mark"))?"teacher":"office";
}
