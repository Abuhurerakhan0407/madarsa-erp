import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { disabledCapabilityResponse } from "@/lib/capabilities/server";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { importStudentsBatch } from "@/lib/students/lifecycle";
import type { StudentImportRow } from "@/lib/students/csv-import";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function validDate(value: string) {
  if (!DATE.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function sanitizeRow(value: unknown, index: number): StudentImportRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Import row ${index + 1} is invalid.`);
  }
  const row = value as Record<string, unknown>;
  const displayName = text(row.display_name);
  if (displayName.length < 2 || displayName.length > 160) {
    throw new Error(`Import row ${index + 1} has an invalid student name.`);
  }

  const nativeName = text(row.name_native);
  if (nativeName.length > 160) throw new Error(`Import row ${index + 1} native name is too long.`);

  const dateOfBirth = text(row.date_of_birth);
  if (dateOfBirth && !validDate(dateOfBirth)) {
    throw new Error(`Import row ${index + 1} has an invalid date of birth.`);
  }

  const gender = text(row.gender).toLowerCase();
  if (gender && !["male", "female", "other", "undisclosed"].includes(gender)) {
    throw new Error(`Import row ${index + 1} has an invalid gender.`);
  }

  const preferredLocale = text(row.preferred_locale).toLowerCase();
  if (preferredLocale && preferredLocale !== "en" && preferredLocale !== "ur") {
    throw new Error(`Import row ${index + 1} preferred locale must be English or Urdu.`);
  }

  let guardian: StudentImportRow["guardian"];
  if (row.guardian !== undefined && row.guardian !== null) {
    if (typeof row.guardian !== "object" || Array.isArray(row.guardian)) {
      throw new Error(`Import row ${index + 1} guardian is invalid.`);
    }
    const rawGuardian = row.guardian as Record<string, unknown>;
    const name = text(rawGuardian.name);
    const relationship = text(rawGuardian.relationship).toLowerCase() || "guardian";
    const phone = text(rawGuardian.phone);
    const email = text(rawGuardian.email).toLowerCase();
    if (name.length < 2 || name.length > 160) throw new Error(`Import row ${index + 1} guardian name is invalid.`);
    if (!["father", "mother", "guardian"].includes(relationship)) throw new Error(`Import row ${index + 1} guardian relationship is invalid.`);
    if (phone.length > 40) throw new Error(`Import row ${index + 1} guardian phone is too long.`);
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) throw new Error(`Import row ${index + 1} guardian email is invalid.`);
    guardian = {
      name,
      relationship: relationship as "father" | "mother" | "guardian",
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {})
    };
  }

  return {
    display_name: displayName,
    ...(nativeName ? { name_native: nativeName } : {}),
    ...(dateOfBirth ? { date_of_birth: dateOfBirth } : {}),
    ...(gender ? { gender: gender as NonNullable<StudentImportRow["gender"]> } : {}),
    ...(preferredLocale ? { preferred_locale: preferredLocale as "en" | "ur" } : {}),
    ...(guardian ? { guardian } : {})
  };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const parsed = await readBoundedJson(request, 262_144);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active institution membership required." }, { status: 403 });
  }
  const capabilityDenied = disabledCapabilityResponse(workspace, "student_lifecycle_import_promotion_renewal");
  if (capabilityDenied) return capabilityDenied;

  try {
    const body = parsed.value as Record<string, unknown>;
    const sessionId = Number(body.sessionId);
    const programId = Number(body.programId);
    const groupId = Number(body.groupId);
    const joinedOn = text(body.joinedOn);
    const rawRows = Array.isArray(body.rows) ? body.rows : [];

    if (
      !Number.isInteger(sessionId) ||
      sessionId <= 0 ||
      !Number.isInteger(programId) ||
      programId <= 0 ||
      !Number.isInteger(groupId) ||
      groupId <= 0 ||
      !validDate(joinedOn)
    ) {
      return NextResponse.json({ error: "Import placement is invalid." }, { status: 400 });
    }
    if (rawRows.length < 1 || rawRows.length > 100) {
      return NextResponse.json({ error: "Import supports 1 to 100 students per batch." }, { status: 400 });
    }

    const rows = rawRows.map((row, index) => sanitizeRow(row, index));
    const requestKey =
      typeof body.requestKey === "string" && body.requestKey.trim().length >= 16
        ? body.requestKey.trim().slice(0, 128)
        : `student-import:${randomUUID()}`;

    const result = await importStudentsBatch({
      sessionId,
      programId,
      groupId,
      joinedOn,
      rows,
      requestKey
    });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to import students.";
    const lower = message.toLowerCase();
    return NextResponse.json(
      { error: message },
      { status: lower.includes("permission denied") ? 403 : lower.includes("duplicate") || lower.includes("conflict") ? 409 : 400 }
    );
  }
}
