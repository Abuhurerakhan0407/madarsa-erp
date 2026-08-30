import { describe,expect,it } from "vitest";
import { validateQuranCorrectionInput } from "./correction";

const valid={requestKey:"quran-correction-unit-0001",attemptId:3,reason:"Teacher verified the signed register and corrected the score.",accuracyScore:82,fluencyScore:80,tajweedScore:78,overallScore:80,prompts:2,outcome:"passed",teacherRemark:"Corrected after review.",parentVisibleRemark:"Reviewed and corrected.",privateNote:""};

describe("validateQuranCorrectionInput",()=>{
  it("accepts a complete correction snapshot",()=>{const result=validateQuranCorrectionInput(valid);expect(result.errors).toEqual([]);expect(result.value?.attemptId).toBe(3);expect(result.value?.overallScore).toBe(80);expect(result.value?.privateNote).toBeNull();});
  it("requires a meaningful audit reason",()=>{const result=validateQuranCorrectionInput({...valid,reason:"bad"});expect(result.value).toBeUndefined();expect(result.errors.join(" ")).toContain("Correction reason");});
  it("rejects invalid scores",()=>{const result=validateQuranCorrectionInput({...valid,overallScore:101});expect(result.value).toBeUndefined();expect(result.errors.join(" ")).toContain("Overall score");});
  it("allows intentionally clearing optional scores",()=>{const result=validateQuranCorrectionInput({...valid,accuracyScore:"",fluencyScore:""});expect(result.errors).toEqual([]);expect(result.value?.accuracyScore).toBeNull();expect(result.value?.fluencyScore).toBeNull();});
});
