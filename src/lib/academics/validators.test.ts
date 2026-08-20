import { describe, expect, it } from "vitest";
import type { AcademicGroup, AcademicSession, Enrollment, PersonRelationship, Program, TimetableEntry } from "./model";
import { relationshipAllowsPortal, timetableConflicts, validateEnrollment, validateGroupCapacity, validateSession } from "./validators";

const session: AcademicSession = {
  id: "session-1",
  tenantId: "tenant-a",
  key: "2026-27",
  labels: { en: "2026-27", ur: "تعلیمی سال", ar: "العام الدراسي" },
  startsOn: "2026-04-01",
  endsOn: "2027-03-31",
  status: "active"
};

const program: Program = {
  id: "program-1",
  tenantId: "tenant-a",
  key: "hifz",
  labels: { en: "Hifz", ur: "حفظ", ar: "تحفيظ" },
  type: "hifz",
  allowsConcurrentEnrollment: true,
  status: "active"
};

const enrollment: Enrollment = {
  id: "enrollment-1",
  tenantId: "tenant-a",
  studentId: "student-1",
  sessionId: "session-1",
  programId: "program-1",
  groupId: "group-1",
  startsOn: "2026-04-01",
  status: "active"
};

describe("academic validators", () => {
  it("requires complete multilingual session labels", () => {
    expect(validateSession({ ...session, labels: { ...session.labels, ar: "" } })).toContainEqual(
      expect.objectContaining({ code: "missing_label" })
    );
  });

  it("rejects cross-tenant enrollment context", () => {
    expect(validateEnrollment({ ...enrollment, tenantId: "tenant-b" }, program, session, [])).toContainEqual(
      expect.objectContaining({ code: "tenant_mismatch" })
    );
  });

  it("blocks duplicate active enrollment", () => {
    expect(validateEnrollment({ ...enrollment, id: "enrollment-2" }, program, session, [enrollment])).toContainEqual(
      expect.objectContaining({ code: "duplicate_active_enrollment" })
    );
  });

  it("allows general plus Hifz when concurrency is enabled", () => {
    const general: Enrollment = { ...enrollment, id: "general", programId: "general" };
    expect(validateEnrollment(enrollment, program, session, [general])).toEqual([]);
  });

  it("detects exceeded group capacity", () => {
    const group: AcademicGroup = {
      id: "group-1",
      tenantId: "tenant-a",
      branchId: "branch-1",
      sessionId: "session-1",
      programId: "program-1",
      key: "a",
      labels: { en: "Group A", ur: "جماعت الف", ar: "حلقة أ" },
      capacity: 1
    };
    expect(validateGroupCapacity(group, [enrollment, { ...enrollment, id: "enrollment-2" }])).toContainEqual(
      expect.objectContaining({ code: "capacity_exceeded" })
    );
  });

  it("finds teacher and group timetable conflicts", () => {
    const base: TimetableEntry = {
      id: "slot-1",
      tenantId: "tenant-a",
      branchId: "branch-1",
      sessionId: "session-1",
      groupId: "group-1",
      teacherPersonId: "teacher-1",
      weekday: 1,
      startsAt: "09:00",
      endsAt: "10:00",
      effectiveFrom: "2026-04-01"
    };
    expect(timetableConflicts([base, { ...base, id: "slot-2", groupId: "group-2", startsAt: "09:30" }])).toEqual([
      ["slot-1", "slot-2"]
    ]);
  });

  it("enforces verified guardian visibility", () => {
    const relationship: PersonRelationship = {
      sourcePersonId: "guardian-1",
      targetPersonId: "student-1",
      type: "guardian",
      verified: true,
      canCollectStudent: false,
      portalVisibility: "standard"
    };
    expect(relationshipAllowsPortal(relationship, "read_results")).toBe(true);
    expect(relationshipAllowsPortal(relationship, "collect_student")).toBe(false);
  });
});
