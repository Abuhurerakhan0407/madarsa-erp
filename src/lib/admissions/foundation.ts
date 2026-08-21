import type { LocalizedLabels, StatusNode, StatusTransition } from "../configuration/model";
import { validateStatusMachine } from "../configuration/validators";

export const admissionProgramTypes = [
  "general",
  "hifz",
  "nazra",
  "qaida",
  "dars_e_nizami",
  "custom"
] as const;

export type AdmissionProgramType = (typeof admissionProgramTypes)[number];

export type AdmissionsFoundationInput = {
  sessionKey: string;
  sessionLabels: LocalizedLabels;
  startsOn: string;
  endsOn: string;
  programKey: string;
  programLabels: LocalizedLabels;
  programType: AdmissionProgramType;
};

const sessionKeyPattern = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const programKeyPattern = /^[a-z][a-z0-9_]{1,63}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function localizedLabels(value: unknown): LocalizedLabels | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const en = typeof candidate.en === "string" ? candidate.en.trim() : "";
  const ur = typeof candidate.ur === "string" ? candidate.ur.trim() : "";
  const ar = typeof candidate.ar === "string" ? candidate.ar.trim() : "";
  if (!en || !ur || !ar || en.length > 120 || ur.length > 120 || ar.length > 120) return null;
  return { en, ur, ar };
}

