import { publicAdmissionLocales, type PublicAdmissionLocale } from "./public-intake-model";

export type CreateEnquiryInput = {
  applicantName: string;
  guardianName: string | null;
  phone: string | null;
  email: string | null;
  sessionId: number;
  programId: number;
  preferredLocale: PublicAdmissionLocale;
  source: string | null;
  consent: true;
  notes: string | null;
  nextFollowUpAt: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : null;
}

function positiveId(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function futureDate(value: unknown, now: Date): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  const latest = now.getTime() + 366 * 24 * 60 * 60 * 1000;
  return Number.isFinite(parsed) && parsed > now.getTime() && parsed <= latest
    ? new Date(parsed).toISOString()
    : null;
}

export function normalizeEnquiryPhone(value: unknown): string | null {
  const phone = text(value, 40);
  if (!phone) return null;
  const normalized = phone.replace(/[\s()-]/g, "");
  return /^\+?[0-9]{6,15}$/.test(normalized) ? normalized : null;
}

export function validateCreateEnquiry(body: unknown, now = new Date()): {
  value?: CreateEnquiryInput;
  errors: string[];
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { errors: ["Request body must be an object."] };
  const input = body as Record<string, unknown>;
  const errors: string[] = [];
  const applicantName = text(input.applicantName, 160);
  if (!applicantName || applicantName.length < 2) errors.push("Applicant name must contain 2–160 characters.");
  const guardianName = input.guardianName == null || input.guardianName === "" ? null : text(input.guardianName, 160);
  if (input.guardianName && !guardianName) errors.push("Guardian name is too long.");
  const phone = input.phone == null || input.phone === "" ? null : normalizeEnquiryPhone(input.phone);
  if (input.phone && !phone) errors.push("Guardian phone is invalid.");
  const emailValue = input.email == null || input.email === "" ? null : text(input.email, 320)?.toLowerCase() ?? null;
  const email = emailValue && emailPattern.test(emailValue) ? emailValue : null;
  if (input.email && !email) errors.push("Guardian email is invalid.");
  if (!phone && !email) errors.push("Guardian phone or email is required.");
  const sessionId = positiveId(input.sessionId);
  const programId = positiveId(input.programId);
  if (!sessionId) errors.push("Academic session is required.");
  if (!programId) errors.push("Program is required.");
  const preferredLocale = publicAdmissionLocales.includes(input.preferredLocale as PublicAdmissionLocale)
    ? input.preferredLocale as PublicAdmissionLocale : null;
  if (!preferredLocale) errors.push("Preferred language is invalid.");
  const source = input.source == null || input.source === "" ? null : text(input.source, 80);
  if (input.source && (!source || source.length < 2)) errors.push("Source must contain 2–80 characters.");
  if (input.consent !== true) errors.push("Consent is required.");
  const notes = input.notes == null || input.notes === "" ? null : text(input.notes, 2000);
  if (input.notes && !notes) errors.push("Notes are too long.");
  const nextFollowUpAt = futureDate(input.nextFollowUpAt, now);
  if (!nextFollowUpAt) errors.push("Follow-up must be within the next year.");
  if (errors.length || !applicantName || !sessionId || !programId || !preferredLocale || !nextFollowUpAt) return { errors };
  return { errors: [], value: { applicantName, guardianName, phone, email, sessionId, programId, preferredLocale, source, consent: true, notes, nextFollowUpAt } };
}

export const enquiryChannels = ["phone", "email", "whatsapp", "in_person"] as const;
export type EnquiryChannel = typeof enquiryChannels[number];
export const enquiryFollowUpStatuses = ["contacted", "qualified", "lost", "archived"] as const;

export function validateCompleteFollowUp(body: unknown, now = new Date()) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { errors: ["Request body must be an object."] };
  const input = body as Record<string, unknown>;
  const enquiryId = positiveId(input.enquiryId);
  const outcome = text(input.outcome, 2000);
  const channel = enquiryChannels.includes(input.channel as EnquiryChannel) ? input.channel as EnquiryChannel : null;
  const newStatus = enquiryFollowUpStatuses.includes(input.newStatus as typeof enquiryFollowUpStatuses[number])
    ? input.newStatus as typeof enquiryFollowUpStatuses[number] : null;
  const nextFollowUpAt = input.nextFollowUpAt ? futureDate(input.nextFollowUpAt, now) : null;
  const errors: string[] = [];
  if (!enquiryId) errors.push("Enquiry is required.");
  if (!outcome || outcome.length < 2) errors.push("Outcome must contain 2–2000 characters.");
  if (!channel) errors.push("Follow-up channel is invalid.");
  if (!newStatus) errors.push("Enquiry status is invalid.");
  if (input.nextFollowUpAt && !nextFollowUpAt) errors.push("Next follow-up must be within the next year.");
  if ((newStatus === "lost" || newStatus === "archived") && nextFollowUpAt) errors.push("Closed enquiries cannot schedule another follow-up.");
  return errors.length || !enquiryId || !outcome || !channel || !newStatus ? { errors } : { errors: [], value: { enquiryId, outcome, channel, newStatus, nextFollowUpAt } };
}
