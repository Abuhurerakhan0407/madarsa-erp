import { describe, expect, it } from "vitest";
import { validateStudentUpdateInput } from "./update-model";

describe("validateStudentUpdateInput",()=>{
  it("accepts a valid update",()=>{const result=validateStudentUpdateInput({displayName:"Ayaan Siddiqui",preferredLocale:"en",dateOfBirth:"2012-08-04",gender:"male",medicalSummary:"Asthma"});expect(result.errors).toEqual([]);expect(result.value?.displayName).toBe("Ayaan Siddiqui");});
  it("rejects invalid locale and future-shaped bad date",()=>{const result=validateStudentUpdateInput({displayName:"A",preferredLocale:"xx",dateOfBirth:"30-08-2026"});expect(result.value).toBeUndefined();expect(result.errors.length).toBeGreaterThan(0);});
});
