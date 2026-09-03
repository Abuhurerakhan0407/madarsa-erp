import {expect,test} from '@playwright/test';
const json={'content-type':'application/json'};const documentBody={documentType:'student_profile',personIds:[1],allFiltered:false,filters:{}};
test('Phase 10 document PDF rejects anonymous callers',async({request})=>{const response=await request.post('/api/documents/pdf',{headers:json,data:documentBody});expect(response.status()).toBe(401);});
test('Phase 10 document PDF blocks cross-origin mutation before auth',async({request})=>{const response=await request.post('/api/documents/pdf',{headers:{...json,origin:'https://attacker.example'},data:documentBody});expect(response.status()).toBe(403);});
test('Phase 10 document PDF requires JSON before auth',async({request})=>{const response=await request.post('/api/documents/pdf',{headers:{'content-type':'text/plain'},data:'invalid'});expect(response.status()).toBe(415);});
test('Phase 10 document PDF rejects oversized payload before auth',async({request})=>{const response=await request.post('/api/documents/pdf',{headers:json,data:{...documentBody,padding:'x'.repeat(70000)}});expect(response.status()).toBe(413);});
