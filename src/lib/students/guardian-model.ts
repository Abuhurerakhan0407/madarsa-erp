export type StudentGuardianInput = {
  name: string;
  relationship: "father" | "mother" | "guardian";
  phone?: string;
  occupation?: string;
  education?: string;
  canCollect: boolean;
  guardianPersonId?: number;
};

type ValidationResult = { value?: StudentGuardianInput; errors: string[] };

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= max ? cleaned : undefined;
}

export function validateStudentGuardianInput(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { errors: ["Request body must be an object."] };
  const body = input as Record<string, unknown>;
  const errors: string[] = [];
  const name = text(body.name, 160);
  if (!name || name.length < 2) errors.push("Guardian name is required.");
  const relationship = body.relationship === "father" || body.relationship === "mother" || body.relationship === "guardian" ? body.relationship : undefined;
  if (!relationship) errors.push("Guardian relationship is invalid.");
  const phone = body.phone === undefined || body.phone === null || body.phone === "" ? undefined : text(body.phone, 80);
  if (body.phone && !phone) errors.push("Guardian phone is invalid.");
  const occupation = body.occupation === undefined || body.occupation === null || body.occupation === "" ? undefined : text(body.occupation, 160);
  if (body.occupation && !occupation) errors.push("Guardian occupation is invalid.");
  const education = body.education === undefined || body.education === null || body.education === "" ? undefined : text(body.education, 160);
  if (body.education && !education) errors.push("Guardian education is invalid.");
  if (body.canCollect !== undefined && typeof body.canCollect !== "boolean") errors.push("Pickup authority is invalid.");
  let guardianPersonId: number | undefined;
  if (body.guardianPersonId !== undefined && body.guardianPersonId !== null && body.guardianPersonId !== "") {
    const parsed = Number(body.guardianPersonId);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) errors.push("Selected guardian is invalid.");
    else guardianPersonId = parsed;
  }
  if (errors.length || !name || !relationship) return { errors };
  return { value: { name, relationship, phone, occupation, education, canCollect: body.canCollect !== false, guardianPersonId }, errors: [] };
}
