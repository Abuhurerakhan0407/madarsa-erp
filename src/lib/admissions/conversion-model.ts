export type AdmissionConversionInput = {
  applicationId: number;
  confirmNewPerson: boolean;
};

export type AdmissionConversionValidation = {
  value: AdmissionConversionInput | null;
  errors: string[];
};

export function validateAdmissionConversionInput(input: unknown): AdmissionConversionValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { value: null, errors: ["Conversion request must be an object."] };
  }

  const record = input as Record<string, unknown>;
  const allowedKeys = new Set(["applicationId", "confirmNewPerson"]);
  const unknownKeys = Object.keys(record).filter((key) => !allowedKeys.has(key));
  const errors: string[] = [];

  if (unknownKeys.length > 0) {
    errors.push("Conversion request contains unsupported fields.");
  }

  if (!Number.isSafeInteger(record.applicationId) || (record.applicationId as number) <= 0) {
    errors.push("A valid application id is required.");
  }

  if (
    record.confirmNewPerson !== undefined &&
    typeof record.confirmNewPerson !== "boolean"
  ) {
    errors.push("Duplicate confirmation must be a boolean.");
  }

  if (errors.length > 0) return { value: null, errors };

  return {
    value: {
      applicationId: record.applicationId as number,
      confirmNewPerson: record.confirmNewPerson === true
    },
    errors: []
  };
}
