import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const signup = readFileSync(resolve(process.cwd(), "src/app/api/auth/signup/route.ts"), "utf8");
const login = readFileSync(resolve(process.cwd(), "src/components/login-form.tsx"), "utf8");
const portalCredentials = readFileSync(resolve(process.cwd(), "src/app/api/portals/credentials/route.ts"), "utf8");
const portalChange = readFileSync(resolve(process.cwd(), "src/app/api/portal/password/change/route.ts"), "utf8");

describe("password security compensating controls", () => {
  it("enforces 12-128 mixed-complexity passwords on account creation", () => {
    expect(signup).toContain("value.length < 12");
    expect(signup).toContain("value.length > 128");
    for (const source of [signup, portalCredentials, portalChange]) {
      expect(source).toContain("/[A-Z]/");
      expect(source).toContain("/[0-9]/");
    }
    for (const source of [portalCredentials, portalChange]) {
      expect(source).toContain("value.length >= 12");
      expect(source).toContain("value.length <= 128");
    }
    expect(login).toContain('mode === "signup"');
    expect(login).toContain('minLength={mode === "signup" ? 12 : 8}');
  });
});
