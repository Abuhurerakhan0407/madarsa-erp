export const programTypes = [
  "general",
  "hifz",
  "nazra",
  "qaida",
  "dars_e_nizami",
  "custom"
] as const;

export type ProgramType = (typeof programTypes)[number];

export const enrollmentStatuses = [
  "planned",
  "active",
  "paused",
  "transferred",
  "completed",
  "withdrawn",
  "cancelled"
] as const;

export type EnrollmentStatus = (typeof enrollmentStatuses)[number];

export const relationshipTypes = [
  "father",
  "mother",
  "guardian",
  "sibling",
  "spouse",
  "child",
  "emergency_contact",
  "other"
] as const;

export type RelationshipType = (typeof relationshipTypes)[number];

export type LocalizedName = {
  en: string;
  ur: string;
  ar: string;
};

export type AcademicSession = {
  id: string;
  tenantId: string;
  key: string;
  labels: LocalizedName;
  startsOn: string;
  endsOn: string;
  status: "draft" | "active" | "closing" | "closed" | "archived";
};

export type Program = {
  id: string;
  tenantId: string;
  branchId?: string;
  key: string;
  labels: LocalizedName;
  type: ProgramType;
  allowsConcurrentEnrollment: boolean;
  status: "active" | "inactive" | "archived";
};

export type AcademicLevel = {
  id: string;
  tenantId: string;
  programId: string;
  key: string;
  labels: LocalizedName;
  sequence: number;
};

export type AcademicGroup = {
  id: string;
  tenantId: string;
  branchId: string;
  sessionId: string;
  programId: string;
  levelId?: string;
  key: string;
  labels: LocalizedName;
  capacity?: number;
};

export type Enrollment = {
  id: string;
  tenantId: string;
  studentId: string;
  sessionId: string;
  programId: string;
  levelId?: string;
  groupId?: string;
  startsOn: string;
  endsOn?: string;
  status: EnrollmentStatus;
};

export type TimetableEntry = {
  id: string;
  tenantId: string;
  branchId: string;
  sessionId: string;
  groupId: string;
  subjectId?: string;
  teacherPersonId?: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  effectiveFrom: string;
  effectiveTo?: string;
};

export type PersonRelationship = {
  sourcePersonId: string;
  targetPersonId: string;
  type: RelationshipType;
  verified: boolean;
  canCollectStudent: boolean;
  portalVisibility: "none" | "limited" | "standard";
};

export type DocumentMetadata = {
  tenantId: string;
  ownerPersonId?: string;
  category: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  expiresOn?: string;
};
