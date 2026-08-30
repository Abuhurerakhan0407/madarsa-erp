import {expect,test} from '@playwright/test';
const json={'content-type':'application/json'};
const employee={displayName:'Ustadh Test',preferredLocale:'en',departmentKey:'academics',designation:'Teacher',contractType:'permanent',joinedOn:'2026-06-15',payrollEligible:true};
const update={employmentId:1,...employee,state:'active'};
const attendance={employmentId:1,attendanceDate:'2026-08-31',status:'present',source:'manual',requestKey:'hr-e2e-request-key-0001'};
const leave={employmentId:1,leaveTypeId:1,startsOn:'2026-09-01',endsOn:'2026-09-02',reason:'Test leave'};
for(const [path,body] of [['/api/hr/employees',employee],['/api/hr/employees/update',update],['/api/hr/attendance',attendance],['/api/hr/leave',leave]] as const){
 test(`${path} rejects anonymous callers`,async({request})=>{const response=await request.post(path,{headers:json,data:body});expect(response.status()).toBe(401);});
 test(`${path} blocks cross-origin mutations before auth`,async({request})=>{const response=await request.post(path,{headers:{...json,origin:'https://attacker.example'},data:body});expect(response.status()).toBe(403);});
 test(`${path} requires JSON before auth`,async({request})=>{const response=await request.post(path,{headers:{'content-type':'text/plain'},data:'invalid'});expect(response.status()).toBe(415);});
 test(`${path} rejects genuinely oversized JSON before auth`,async({request})=>{const response=await request.post(path,{headers:json,data:{...body,padding:'x'.repeat(20000)}});expect(response.status()).toBe(413);});
}