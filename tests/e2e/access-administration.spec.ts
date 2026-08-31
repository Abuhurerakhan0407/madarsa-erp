import { expect,test } from "@playwright/test";

test("access administration requires authentication",async({page})=>{
 await page.goto("/en/access");
 await expect(page).toHaveURL(/\/login/);
});

test("legacy branches demo remains protected",async({page})=>{
 await page.goto("/en/demo/branches");
 await expect(page).toHaveURL(/\/login/);
});
