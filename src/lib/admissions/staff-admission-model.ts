export type StaffAdmissionInput = {
  draftId?: number;
  displayName?: string;
  nameNative?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other" | "undisclosed";
  preferredLocale: "en" | "ur";
  sessionId: number;
  programId: number;
  groupId?: number;
  joinedOn?: string;
  guardianName?: string;
  guardianEmail?: string;
  guardianPhone?: string;
  guardianRelationship?: "father" | "mother" | "guardian" | "other";
  medicalSummary?: string;
  accessibilityNeeds?: string;
  pickupRestrictions?: string;
  photoToken?: string;
  confirmNewPerson?: boolean;
};

type ValidationOptions = {
  final?: boolean;
};

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= maxLength ? cleaned : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}

function cleanDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return undefined;
  }
  return value;
}

export function validateStaffAdmissionInput(
  body: unknown,
  options: ValidationOptions = {}
): { value?: StaffAdmissionInput; errors: string[] } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: ["Request body must be an object."] };
  }

  const input = body as Record<string, unknown>;
  const errors: string[] = [];
  const final = options.final === true;

  const draftId =
    input.draftId === undefined || input.draftId === null
      ? undefined
      : positiveInteger(input.draftId);
  if (input.draftId !== undefined && input.draftId !== null && !draftId) {
    errors.push("Draft id is invalid.");
  }

  const sessionId = positiveInteger(input.sessionId);
  const programId = positiveInteger(input.programId);
  if (!sessionId) errors.push("Academic session is required.");
  if (!programId) errors.push("Program is required.");

  const groupId =
    input.groupId === undefined || input.groupId === null || input.groupId === ""
      ? undefined
      : positiveInteger(input.groupId);
  if (input.groupId && !groupId) errors.push("Class/group is invalid.");
  if (final && !groupId) errors.push("Class/group is required.");

  const locale =
    input.preferredLocale === "en" || input.preferredLocale === "ur"
      ? input.preferredLocale
      : undefined;
  if (!locale) errors.push("Preferred language is invalid.");

  const displayName = cleanText(input.displayName, 160);
  if (input.displayName && !displayName) errors.push("Student name is invalid.");
  if (final && (!displayName || displayName.length < 2)) {
    errors.push("Student name is required.");
  }

  const nameNative = cleanText(input.nameNative, 160);
  if (input.nameNative && !nameNative) errors.push("Native student name is invalid.");
  if (final && (!nameNative || nameNative.length < 2)) {
    errors.push("Native student name is required.");
  }

  const dateOfBirth = cleanDate(input.dateOfBirth);
  if (input.dateOfBirth && !dateOfBirth) errors.push("Date of birth is invalid.");

  const joinedOn = cleanDate(input.joinedOn);
  if (input.joinedOn && !joinedOn) errors.push("Joining date is invalid.");
  if (final && !joinedOn) errors.push("Joining date is required.");

  const gender =
    input.gender === "male" ||
    input.gender === "female" ||
    input.gender === "other" ||
    input.gender === "undisclosed"
      ? input.gender
      : undefined;
  if (input.gender && !gender) errors.push("Gender is invalid.");
  if (final && !gender) errors.push("Gender is required.");

  const guardianName = cleanText(input.guardianName, 160);
  if (input.guardianName && !guardianName) errors.push("Guardian name is invalid.");
  if (final && (!guardianName || guardianName.length < 2)) {
    errors.push("Guardian name is required.");
  }

  const guardianEmail = cleanText(input.guardianEmail, 320)?.toLowerCase();
  if (
    input.guardianEmail &&
    (!guardianEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail))
  ) {
    errors.push("Guardian email is invalid.");
  }
  if (final && !guardianEmail) errors.push("Guardian email is required.");

  const guardianPhone = cleanText(input.guardianPhone, 80);
  if (input.guardianPhone && !guardianPhone) errors.push("Guardian phone is invalid.");

  const guardianRelationship =
    input.guardianRelationship === "father" ||
    input.guardianRelationship === "mother" ||
    input.guardianRelationship === "guardian" ||
    input.guardianRelationship === "other"
      ? input.guardianRelationship
      : undefined;
  if (input.guardianRelationship && !guardianRelationship) {
    errors.push("Guardian relationship is invalid.");
  }
  if (final && !guardianRelationship) {
    errors.push("Guardian relationship is required.");
  }

  const photoToken = cleanText(input.photoToken, 80);
  if (input.photoToken && (!photoToken || !/^[A-Za-z0-9_-]{40,80}$/.test(photoToken))) {
    errors.push("Student photo token is invalid.");
  }

  if (errors.length || !sessionId || !programId || !locale) {
    return { errors };
  }

  return {
    errors: [],
    value: {
      draftId,
      displayName,
      nameNative,
      dateOfBirth,
      gender,
      preferredLocale: locale,
      sessionId,
      programId,
      groupId,
      joinedOn,
      guardianName,
      guardianEmail,
      guardianPhone,
      guardianRelationship,
      medicalSummary: cleanText(input.medicalSummary, 1000),
      accessibilityNeeds: cleanText(input.accessibilityNeeds, 1000),
      pickupRestrictions: cleanText(input.pickupRestrictions, 1000),
      photoToken,
      confirmNewPerson: input.confirmNewPerson === true
    }
  };
}

export function staffAdmissionApplicantData(value: StaffAdmissionInput) {
  return {
    applicant_name: value.displayName ?? "",
    native_name: value.nameNative ?? "",
    date_of_birth: value.dateOfBirth ?? "",
    gender: value.gender ?? "",
    joining_date: value.joinedOn ?? "",
    guardian_name: value.guardianName ?? "",
    guardian_email: value.guardianEmail ?? "",
    guardian_phone: value.guardianPhone ?? "",
    guardian_relationship: value.guardianRelationship ?? "",
    medical_summary: value.medicalSummary ?? "",
    accessibility_needs: value.accessibilityNeeds ?? "",
    pickup_restrictions: value.pickupRestrictions ?? ""
  };
}
