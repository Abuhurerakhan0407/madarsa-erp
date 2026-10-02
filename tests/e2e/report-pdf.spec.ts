import {expect,test} from '@playwright/test';
const json={'content-type':'application/json'};const body={reportKey:'daily_attendance',parameters:{date_from:'2026-09-01',date_to:'2026-09-03'}};
test('report PDF rejects anonymous callers',async({request})=>{const response=await request.post('/api/reports/pdf',{headers:json,data:body});expect(response.status()).toBe(401);});
test('report PDF blocks cross-origin requests before auth',async({request})=>{const response=await request.post('/api/reports/pdf',{headers:{...json,origin:'https://attacker.example'},data:body});expect(response.status()).toBe(403);});
test('report PDF requires JSON before auth',async({request})=>{const response=await request.post('/api/reports/pdf',{headers:{'content-type':'text/plain'},data:'report'});expect(response.status()).toBe(415);});
test('report PDF rejects oversized input before auth',async({request})=>{const response=await request.post('/api/reports/pdf',{headers:json,data:{...body,parameters:{padding:'x'.repeat(40000)}}});expect(response.status()).toBe(413);});
