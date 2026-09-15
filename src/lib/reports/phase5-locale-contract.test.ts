import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phase 5 reports English and Urdu error contract", () => {
  it("keeps report and PDF failures localized on Urdu routes", () => {
    const source = read("src/components/reports-hub.tsx");
    expect(source).toContain("setError(locale==='ur'?t.error:(payload.error||t.error))");
    expect(source.match(/setError\(locale==='ur'\?t\.error:\(payload\.error\|\|t\.error\)\)/g)?.length).toBe(2);
  });

  it("keeps visible report generation pending feedback", () => {
    const source = read("src/components/reports-hub.tsx");
    expect(source).toContain("aria-busy={busy||undefined}");
    expect(source).toContain("inline-spinner");
    expect(source).toContain("t.loading");
  });
});