export function parseAdmissionsFoundationInput(body: unknown): {
  value?: AdmissionsFoundationInput;
  errors: string[];
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: ["Request body must be an object."] };
  }

  const input = body as Record<string, unknown>;
  const errors: string[] = [];
  const sessionKey = typeof input.sessionKey === "string" ? input.sessionKey.trim() : "";
  const programKey = typeof input.programKey === "string" ? input.programKey.trim() : "";
  const startsOn = typeof input.startsOn === "string" ? input.startsOn : "";
  const endsOn = typeof input.endsOn === "string" ? input.endsOn : "";
  const sessionLabels = localizedLabels(input.sessionLabels);
  const programLabels = localizedLabels(input.programLabels);
  const programType = typeof input.programType === "string" ? input.programType : "";

  if (!sessionKeyPattern.test(sessionKey)) errors.push("Session key is invalid.");
  if (!programKeyPattern.test(programKey)) errors.push("Program key is invalid.");
  if (!sessionLabels) errors.push("English, Urdu and Arabic session labels are required.");
  if (!programLabels) errors.push("English, Urdu and Arabic program labels are required.");
  if (!admissionProgramTypes.includes(programType as AdmissionProgramType)) {
    errors.push("Program type is invalid.");
  }

  if (!datePattern.test(startsOn) || !datePattern.test(endsOn)) {
    errors.push("Session dates must use YYYY-MM-DD.");
  } else {
    const start = Date.parse(`${startsOn}T00:00:00.000Z`);
    const end = Date.parse(`${endsOn}T00:00:00.000Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      errors.push("Session end date must be after its start date.");
    }
  }

  if (errors.length > 0 || !sessionLabels || !programLabels) return { errors };

  return {
    errors: [],
    value: {
      sessionKey,
      sessionLabels,
      startsOn,
      endsOn,
      programKey,
      programLabels,
      programType: programType as AdmissionProgramType
    }
  };
}

const labels = (en: string, ur: string, ar: string): LocalizedLabels => ({ en, ur, ar });

export const defaultAdmissionFormSections = [
  {
    key: "applicant",
    labels: labels("Applicant details", "درخواست گزار کی معلومات", "بيانات المتقدم"),
    fields: [
      {
        key: "applicant_name",
        type: "short_text",
        labels: labels("Applicant name", "درخواست گزار کا نام", "اسم المتقدم"),
        required: true
      },
      {
        key: "date_of_birth",
        type: "date",
        labels: labels("Date of birth", "تاریخ پیدائش", "تاريخ الميلاد"),
        required: false
      },
      {
        key: "guardian_name",
        type: "short_text",
        labels: labels("Guardian name", "سرپرست کا نام", "اسم ولي الأمر"),
        required: false
      },
      {
        key: "guardian_phone",
        type: "phone",
        labels: labels("Guardian phone", "سرپرست کا فون", "هاتف ولي الأمر"),
        required: false
      },
      {
        key: "guardian_email",
        type: "email",
        labels: labels("Guardian email", "سرپرست کا ای میل", "بريد ولي الأمر"),
        required: false
      },
      {
        key: "address",
        type: "long_text",
        labels: labels("Address", "پتہ", "العنوان"),
        required: false
      }
    ]
  }
] as const;

export const defaultAdmissionWorkflowNodes: readonly StatusNode[] = [
  { key: "submitted", labels: labels("Submitted", "جمع شدہ", "مُقدّم") },
  { key: "verification", labels: labels("Verification", "تصدیق", "التحقق") },
  { key: "assessment", labels: labels("Assessment", "جانچ", "التقييم") },
  { key: "decision", labels: labels("Decision", "فیصلہ", "القرار") },
  { key: "offered", labels: labels("Offered", "پیشکش", "تم العرض") },
  { key: "waitlisted", labels: labels("Waitlisted", "انتظار فہرست", "قائمة الانتظار") },
  { key: "payment_pending", labels: labels("Payment pending", "ادائیگی زیر التوا", "الدفع معلّق") },
  { key: "enrolled", labels: labels("Enrolled", "داخل", "مسجّل"), terminal: true },
  { key: "rejected", labels: labels("Rejected", "مسترد", "مرفوض"), terminal: true },
  { key: "expired", labels: labels("Expired", "میعاد ختم", "منتهي"), terminal: true },
  { key: "withdrawn", labels: labels("Withdrawn", "واپس لی گئی", "منسحب"), terminal: true }
];

export const defaultAdmissionWorkflowTransitions: readonly StatusTransition[] = [
  { from: "submitted", to: "verification", permission: "admissions.application.review" },
  { from: "submitted", to: "withdrawn", permission: "admissions.application.review", requiresReason: true },
  { from: "verification", to: "assessment", permission: "admissions.assessment.manage" },
  { from: "verification", to: "decision", permission: "admissions.application.review" },
  { from: "verification", to: "withdrawn", permission: "admissions.application.review", requiresReason: true },
  { from: "assessment", to: "decision", permission: "admissions.assessment.manage" },
  { from: "assessment", to: "withdrawn", permission: "admissions.application.review", requiresReason: true },
  { from: "decision", to: "offered", permission: "admissions.application.decide" },
  { from: "decision", to: "waitlisted", permission: "admissions.application.decide" },
  { from: "decision", to: "rejected", permission: "admissions.application.decide", requiresReason: true },
  { from: "offered", to: "payment_pending", permission: "admissions.application.decide" },
  { from: "offered", to: "enrolled", permission: "admissions.application.convert" },
  { from: "offered", to: "expired", permission: "admissions.application.decide" },
  { from: "offered", to: "withdrawn", permission: "admissions.application.review", requiresReason: true },
  { from: "waitlisted", to: "offered", permission: "admissions.waitlist.manage" },
  { from: "waitlisted", to: "rejected", permission: "admissions.application.decide", requiresReason: true },
  { from: "waitlisted", to: "expired", permission: "admissions.waitlist.manage" },
  { from: "waitlisted", to: "withdrawn", permission: "admissions.application.review", requiresReason: true },
  { from: "payment_pending", to: "enrolled", permission: "admissions.application.convert" },
  { from: "payment_pending", to: "expired", permission: "admissions.application.decide" },
  { from: "payment_pending", to: "withdrawn", permission: "admissions.application.review", requiresReason: true }
];

export function validateDefaultAdmissionWorkflow() {
  return validateStatusMachine(
    defaultAdmissionWorkflowNodes,
    defaultAdmissionWorkflowTransitions,
    "submitted"
  );
}
