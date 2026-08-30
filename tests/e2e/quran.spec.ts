import { expect,test } from "@playwright/test";

const json={"content-type":"application/json"};
const body={requestKey:"quran-e2e-request-key-0001",personId:4,workCategory:"sabaq",targetMode:"juz",juzNumber:30,outcome:"passed",mistakes:[]};

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
  const response=await request.post("/api/quran/record",{headers:{...json,"content-length":"40000"},data:body});expect(response.status()).toBe(413);
});
