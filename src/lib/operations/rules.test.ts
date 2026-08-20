import { describe, expect, it } from "vitest";
import { payrollAnomalies, payrollNetMinor, rangesOverlap, validateCapacity } from "./rules";

describe("operations rules", () => {
  it("prevents resource overlap", () => {
    expect(rangesOverlap({ startsOn: "2026-08-01", endsOn: "2026-08-31" }, { startsOn: "2026-08-20" })).toBe(true);
    expect(rangesOverlap({ startsOn: "2026-08-01", endsOn: "2026-08-10" }, { startsOn: "2026-08-20" })).toBe(false);
  });
  it("enforces vehicle and room capacity", () => {
    expect(validateCapacity(40, 40)).toContain("capacity_exceeded");
    expect(validateCapacity(40, 39)).toEqual([]);
  });
  it("calculates payroll with exact minor units", () => {
    expect(payrollNetMinor([500000n, 50000n], [25000n])).toEqual({ gross: 550000n, deductions: 25000n, net: 525000n });
  });
  it("explains payroll anomalies", () => {
    expect(payrollAnomalies({ bankMissing: true, salaryMissing: false, attendanceUnresolved: true, netMinor: -1n, duplicate: false })).toEqual(["missing_bank_details", "unresolved_attendance", "negative_net_pay"]);
  });
});
