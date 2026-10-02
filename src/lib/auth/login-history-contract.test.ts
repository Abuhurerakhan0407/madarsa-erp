import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginForm = readFileSync(
  resolve(process.cwd(), "src/components/login-form.tsx"),
  "utf8"
);

describe("authenticated login history contract", () => {
  it("replaces the login history entry after successful authentication", () => {
    expect(loginForm).toContain("router.replace(path)");
    expect(loginForm).not.toContain("router.push(path)");
  });
});
