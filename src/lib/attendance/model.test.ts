import { describe, expect, it } from "vitest";
import { validateAttendanceCorrectionInput, validateAttendanceDate, validateAttendanceMarkInput } from "./model";

describe("attendance workspace validation", () => {
  it("accepts a valid manual attendance mark", () => {
    const result = validateAttendanceMarkInput({ attendanceSessionId: 3, personId: 9, statusKey: "present", source: "manual" });
    expect(result.errors).toEqual([]);
    expect(result.value?.source).toBe("manual");
  });

  it("rejects invalid source and identifiers", () => {
    const result = validateAttendanceMarkInput({ attendanceSessionId: 0, personId: "x", statusKey: "present", source: "camera" });
    expect(result.value).toBeUndefined();
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("requires a meaningful correction reason", () => {
    expect(validateAttendanceCorrectionInput({ attendanceRecordId: 2, statusKey: "absent", reason: "short" }).value).toBeUndefined();
    expect(validateAttendanceCorrectionInput({ attendanceRecordId: 2, statusKey: "absent", reason: "Marked incorrectly by staff" }).errors).toEqual([]);
  });

  it("validates ISO attendance dates", () => {
    expect(validateAttendanceDate("2026-08-31")).toBe("2026-08-31");
    expect(validateAttendanceDate("31-08-2026")).toBeUndefined();
    expect(validateAttendanceDate("2026-02-31")).toBeUndefined();
  });
});
