import {expect,test} from '@playwright/test';
const body={reportKey:'daily_attendance',parameters:{date_from:'2026-09-01',date_to:'2026-09-03'},outputFormat:'screen',requestKey:'report-request-e2e-00001'};
const json={'content-type':'application/json'};
test('report API rejects anonymous callers',async({request})=>{const response=await request.post('/api/reports/run',{headers:json,data:body});expect(response.status()).toBe(401);});
test('report API blocks cross-origin mutation before auth',async({request})=>{const response=await request.post('/api/reports/run',{headers:{...json,origin:'https://attacker.example'},data:body});expect(response.status()).toBe(403);});
test('report API requires JSON before auth',async({request})=>{const response=await request.post('/api/reports/run',{headers:{'content-type':'text/plain'},data:'invalid'});expect(response.status()).toBe(415);});
test('report API rejects a genuinely oversized body before auth',async({request})=>{const response=await request.post('/api/reports/run',{headers:json,data:{...body,parameters:{padding:'x'.repeat(40000)}}});expect(response.status()).toBe(413);});
