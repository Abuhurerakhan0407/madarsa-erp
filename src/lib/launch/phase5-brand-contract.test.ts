import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const roots = ["src/app", "src/components", "messages"];
const sourceExtensions = new Set([".ts", ".tsx", ".json"]);
const legacyBrandMarkers = ["Madarsa ERP", "مدرسہ ای آر پی", "نظام إدارة المدرسة"];

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    if (!entry.isFile() || !sourceExtensions.has(extname(entry.name))) return [];
    if (entry.name.includes(".test.") || entry.name.includes(".spec.")) return [];
    return [path];
  });
}

describe("Client V3 Phase 5 launch branding", () => {
  it("does not expose the retired Madarsa ERP product name in production UI source", () => {
    const offenders = roots.flatMap(filesUnder).filter((path) => {
      const source = readFileSync(path, "utf8");
      return legacyBrandMarkers.some((marker) => source.includes(marker));
    });

    expect(offenders).toEqual([]);
  });
});
