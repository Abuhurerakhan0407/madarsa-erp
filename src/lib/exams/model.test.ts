import {describe,expect,it} from "vitest";
import {validateExamMarkInput,validateExamModerationInput,validateExamSetupInput,validateExamWorkflowInput} from "./model";

describe("exam validators",()=>{
  it("accepts a present mark",()=>{const result=validateExamMarkInput({examSubjectId:1,studentPersonId:4,entryStatus:"present",rawMarks:"84",comment:"Checked"});expect(result.errors).toEqual([]);expect(result.value?.rawMarks).toBe(84);});
  it("rejects marks for an absent student",()=>{const result=validateExamMarkInput({examSubjectId:1,studentPersonId:4,entryStatus:"absent",rawMarks:10});expect(result.value).toBeUndefined();expect(result.errors.join(" ")).toContain("Only present");});
  it("requires a moderation reason",()=>{const result=validateExamModerationInput({markEntryId:1,rawMarks:85,reason:"bad"});expect(result.value).toBeUndefined();expect(result.errors.join(" ")).toContain("Moderation reason");});
  it("accepts result publication workflow",()=>{const result=validateExamWorkflowInput({examSeriesId:1,action:"publish"});expect(result.errors).toEqual([]);expect(result.value?.action).toBe("publish");});
  it("accepts governed exam setup",()=>{const result=validateExamSetupInput({groupId:"2",key:"monthly_assessment_2026_09",title:"Monthly Assessment — September 2026",startsOn:"2026-09-10",endsOn:"2026-09-15",evaluatorPersonId:"11",subjectIds:["1","2","3"]});expect(result.errors).toEqual([]);expect(result.value?.subjectIds).toEqual([1,2,3]);});
  it("rejects duplicate subjects and reversed dates",()=>{const result=validateExamSetupInput({groupId:2,key:"monthly_assessment",title:"Monthly Assessment",startsOn:"2026-09-15",endsOn:"2026-09-10",evaluatorPersonId:11,subjectIds:[1,1]});expect(result.value).toBeUndefined();expect(result.errors.join(" ")).toContain("end date");expect(result.errors.join(" ")).toContain("unique");});
  it("rejects unsafe exam keys",()=>{const result=validateExamSetupInput({groupId:2,key:"September Exam!",title:"September Exam",startsOn:"2026-09-10",endsOn:"2026-09-15",evaluatorPersonId:11,subjectIds:[1]});expect(result.value).toBeUndefined();expect(result.errors.join(" ")).toContain("lowercase");});
});
