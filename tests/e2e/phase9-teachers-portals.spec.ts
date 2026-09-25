import {expect,test} from "@playwright/test";

const json={"content-type":"application/json"};
const mutations=[
 ["/api/teachers/update",{employmentId:1,displayName:"Teacher",nameNative:"",email:"teacher@example.com",phone:"+911234567890",designation:"Teacher",joinedOn:"2026-01-01"}],
 ["/api/portals/access-state",{personId:1,kind:"guardian",enabled:false}],
 ["/api/portals/credentials",{personId:1,kind:"guardian",action:"provision",email:"parent@example.com",confirmEmail:"parent@example.com",temporaryPassword:"SecurePortalPassword!2026"}],
 ["/api/portal/password/change",{password:"SecurePortalPassword!2026"}]
] as const;

for(const [path,body] of mutations){
 test(`${path} rejects anonymous callers`,async({request})=>{const response=await request.post(path,{headers:json,data:body});expect(response.status()).toBe(401);});
 test(`${path} blocks cross-origin mutation before auth`,async({request})=>{const response=await request.post(path,{headers:{...json,origin:"https://attacker.example"},data:body});expect(response.status()).toBe(403);});
 test(`${path} requires JSON before auth`,async({request})=>{const response=await request.post(path,{headers:{"content-type":"text/plain"},data:"invalid"});expect(response.status()).toBe(415);});
}


test("teacher operator photo rejects anonymous callers",async({request})=>{expect((await request.get("/api/teachers/photo/1")).status()).toBe(401);});
test("guardian-scoped teacher photo rejects anonymous callers",async({request})=>{expect((await request.get("/api/portal/teachers/photo/1?tenant=1")).status()).toBe(401);});
test("portal sends anonymous browser to login",async({page})=>{await page.goto("/portal");await expect(page).toHaveURL(/\/login\?next=%2Fportal|\/login\?next=%252Fportal/);});
