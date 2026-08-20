export type AttendanceCategory = "present" | "absent" | "late" | "leave" | "excused" | "unmarked";

export type AttendanceStatus = {
  key: string;
  category: AttendanceCategory;
  presenceRatio: number;
  triggersAlert: boolean;
};

export type RosterMember = {
  enrollmentId: string;
  studentPersonId: string;
  enrollmentStatus: string;
  groupId: string;
};

export type AttendanceMark = {
  enrollmentId: string;
  statusKey: string;
  note?: string;
};

export type AttendanceSubmission = {
  tenantId: string;
  rosterId: string;
  idempotencyKey: string;
  members: readonly RosterMember[];
  marks: readonly AttendanceMark[];
};

export type LeaveState = "draft" | "submitted" | "reviewed" | "approved" | "rejected" | "active" | "returned" | "closed" | "cancelled";

export type LeaveRequest = {
  id: string;
  tenantId: string;
  subjectType: "student" | "employee" | "hostel_resident";
  subjectPersonId: string;
  startsOn: string;
  endsOn: string;
  state: LeaveState;
};
