import {expect,test} from "@playwright/test";

const json={"content-type":"application/json"};
const mark={examSubjectId:1,studentPersonId:4,entryStatus:"present",rawMarks:84,comment:"Checked"};
const moderate={markEntryId:1,rawMarks:85,reason:"Verified against signed paper register."};
const workflow={examSeriesId:1,action:"calculate"};

for(const [path,body] of [["/api/exams/mark",mark],["/api/exams/moderate",moderate],["/api/exams/workflow",workflow]] as const){
  test(`${path} rejects anonymous callers`,async({request})=>{const response=await request.post(path,{headers:json,data:body});expect(response.status()).toBe(401);});
  test(`${path} blocks cross-origin mutations before auth`,async({request})=>{const response=await request.post(path,{headers:{...json,origin:"https://attacker.example"},data:body});expect(response.status()).toBe(403);});
  test(`${path} requires JSON before auth`,async({request})=>{const response=await request.post(path,{headers:{"content-type":"text/plain"},data:"invalid"});expect(response.status()).toBe(415);});
}

test("exam mark rejects a genuinely oversized body before auth",async({request})=>{const response=await request.post("/api/exams/mark",{headers:json,data:{...mark,comment:"x".repeat(20000)}});expect(response.status()).toBe(413);});
test("exam moderation rejects a genuinely oversized body before auth",async({request})=>{const response=await request.post("/api/exams/moderate",{headers:json,data:{...moderate,reason:"x".repeat(20000)}});expect(response.status()).toBe(413);});
test("exam workflow rejects a genuinely oversized body before auth",async({request})=>{const response=await request.post("/api/exams/workflow",{headers:json,data:{...workflow,padding:"x".repeat(10000)}});expect(response.status()).toBe(413);});
