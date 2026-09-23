import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginPage = readFileSync(
  resolve(process.cwd(), "src/app/login/page.tsx"),
  "utf8"
);

describe("authenticated login history contract", () => {
  it("replaces the login history entry after successful authentication", () => {
    expect(loginPage).toContain("router.replace(path)");
    expect(loginPage).not.toContain("router.push(path)");
  });
});
