import { describe,expect,it } from "vitest";
import { parseStudentImportCsv } from "./csv-import";

describe("student CSV import parser",()=>{
 it("parses canonical and alias headers with quoted commas",()=>{
  const rows=parseStudentImportCsv('student_name,dob,gender,locale,parent_name,relationship,parent_phone\n"Ayaan, Demo",2015-04-03,male,en,Demo Guardian,father,+910000000001');
  expect(rows).toEqual([{display_name:"Ayaan, Demo",date_of_birth:"2015-04-03",gender:"male",preferred_locale:"en",guardian:{name:"Demo Guardian",relationship:"father",phone:"+910000000001"}}]);
 });
 it("rejects missing student names and invalid enums",()=>{
  expect(()=>parseStudentImportCsv("display_name,gender\n,female")).toThrow(/missing the student name/i);
  expect(()=>parseStudentImportCsv("display_name,gender\nAyaan,unknown")).toThrow(/invalid gender/i);
 });
 it("enforces the 100-row application batch limit",()=>{
  const csv=["display_name",...Array.from({length:101},(_,index)=>`Student ${index+1}`)].join("\n");
  expect(()=>parseStudentImportCsv(csv)).toThrow(/at most 100/i);
 });
});
