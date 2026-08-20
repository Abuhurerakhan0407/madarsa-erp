import { describe, expect, it } from "vitest";
import type { AttendanceStatus, AttendanceSubmission, LeaveRequest } from "./model";
import { attendancePercentage, canTransitionLeave, leaveOverlaps, validateAttendanceSubmission } from "./rules";

describe("attendance rules", () => {
  it("rejects unrelated and duplicate roster marks", () => {
    const submission: AttendanceSubmission = {
      tenantId: "tenant-a",
      rosterId: "roster-1",
      idempotencyKey: "attendance-key-001",
      members: [{ enrollmentId: "e-1", studentPersonId: "s-1", enrollmentStatus: "active", groupId: "g-1" }],
      marks: [{ enrollmentId: "e-2", statusKey: "present" }, { enrollmentId: "e-2", statusKey: "absent" }]
    };
    expect(validateAttendanceSubmission(submission)).toEqual([
      "unrelated_enrollment:e-2",
      "unrelated_enrollment:e-2",
      "duplicate_mark:e-2"
    ]);
  });

  it("keeps unmarked distinct from present", () => {
    const statuses = new Map<string, AttendanceStatus>([
      ["present", { key: "present", category: "present", presenceRatio: 1, triggersAlert: false }],
      ["late", { key: "late", category: "late", presenceRatio: 0.5, triggersAlert: false }],
      ["unmarked", { key: "unmarked", category: "unmarked", presenceRatio: 0, triggersAlert: false }]
    ]);
    expect(attendancePercentage(["present", "late", "unmarked"], statuses)).toBe(75);
  });

  it("enforces leave transitions", () => {
    expect(canTransitionLeave("submitted", "reviewed")).toBe(true);
    expect(canTransitionLeave("submitted", "approved")).toBe(false);
  });

  it("finds overlapping active leave", () => {
    const current: LeaveRequest = {
      id: "leave-1", tenantId: "tenant-a", subjectType: "student", subjectPersonId: "s-1",
      startsOn: "2026-08-20", endsOn: "2026-08-22", state: "approved"
    };
    expect(leaveOverlaps({ ...current, id: "leave-2", startsOn: "2026-08-22", endsOn: "2026-08-24" }, [current])).toBe(true);
  });
});
