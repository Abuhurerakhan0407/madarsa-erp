import { validateDirectStudentCreateInput, type DirectStudentCreateInput } from "@/lib/students/direct-create-model";

export type WalkInAdmissionInput = DirectStudentCreateInput & {
  ageYears?: number;
};

type WalkInValidationResult = {
  value?: WalkInAdmissionInput;
  errors: string[];
};

function reportedAge(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 120) return undefined;
  return value;
}

export function validateWalkInAdmissionInput(input: unknown): WalkInValidationResult {
  const base = validateDirectStudentCreateInput(input);
  const errors = [...base.errors];
  if (!input || typeof input !== "object" || Array.isArray(input) || !base.value) {
    return { errors };
  }

  const body = input as Record<string, unknown>;
  const ageYears = reportedAge(body.ageYears);
  if (body.ageYears !== undefined && body.ageYears !== null && body.ageYears !== "" && !ageYears) {
    errors.push("Age must be a whole number between 1 and 120.");
  }

  if (!base.value.dateOfBirth && !ageYears) {
    errors.push("Date of birth or age is required.");
  }

  if (!base.value.groupId) {
    errors.push("Class/group is required.");
  }

  if (!base.value.guardian) {
    errors.push("Guardian details are required.");
  } else {
    const phone = base.value.guardian.phone?.trim() ?? "";
    if (phone.length < 6) errors.push("Guardian phone is required.");
  }

  if (errors.length) return { errors };
  return {
    value: {
      ...base.value,
      ageYears
    },
    errors: []
  };
}
