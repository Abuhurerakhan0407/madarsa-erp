import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateLaunch, updateGate, type LaunchGate } from "./gates";

const readiness = JSON.parse(readFileSync(new URL("../../../config/launch-readiness.json", import.meta.url), "utf8")) as { gates: LaunchGate[] };

describe("commercial launch gates", () => {
  it("refuses launch while required evidence is missing", () => {
    const result = evaluateLaunch(readiness.gates);
    expect(result.ready).toBe(false);
    expect(result.blocking).toEqual([
      { key: "database_migrations_applied", owner: "engineering" },
      { key: "security_advisors_clear", owner: "engineering" },
      { key: "production_build_green", owner: "engineering" },
      { key: "critical_e2e_green", owner: "engineering" },
      { key: "production_deployment_current", owner: "engineering" },
      { key: "pilot_institution_signed_off", owner: "product" }
    ]);
  });
  it("becomes ready only after all required gates pass", () => {
    expect(evaluateLaunch(readiness.gates.map((gate) => ({ ...gate, complete: true })))).toEqual({ ready: true, percent: 100, blocking: [] });
  });
  it("rejects unknown gate updates", () => {
    expect(() => updateGate(readiness.gates, "imaginary", true)).toThrow("unknown_launch_gate:imaginary");
  });
});
