import type { AttendanceStatus, AttendanceSubmission, LeaveRequest, LeaveState } from "./model";

const leaveTransitions: Record<LeaveState, readonly LeaveState[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["reviewed", "cancelled"],
  reviewed: ["approved", "rejected"],
  approved: ["active", "cancelled"],
  rejected: [],
  active: ["returned", "closed"],
  returned: ["closed"],
  closed: [],
  cancelled: []
};

export function validateAttendanceSubmission(submission: AttendanceSubmission): string[] {
  const issues: string[] = [];
  if (submission.idempotencyKey.trim().length < 16) issues.push("idempotency_key_too_short");

  const rosterIds = new Set(
    submission.members
      .filter((member) => member.enrollmentStatus === "active")
      .map((member) => member.enrollmentId)
  );
  const marked = new Set<string>();

  for (const mark of submission.marks) {
    if (!rosterIds.has(mark.enrollmentId)) issues.push(`unrelated_enrollment:${mark.enrollmentId}`);
    if (marked.has(mark.enrollmentId)) issues.push(`duplicate_mark:${mark.enrollmentId}`);
    marked.add(mark.enrollmentId);
  }
  return issues;
}

export function attendancePercentage(
  statusKeys: readonly string[],
  statuses: ReadonlyMap<string, AttendanceStatus>
): number | null {
  let earned = 0;
  let possible = 0;

  for (const key of statusKeys) {
    const status = statuses.get(key);
    if (!status || status.category === "unmarked") continue;
    earned += status.presenceRatio;
    possible += 1;
  }
  return possible === 0 ? null : Math.round((earned / possible) * 10_000) / 100;
}

export function canTransitionLeave(from: LeaveState, to: LeaveState): boolean {
  return leaveTransitions[from].includes(to);
}

export function leaveOverlaps(candidate: LeaveRequest, existing: readonly LeaveRequest[]): boolean {
  const start = Date.parse(`${candidate.startsOn}T00:00:00.000Z`);
  const end = Date.parse(`${candidate.endsOn}T00:00:00.000Z`);
  return existing.some((item) =>
    item.id !== candidate.id &&
    item.tenantId === candidate.tenantId &&
    item.subjectPersonId === candidate.subjectPersonId &&
    !["rejected", "cancelled"].includes(item.state) &&
    start <= Date.parse(`${item.endsOn}T00:00:00.000Z`) &&
    end >= Date.parse(`${item.startsOn}T00:00:00.000Z`)
  );
}
