import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeFiles = [
  "src/app/api/mobile/attendance/route.ts",
  "src/app/api/mobile/bootstrap/route.ts",
  "src/app/api/mobile/home/route.ts",
  "src/app/api/mobile/hostel/route.ts",
  "src/app/api/mobile/reports/route.ts",
  "src/app/api/mobile/portal/attendance/route.ts",
  "src/app/api/mobile/portal/classes/route.ts",
  "src/app/api/mobile/portal/home/route.ts",
  "src/app/api/mobile/students/route.ts",
  "src/app/api/mobile/students/[personId]/route.ts",
] as const;

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const routeSources = routeFiles.map((file) => [file, source(file)] as const);

describe("mobile API security contract", () => {
  it("keeps native origins explicit and responses private", () => {
    for (const [file, text] of routeSources) {
      expect(text, file).toContain("NATIVE_ORIGINS");
      expect(text, file).toMatch(/origin_not_allowed|!NATIVE_ORIGINS\.has\(origin\)/);
      expect(text, file).toMatch(/no-store/i);
    }
  });

  it("requires verified bearer identity before tenant data access", () => {
    for (const [file, text] of routeSources) {
      expect(text, file).toMatch(/Bearer|resolveMobileStaffWorkspace|getMobileBearerToken/);
      expect(text, file).toMatch(/auth\.getUser\(|resolveMobileStaffWorkspace/);
      expect(text, file).toMatch(/tenant_id|tenantId/);
    }
  });

  it("maps the canonical institution owner role to the admin surface", () => {
    expect(source("src/app/api/mobile/bootstrap/route.ts")).toContain('key === "institution_owner"');
    expect(source("src/lib/mobile/server-auth.ts")).toContain('key === "institution_owner"');
  });

  it("keeps mobile routes read-only", () => {
    for (const [file, text] of routeSources) {
      expect(text, file).toContain("function GET");
      expect(text, file).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    }
  });
});