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

export type AttendanceSource = "manual" | "biometric" | "nfc" | "import";

export type AttendanceMarkInput = {
  attendanceSessionId: number;
  personId: number;
  statusKey: string;
  source: AttendanceSource;
  sourceRef?: string;
  note?: string;
};

export type AttendanceCorrectionInput = {
  attendanceRecordId: number;
  statusKey: string;
  reason: string;
};

type Validation<T> = { value?: T; errors: string[] };

function positiveInteger(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= max ? cleaned : undefined;
}

export function validateAttendanceDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : value;
}

export function validateAttendanceMarkInput(input: unknown): Validation<AttendanceMarkInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { errors: ["Request body must be an object."] };
  const body = input as Record<string, unknown>;
  const errors: string[] = [];
  const attendanceSessionId = positiveInteger(body.attendanceSessionId);
  const personId = positiveInteger(body.personId);
  const statusKey = text(body.statusKey, 64);
  const source = body.source === "biometric" || body.source === "nfc" || body.source === "import" ? body.source : body.source === undefined || body.source === "manual" ? "manual" : undefined;
  const sourceRef = body.sourceRef === undefined || body.sourceRef === null || body.sourceRef === "" ? undefined : text(body.sourceRef, 160);
  const note = body.note === undefined || body.note === null || body.note === "" ? undefined : text(body.note, 500);
  if (!attendanceSessionId) errors.push("Attendance session is invalid.");
  if (!personId) errors.push("Student is invalid.");
  if (!statusKey) errors.push("Attendance status is invalid.");
  if (!source) errors.push("Attendance source is invalid.");
  if (body.sourceRef && !sourceRef) errors.push("Attendance source reference is invalid.");
  if (body.note && !note) errors.push("Attendance note is invalid.");
  if (errors.length || !attendanceSessionId || !personId || !statusKey || !source) return { errors };
  return { value: { attendanceSessionId, personId, statusKey, source, sourceRef, note }, errors: [] };
}

export function validateAttendanceCorrectionInput(input: unknown): Validation<AttendanceCorrectionInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { errors: ["Request body must be an object."] };
  const body = input as Record<string, unknown>;
  const errors: string[] = [];
  const attendanceRecordId = positiveInteger(body.attendanceRecordId);
  const statusKey = text(body.statusKey, 64);
  const reason = text(body.reason, 500);
  if (!attendanceRecordId) errors.push("Attendance record is invalid.");
  if (!statusKey) errors.push("Attendance status is invalid.");
  if (!reason || reason.length < 8) errors.push("Correction reason must be at least 8 characters.");
  if (errors.length || !attendanceRecordId || !statusKey || !reason) return { errors };
  return { value: { attendanceRecordId, statusKey, reason }, errors: [] };
}
