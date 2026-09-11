import {expect,test} from "@playwright/test";

test("student fee actions reject anonymous callers",async({request})=>{
 const response=await request.post("/api/fees/action",{headers:{"content-type":"application/json"},data:{action:"collect_payment",idempotencyKey:"anonymous-fee-test-0001",studentPersonId:1,amount:1,currencyCode:"INR",mode:"cash"}});
 expect(response.status()).toBe(401);
});

test("student fee actions reject cross-origin callers before authentication",async({request})=>{
 const response=await request.post("/api/fees/action",{headers:{"content-type":"application/json",origin:"https://attacker.example"},data:{action:"collect_payment",idempotencyKey:"cross-origin-fee-test-0001",studentPersonId:1,amount:1,currencyCode:"INR",mode:"cash"}});
 expect(response.status()).toBe(403);
});

test("student fee actions require JSON",async({request})=>{
 const response=await request.post("/api/fees/action",{headers:{"content-type":"text/plain"},data:"fee"});
 expect(response.status()).toBe(415);
});
