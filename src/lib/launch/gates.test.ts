import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateLaunch, updateGate, type LaunchGate } from "./gates";

const readiness = JSON.parse(readFileSync(new URL("../../../config/launch-readiness.json", import.meta.url), "utf8")) as { gates: LaunchGate[] };

describe("commercial launch gates", () => {
  it("refuses launch while required evidence is missing", () => {
    const result = evaluateLaunch(readiness.gates);
    expect(result.ready).toBe(false);
    expect(result.blocking).toEqual(expect.arrayContaining([
      { key: "security_advisors_clear", owner: "engineering" },
      { key: "tax_boundary_approved", owner: "finance_legal" },
      { key: "backup_restore_drill_passed", owner: "operations" },
      { key: "payment_webhooks_verified", owner: "engineering" },
      { key: "pilot_institution_signed_off", owner: "product" }
    ]));
  });
  it("becomes ready only after all required gates pass", () => {
    expect(evaluateLaunch(readiness.gates.map((gate) => ({ ...gate, complete: true })))).toEqual({ ready: true, percent: 100, blocking: [] });
  });
  it("rejects unknown gate updates", () => {
    expect(() => updateGate(readiness.gates, "imaginary", true)).toThrow("unknown_launch_gate:imaginary");
  });
});
