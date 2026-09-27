import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const boundedRoutes = [
  ["admissions action", "src/app/api/admissions/action/route.ts", "8_192"],
  ["admissions foundation", "src/app/api/admissions/foundation/route.ts", "16_384"],
  ["admissions conversion", "src/app/api/admissions/convert/route.ts", "4_096"],
  ["attendance correction", "src/app/api/attendance/correct/route.ts", "4_096"],
  ["attendance lock", "src/app/api/attendance/lock/route.ts", "2_048"],
  ["attendance mark", "src/app/api/attendance/mark/route.ts", "8_192"],
  ["attendance review", "src/app/api/attendance/review/route.ts", "4_096"],
  ["attendance start", "src/app/api/attendance/start/route.ts", "2_048"],
  ["configuration preset", "src/app/api/configuration/preset/route.ts", "4_096"],
  ["student numbering", "src/app/api/configuration/student-numbering/route.ts", "8_192"],
  ["exam mark", "src/app/api/exams/mark/route.ts", "16_384"],
  ["exam moderation", "src/app/api/exams/moderate/route.ts", "16_384"],
  ["exam setup", "src/app/api/exams/setup/route.ts", "16_384"],
  ["exam workflow", "src/app/api/exams/workflow/route.ts", "8_192"],
  ["public admission tracking", "src/app/api/public/admissions/track/route.ts", "4_096"],
  ["Quran correction", "src/app/api/quran/correct/route.ts", "24_576"],
  ["Quran record", "src/app/api/quran/record/route.ts", "32_768"],
  ["student create", "src/app/api/students/route.ts", "16_384"],
  ["student update", "src/app/api/students/[personId]/route.ts", "12_288"],
  ["guardian update", "src/app/api/students/[personId]/guardian/route.ts", "8_192"],
  ["student placement", "src/app/api/students/[personId]/placement/route.ts", "4_096"],
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
