import { expect,test } from "@playwright/test";

test("portal access issuance rejects anonymous callers",async({request})=>{const response=await request.post("/api/portals/access",{data:{personId:1,linkType:"guardian",expiresInDays:7}});expect(response.status()).toBe(401);});
test("portal access issuance rejects cross-origin callers before authentication",async({request})=>{const response=await request.post("/api/portals/access",{headers:{origin:"https://example.invalid"},data:{personId:1,linkType:"guardian",expiresInDays:7}});expect(response.status()).toBe(403);});
test("portal notice publishing rejects anonymous callers",async({request})=>{const response=await request.post("/api/portals/notices",{data:{audienceType:"parents",title:"Demo",body:"Demo notice"}});expect(response.status()).toBe(401);});
test("portal claim rejects anonymous callers",async({request})=>{const response=await request.post("/api/portal/claim",{data:{code:"MDR-0123456789ABCDEF01"}});expect(response.status()).toBe(401);});
test("portal claim rejects cross-origin callers before authentication",async({request})=>{const response=await request.post("/api/portal/claim",{headers:{origin:"https://example.invalid"},data:{code:"MDR-0123456789ABCDEF01"}});expect(response.status()).toBe(403);});
test("self-service portal redirects anonymous browser sessions to login",async({page})=>{await page.goto("/portal/claim?code=MDR-0123456789ABCDEF01");await expect(page).toHaveURL(/\/login\?next=%2Fportal%2Fclaim/);});
