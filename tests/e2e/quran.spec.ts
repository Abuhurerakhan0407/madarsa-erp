import { expect,test } from "@playwright/test";

const json={"content-type":"application/json"};
const body={requestKey:"quran-e2e-request-key-0001",personId:4,workCategory:"sabaq",targetMode:"juz",juzNumber:30,outcome:"passed",mistakes:[]};
const dailyBody={requestKey:"quran-daily-e2e-key-0001",groupId:2,sessionDate:"2026-09-03",personId:4,workCategory:"sabaq",action:"absent",mistakeCount:0};

test("Quran recording rejects anonymous callers",async({request})=>{
  const response=await request.post("/api/quran/record",{headers:json,data:body});expect(response.status()).toBe(401);
});

test("Quran recording blocks cross-origin mutations before auth",async({request})=>{
  const response=await request.post("/api/quran/record",{headers:{...json,origin:"https://attacker.example"},data:body});expect(response.status()).toBe(403);
});

test("Quran recording requires JSON before auth",async({request})=>{
  const response=await request.post("/api/quran/record",{headers:{"content-type":"text/plain"},data:"invalid"});expect(response.status()).toBe(415);
});

test("Quran recording rejects oversized body before auth",async({request})=>{
  const oversized={...body,privateNote:"x".repeat(40000)};
  const response=await request.post("/api/quran/record",{headers:json,data:oversized});expect(response.status()).toBe(413);
});

test("Quran daily register rejects anonymous callers",async({request})=>{
  const response=await request.post("/api/quran/daily",{headers:json,data:dailyBody});expect(response.status()).toBe(401);
});

test("Quran daily register blocks cross-origin mutations before auth",async({request})=>{
  const response=await request.post("/api/quran/daily",{headers:{...json,origin:"https://attacker.example"},data:dailyBody});expect(response.status()).toBe(403);
});

test("Quran daily register requires JSON before auth",async({request})=>{
  const response=await request.post("/api/quran/daily",{headers:{"content-type":"text/plain"},data:"invalid"});expect(response.status()).toBe(415);
});

test("Quran daily register rejects oversized bodies before auth",async({request})=>{
  const response=await request.post("/api/quran/daily",{headers:json,data:{...dailyBody,teacherNote:"x".repeat(30000)}});expect(response.status()).toBe(413);
});

test("Quran daily register rejects unsupported input before auth",async({request})=>{
  const response=await request.post("/api/quran/daily",{headers:json,data:{...dailyBody,injectedTenantId:999}});expect(response.status()).toBe(400);
});
