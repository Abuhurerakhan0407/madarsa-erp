import { NextResponse } from "next/server";
import { receiveAttendanceDeviceEvent } from "@/lib/attendance/device-bridge";

const forbiddenMetadataKeys = new Set(["template", "biometric_template", "fingerprint", "fingerprint_image", "face_image", "image", "raw_image", "raw_template"]);

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 16384) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  const ingestToken = request.headers.get("x-device-token")?.trim() ?? "";
  if (!ingestToken || ingestToken.length > 128) return NextResponse.json({ error: "Device authentication required." }, { status: 401 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const externalDeviceKey = typeof body.externalDeviceKey === "string" ? body.externalDeviceKey.trim() : "";
    const externalEventId = typeof body.externalEventId === "string" ? body.externalEventId.trim() : "";
    const externalSubjectKey = typeof body.externalSubjectKey === "string" ? body.externalSubjectKey.trim() : "";
    const modality = body.modality;
    const eventType = body.eventType;
    const occurredAt = typeof body.occurredAt === "string" ? body.occurredAt : "";

    // Ilmgaah's active attendance-device contract is biometric-only. Historical
    // database values remain untouched, but retired modalities cannot enter through
    // the live ingest boundary.
    if (
      externalDeviceKey.length < 3 ||
      externalEventId.length < 4 ||
      !externalSubjectKey ||
      modality !== "biometric" ||
      (eventType !== "presence" && eventType !== "check_in" && eventType !== "check_out") ||
      !Number.isFinite(Date.parse(occurredAt))
    ) {
      return NextResponse.json({ error: "Device event is invalid." }, { status: 400 });
    }

    const sourceMetadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata as Record<string, unknown>
      : {};
    for (const key of Object.keys(sourceMetadata)) {
      if (forbiddenMetadataKeys.has(key.toLowerCase())) {
        return NextResponse.json({ error: "Raw biometric material must not be sent to ERP." }, { status: 400 });
      }
    }

    const metadata: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(sourceMetadata).slice(0, 20)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
        metadata[key.slice(0, 64)] = typeof value === "string" ? value.slice(0, 256) : value;
      }
    }

    const result = await receiveAttendanceDeviceEvent({
      externalDeviceKey,
      ingestToken,
      externalEventId,
      externalSubjectKey,
      modality: "biometric",
      eventType,
      occurredAt,
      metadata
    });
    return NextResponse.json(result, { status: 202, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to receive device event.";
    return NextResponse.json(
      { error: message === "device authentication failed" ? "Device authentication failed." : message },
      { status: message === "device authentication failed" ? 401 : 400 }
    );
  }
}
