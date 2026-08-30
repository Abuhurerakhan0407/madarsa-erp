import {describe,expect,it} from "vitest";
import {validateExamMarkInput,validateExamModerationInput,validateExamWorkflowInput} from "./model";

describe("exam validators",()=>{
  it("accepts a present mark",()=>{const result=validateExamMarkInput({examSubjectId:1,studentPersonId:4,entryStatus:"present",rawMarks:"84",comment:"Checked"});expect(result.errors).toEqual([]);expect(result.value?.rawMarks).toBe(84);});
  it("rejects marks for an absent student",()=>{const result=validateExamMarkInput({examSubjectId:1,studentPersonId:4,entryStatus:"absent",rawMarks:10});expect(result.value).toBeUndefined();expect(result.errors.join(" ")).toContain("Only present");});
  it("requires a moderation reason",()=>{const result=validateExamModerationInput({markEntryId:1,rawMarks:85,reason:"bad"});expect(result.value).toBeUndefined();expect(result.errors.join(" ")).toContain("Moderation reason");});
  it("accepts result publication workflow",()=>{const result=validateExamWorkflowInput({examSeriesId:1,action:"publish"});expect(result.errors).toEqual([]);expect(result.value?.action).toBe("publish");});
});
