export const admissionStaffActions = [
  "start_review",
  "complete_review",
  "offer",
  "waitlist",
  "reject"
] as const;

export type AdmissionStaffAction = (typeof admissionStaffActions)[number];

export type AdmissionStaffActionInput = {
  applicationId: number;
  action: AdmissionStaffAction;
  reason?: string;
};

const actionSet = new Set<string>(admissionStaffActions);

export function validateAdmissionStaffAction(body: unknown): {
  value?: AdmissionStaffActionInput;
  errors: string[];
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: ["Request body must be an object."] };
  }

  const input = body as Record<string, unknown>;
  const applicationId = typeof input.applicationId === "number" ? input.applicationId : NaN;
  const action = typeof input.action === "string" ? input.action.trim() : "";
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  const errors: string[] = [];

  if (!Number.isSafeInteger(applicationId) || applicationId <= 0) {
    errors.push("Application id is invalid.");
  }
  if (!actionSet.has(action)) {
    errors.push("Admission action is invalid.");
  }
  if (reason.length > 2000) {
    errors.push("Reason is too long.");
  }
  if (["offer", "waitlist", "reject"].includes(action) && reason.length < 8) {
    errors.push("Decision reason must contain at least 8 characters.");
  }

  if (errors.length > 0) return { errors };

  return {
    errors: [],
    value: {
      applicationId,
      action: action as AdmissionStaffAction,
      ...(reason ? { reason } : {})
    }
  };
}
