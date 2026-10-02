export type DirectStudentCreateInput = {
  displayName: string;
  nameNative?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other" | "undisclosed";
  preferredLocale: "en" | "ur";
  sessionId: number;
  programId: number;
  groupId?: number;
  joinedOn?: string;
  medicalSummary?: string;
  accessibilityNeeds?: string;
  pickupRestrictions?: string;
  guardian?: {
    name: string;
    relationship: "father" | "mother" | "guardian";
    phone?: string;
  };
  confirmNewPerson?: boolean;
};

type ValidationResult = {
  value?: DirectStudentCreateInput;
  errors: string[];
};

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) return undefined;
  return cleaned;
}

function optionalDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return undefined;
  return value;
}

function positiveInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

export function validateDirectStudentCreateInput(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { errors: ["Request body must be an object."] };
  }
  const body = input as Record<string, unknown>;
  const errors: string[] = [];

  const displayName = text(body.displayName, 160);
  if (!displayName || displayName.length < 2) errors.push("Student name is required.");

  const sessionId = positiveInt(body.sessionId);
  if (!sessionId) errors.push("Academic session is required.");
  const programId = positiveInt(body.programId);
  if (!programId) errors.push("Program is required.");

  const locale = body.preferredLocale;
  const preferredLocale = locale === "en" || locale === "ur" ? locale : undefined;
  if (!preferredLocale) errors.push("Preferred language is invalid.");

  const genderValue = body.gender;
  const gender = genderValue === "male" || genderValue === "female" || genderValue === "other" || genderValue === "undisclosed"
    ? genderValue
    : undefined;
  if (genderValue && !gender) errors.push("Gender is invalid.");

  const dateOfBirth = optionalDate(body.dateOfBirth);
  if (body.dateOfBirth && !dateOfBirth) errors.push("Date of birth is invalid.");
  const joinedOn = optionalDate(body.joinedOn);
  if (body.joinedOn && !joinedOn) errors.push("Joining date is invalid.");

  const groupId = body.groupId === undefined || body.groupId === null || body.groupId === ""
    ? undefined
    : positiveInt(body.groupId);
  if (body.groupId && !groupId) errors.push("Class/group is invalid.");

  let guardian: DirectStudentCreateInput["guardian"];
  if (body.guardian !== undefined && body.guardian !== null) {
    if (typeof body.guardian !== "object" || Array.isArray(body.guardian)) {
      errors.push("Guardian details are invalid.");
    } else {
      const raw = body.guardian as Record<string, unknown>;
      const name = text(raw.name, 160);
      const relationship = raw.relationship === "father" || raw.relationship === "mother" || raw.relationship === "guardian"
        ? raw.relationship
        : undefined;
      const phone = raw.phone === undefined || raw.phone === "" ? undefined : text(raw.phone, 80);
      if (!name || name.length < 2) errors.push("Guardian name is invalid.");
      if (!relationship) errors.push("Guardian relationship is invalid.");
      if (raw.phone && !phone) errors.push("Guardian phone is invalid.");
      if (name && relationship) guardian = { name, relationship, phone };
    }
  }

  if (errors.length || !displayName || !sessionId || !programId || !preferredLocale) return { errors };

  return {
    value: {
      displayName,
      nameNative: text(body.nameNative, 160),
      dateOfBirth,
      gender,
      preferredLocale,
      sessionId,
      programId,
      groupId,
      joinedOn,
      medicalSummary: text(body.medicalSummary, 1000),
      accessibilityNeeds: text(body.accessibilityNeeds, 1000),
      pickupRestrictions: text(body.pickupRestrictions, 1000),
      guardian,
      confirmNewPerson: body.confirmNewPerson === true
    },
    errors: []
  };
}
