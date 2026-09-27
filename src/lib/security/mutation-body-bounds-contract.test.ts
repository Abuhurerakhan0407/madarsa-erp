import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const boundedRoutes = [
  ["admissions action", "src/app/api/admissions/action/route.ts", "8_192"],
  ["admissions foundation", "src/app/api/admissions/foundation/route.ts", "16_384"],
  ["configuration preset", "src/app/api/configuration/preset/route.ts", "4_096"],
  ["onboarding bootstrap", "src/app/api/onboarding/bootstrap/route.ts", "8_192"]
] as const;

describe("bounded mutation request bodies", () => {
  it.each(boundedRoutes)("bounds %s JSON", (_name, path, limit) => {
    const source = read(path);
    expect(source).toContain(`readBoundedJson(request, ${limit})`);
    expect(source).not.toContain("await request.json()");
  });

  it("rejects non-object onboarding JSON before field access", () => {
    const source = read("src/app/api/onboarding/bootstrap/route.ts");
    expect(source).toContain('typeof parsedBody.value !== "object"');
    expect(source).toContain("Array.isArray(parsedBody.value)");
    expect(source).toContain('error: "Invalid request body."');
  });
});
