import type {
  AcademicGroup,
  AcademicSession,
  Enrollment,
  PersonRelationship,
  Program,
  TimetableEntry
} from "./model";

export type ValidationIssue = {
  code: string;
  field: string;
  message: string;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const clockPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function dateValue(value: string): number {
  return isoDatePattern.test(value) ? Date.parse(`${value}T00:00:00.000Z`) : Number.NaN;
}

function clockMinutes(value: string): number {
  if (!clockPattern.test(value)) return Number.NaN;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function validateSession(session: AcademicSession): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const start = dateValue(session.startsOn);
  const end = dateValue(session.endsOn);

  if (!Number.isFinite(start)) {
    issues.push({ code: "invalid_date", field: "startsOn", message: "Start date must use YYYY-MM-DD" });
  }
  if (!Number.isFinite(end)) {
    issues.push({ code: "invalid_date", field: "endsOn", message: "End date must use YYYY-MM-DD" });
  }
  if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
    issues.push({ code: "invalid_range", field: "endsOn", message: "Session must end after it starts" });
  }
  if (Object.values(session.labels).some((label) => label.trim().length < 2)) {
    issues.push({ code: "missing_label", field: "labels", message: "English, Urdu, and Arabic labels are required" });
  }

  return issues;
}

export function validateEnrollment(
  enrollment: Enrollment,
  program: Program,
  session: AcademicSession,
  existing: readonly Enrollment[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const start = dateValue(enrollment.startsOn);
  const end = enrollment.endsOn ? dateValue(enrollment.endsOn) : undefined;

  if (enrollment.tenantId !== program.tenantId || enrollment.tenantId !== session.tenantId) {
    issues.push({ code: "tenant_mismatch", field: "tenantId", message: "Enrollment context must remain inside one tenant" });
  }
  if (enrollment.programId !== program.id || enrollment.sessionId !== session.id) {
    issues.push({ code: "scope_mismatch", field: "programId", message: "Enrollment must reference supplied program and session" });
  }
  if (!Number.isFinite(start) || start < dateValue(session.startsOn) || start > dateValue(session.endsOn)) {
    issues.push({ code: "outside_session", field: "startsOn", message: "Enrollment start must fall inside session dates" });
  }
  if (end !== undefined && (!Number.isFinite(end) || end < start)) {
    issues.push({ code: "invalid_range", field: "endsOn", message: "Enrollment end cannot precede its start" });
  }

  const duplicate = existing.some((item) =>
    item.id !== enrollment.id &&
    item.tenantId === enrollment.tenantId &&
    item.studentId === enrollment.studentId &&
    item.sessionId === enrollment.sessionId &&
    item.programId === enrollment.programId &&
    item.status === "active"
  );
  if (duplicate) {
    issues.push({ code: "duplicate_active_enrollment", field: "studentId", message: "Student already has an active enrollment in this program" });
  }

  if (!program.allowsConcurrentEnrollment) {
    const conflict = existing.some((item) =>
      item.id !== enrollment.id &&
      item.tenantId === enrollment.tenantId &&
      item.studentId === enrollment.studentId &&
      item.sessionId === enrollment.sessionId &&
      item.status === "active"
    );
    if (conflict) {
      issues.push({ code: "concurrent_enrollment_blocked", field: "programId", message: "Program blocks concurrent enrollment" });
    }
  }

  return issues;
}

export function validateGroupCapacity(
  group: AcademicGroup,
  activeEnrollments: readonly Enrollment[]
): ValidationIssue[] {
  if (group.capacity === undefined) return [];
  const count = activeEnrollments.filter((item) => item.groupId === group.id && item.status === "active").length;
  return count <= group.capacity
    ? []
    : [{ code: "capacity_exceeded", field: "capacity", message: `Group capacity exceeded by ${count - group.capacity}` }];
}

export function timetableConflicts(entries: readonly TimetableEntry[]): Array<[string, string]> {
  const conflicts: Array<[string, string]> = [];

  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    const left = entries[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const right = entries[rightIndex];
      if (
        left.tenantId !== right.tenantId ||
        left.branchId !== right.branchId ||
        left.weekday !== right.weekday ||
        clockMinutes(left.startsAt) >= clockMinutes(right.endsAt) ||
        clockMinutes(right.startsAt) >= clockMinutes(left.endsAt)
      ) continue;

      const sameGroup = left.groupId === right.groupId;
      const sameTeacher = Boolean(left.teacherPersonId && left.teacherPersonId === right.teacherPersonId);
      if (sameGroup || sameTeacher) conflicts.push([left.id, right.id]);
    }
  }

  return conflicts;
}

export function relationshipAllowsPortal(
  relationship: PersonRelationship,
  requestedAction: "read_profile" | "read_results" | "collect_student"
): boolean {
  if (!relationship.verified || relationship.portalVisibility === "none") return false;
  if (requestedAction === "collect_student") return relationship.canCollectStudent;
  if (requestedAction === "read_results") return relationship.portalVisibility === "standard";
  return true;
}
