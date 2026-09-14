import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phase 5 biometric-only attendance product contract", () => {
  it("does not expose retired NFC or hybrid choices in the active device configuration UI", () => {
    const page = read("src/app/[locale]/settings/configuration/attendance-devices/page.tsx");
    const center = read("src/components/attendance-device-center.tsx");
    expect(page).toContain("biometric attendance terminals");
    expect(page).not.toContain("or NFC");
    expect(center).toContain('device.modality === "biometric"');
    expect(center).toContain('modality: "biometric"');
    expect(center).not.toContain('<option value="nfc">');
    expect(center).not.toContain('<option value="hybrid">');
    expect(center).not.toContain('>NFC<');
  });

  it("rejects retired modalities at both active device provisioning and ingest boundaries", () => {
    const createRoute = read("src/app/api/attendance/devices/route.ts");
    const ingestRoute = read("src/app/api/attendance/device-ingest/route.ts");
    expect(createRoute).toContain('modality !== "biometric"');
    expect(createRoute).toContain('modality: "biometric"');
    expect(ingestRoute).toContain('modality !== "biometric"');
    expect(ingestRoute).toContain('modality: "biometric"');
  });

  it("retains historical database compatibility without advertising it as a current capability", () => {
    const bridge = read("src/lib/attendance/device-bridge.ts");
    const dbContract = read("src/lib/database/attendance-device-bridge-contract.test.ts");
    expect(bridge).toContain('"biometric" | "nfc" | "hybrid"');
    expect(dbContract).toContain("'nfc'");
  });

  it("keeps biometric configuration mutations visibly pending", () => {
    const center = read("src/components/attendance-device-center.tsx");
    expect(center).toContain('setBusyAction("create")');
    expect(center).toContain('setBusyAction("mapping")');
    expect(center).toContain('setBusyAction(`rotate:${deviceId}`)');
    expect(center).toContain('setBusyAction(`apply:${eventId}`)');
    expect(center).toContain("aria-busy");
    expect(center).toContain("inline-spinner");
  });
});
