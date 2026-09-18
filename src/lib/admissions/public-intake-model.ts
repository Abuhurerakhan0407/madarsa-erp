export const publicAdmissionLocales = ["en", "ur"] as const;

export type PublicAdmissionLocale = (typeof publicAdmissionLocales)[number];

export type PublicAdmissionField = {
  key: string;
  type: string;
  labels: Record<string, string>;
  required?: boolean;
};

export type PublicAdmissionSection = {
  key: string;
  labels: Record<string, string>;
  fields: PublicAdmissionField[];
};

export type PublicAdmissionSubmission = {
  sessionKey: string;
  programKey: string;
  preferredLocale: PublicAdmissionLocale;
  consent: true;
  answers: Record<string, string>;
};

const sessionKeyPattern = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const programKeyPattern = /^[a-z][a-z0-9_]{1,63}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+()\-\s]{6,40}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const groupKeyPattern = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const genders = new Set(["male", "female", "other", "undisclosed"]);
const guardianRelationships = new Set(["father", "mother", "guardian", "other"]);

export function normalizePublicAdmissionLocale(value: unknown): PublicAdmissionLocale {
  return publicAdmissionLocales.includes(value as PublicAdmissionLocale)
    ? (value as PublicAdmissionLocale)
    : "en";
}

function maxLengthForType(type: string): number {
  if (type === "email") return 320;
  if (type === "phone") return 40;
  if (type === "date") return 10;
  if (type === "long_text") return 2000;
  return 240;
}

function isValidFieldValue(type: string, value: string): boolean {
  if (!value) return true;
  if (type === "email") return emailPattern.test(value);
  if (type === "phone") return phonePattern.test(value);
  if (type === "date") {
    if (!datePattern.test(value)) return false;
    const parsed = Date.parse(`${value}T00:00:00.000Z`);
    return value.slice(0, 4) !== "0000"
      && Number.isFinite(parsed)
      && new Date(parsed).toISOString().slice(0, 10) === value;
  }
  return true;
}

function fieldSpecificError(key: string, value: string): string | null {
  if (
    ["applicant_name", "native_name", "guardian_name"].includes(key)
    && value
    && (value.length < 2 || value.length > 160)
  ) {
    return `${key} must contain between 2 and 160 characters.`;
  }
  if (key === "gender" && value && !genders.has(value)) {
    return "gender has an invalid value.";
  }
  if (key === "guardian_relationship" && value && !guardianRelationships.has(value)) {
    return "guardian_relationship has an invalid value.";
  }
  if (key === "group_key" && value && !groupKeyPattern.test(value)) {
    return "group_key has an invalid value.";
  }
  return null;
}

export function validatePublicAdmissionSubmission(
  body: unknown,
  sections: readonly PublicAdmissionSection[]
): { value?: PublicAdmissionSubmission; errors: string[] } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: ["Request body must be an object."] };
  }

  const input = body as Record<string, unknown>;
  const errors: string[] = [];
  const sessionKey = typeof input.sessionKey === "string" ? input.sessionKey.trim() : "";
  const programKey = typeof input.programKey === "string" ? input.programKey.trim() : "";
  const preferredLocale = normalizePublicAdmissionLocale(input.preferredLocale);
  const consent = input.consent === true;
  const rawAnswers = input.answers;

  if (!sessionKeyPattern.test(sessionKey)) errors.push("Session selection is invalid.");
  if (!programKeyPattern.test(programKey)) errors.push("Program selection is invalid.");
  if (!publicAdmissionLocales.includes(input.preferredLocale as PublicAdmissionLocale)) {
    errors.push("Preferred language is invalid.");
  }
  if (!consent) errors.push("Consent is required before submission.");

  if (!rawAnswers || typeof rawAnswers !== "object" || Array.isArray(rawAnswers)) {
    errors.push("Answers must be an object.");
    return { errors };
  }

  const fieldMap = new Map(
    sections.flatMap((section) => section.fields.map((field) => [field.key, field] as const))
  );
  const answerEntries = Object.entries(rawAnswers as Record<string, unknown>);
  if (answerEntries.length > 50) errors.push("Too many form answers were submitted.");

  const answers: Record<string, string> = {};
  for (const [key, rawValue] of answerEntries) {
    const field = fieldMap.get(key);
    if (!field) {
      errors.push(`Unknown form field: ${key}.`);
      continue;
    }
    if (typeof rawValue !== "string") {
      errors.push(`${key} must be text.`);
      continue;
    }

    const value = rawValue.trim();
    const specificError = fieldSpecificError(key, value);
    if (specificError) {
      errors.push(specificError);
      continue;
    }
    if (value.length > maxLengthForType(field.type)) {
      errors.push(`${key} is too long.`);
      continue;
    }
    if (!isValidFieldValue(field.type, value)) {
      errors.push(`${key} has an invalid value.`);
      continue;
    }
    answers[key] = value;
  }

  for (const field of fieldMap.values()) {
    if (field.required && !answers[field.key]) {
      errors.push(`${field.key} is required.`);
    }
  }

  if (JSON.stringify(answers).length > 20_000) {
    errors.push("Application answers are too large.");
  }

  if (errors.length > 0) return { errors };

  return {
    errors: [],
    value: {
      sessionKey,
      programKey,
      preferredLocale,
      consent: true,
      answers
    }
  };
}
