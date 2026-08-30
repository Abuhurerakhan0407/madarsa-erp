import { expect,test } from "@playwright/test";

const json={"content-type":"application/json"};
const body={requestKey:"quran-correction-e2e-0001",attemptId:3,reason:"Teacher verified the signed register and corrected the evaluation.",accuracyScore:82,fluencyScore:80,tajweedScore:78,overallScore:80,prompts:2,outcome:"passed",teacherRemark:"Corrected after review.",parentVisibleRemark:"Reviewed and corrected.",privateNote:""};

test("Quran correction rejects anonymous callers",async({request})=>{const response=await request.post("/api/quran/correct",{headers:json,data:body});expect(response.status()).toBe(401);});
test("Quran correction blocks cross-origin mutations before auth",async({request})=>{const response=await request.post("/api/quran/correct",{headers:{...json,origin:"https://attacker.example"},data:body});expect(response.status()).toBe(403);});
test("Quran correction requires JSON before auth",async({request})=>{const response=await request.post("/api/quran/correct",{headers:{"content-type":"text/plain"},data:"invalid"});expect(response.status()).toBe(415);});
test("Quran correction rejects oversized body before auth",async({request})=>{const response=await request.post("/api/quran/correct",{headers:{...json,"content-length":"30000"},data:body});expect(response.status()).toBe(413);});
