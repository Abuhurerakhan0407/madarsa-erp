import { describe,expect,it } from "vitest";
import { validateQuranAttemptInput } from "./model";

describe("validateQuranAttemptInput",()=>{
  it("accepts a Juz Hifz entry and derives overall score",()=>{
    const result=validateQuranAttemptInput({personId:4,workCategory:"sabaq",targetMode:"juz",juzNumber:30,accuracyScore:90,fluencyScore:80,tajweedScore:70,prompts:2,outcome:"passed",mistakes:[{category:"madd",severity:2,count:1}]});
    expect(result.errors).toEqual([]);expect(result.value?.overallScore).toBe(80);expect(result.value?.juzNumber).toBe(30);
  });
  it("rejects an invalid Juz and score",()=>{
    const result=validateQuranAttemptInput({personId:4,workCategory:"sabaq",targetMode:"juz",juzNumber:31,accuracyScore:120,outcome:"passed",mistakes:[]});
    expect(result.value).toBeUndefined();expect(result.errors.join(" ")).toContain("Juz");expect(result.errors.join(" ")).toContain("Accuracy");
  });
  it("validates ordered Surah and Ayah ranges",()=>{
    const invalid=validateQuranAttemptInput({personId:4,workCategory:"nazra",targetMode:"ayah",startSurahNumber:2,startAyahNumber:20,endSurahNumber:2,endAyahNumber:10,outcome:"partial",mistakes:[]});
    expect(invalid.value).toBeUndefined();
    const valid=validateQuranAttemptInput({personId:4,workCategory:"nazra",targetMode:"ayah",startSurahNumber:2,startAyahNumber:10,endSurahNumber:2,endAyahNumber:20,outcome:"partial",mistakes:[]});
    expect(valid.errors).toEqual([]);
  });
  it("rejects oversized or malformed mistake entries",()=>{
    const result=validateQuranAttemptInput({personId:4,workCategory:"tajweed",targetMode:"page",pageStart:1,pageEnd:2,outcome:"repeat",mistakes:[{category:"x",severity:9,count:0}]});
    expect(result.value).toBeUndefined();expect(result.errors.length).toBeGreaterThan(0);
  });
});
