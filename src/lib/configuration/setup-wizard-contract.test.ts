import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wizard = readFileSync(resolve(process.cwd(), "src/components/setup/setup-wizard.tsx"), "utf8").toLowerCase();
const page = readFileSync(resolve(process.cwd(), "src/app/[locale]/setup/page.tsx"), "utf8").toLowerCase();
const readiness = readFileSync(resolve(process.cwd(), "src/lib/configuration/setup-readiness.ts"), "utf8").toLowerCase();

describe("Client V3 guided setup contract", () => {
  it("keeps the four required setup stages", () => {
    expect(wizard).toContain("1. madrasa details");
    expect(wizard).toContain("2. academic year");
    expect(wizard).toContain("3. programs & classes");
    expect(wizard).toContain("4. start");
  });

  it("reuses governed existing mutation routes", () => {
    expect(wizard).toContain("/api/institution/profile");
    expect(wizard).toContain("/api/admissions/foundation");
    expect(wizard).toContain("/api/academics/groups");
  });

  it("exposes only English and Urdu as release configuration choices", () => {
    expect(wizard).toContain("locales.map((language) =>");
    expect(wizard).toContain("localelabels[language]");
    expect(wizard).not.toContain('<option value="ar">');
    expect(wizard).not.toContain('(["en", "ur", "ar"] as const).map');
  });

  it("derives progress from canonical records instead of setup state", () => {
    expect(readiness).toContain('from("institution_profiles")');
    expect(readiness).toContain('from("academic_sessions")');
    expect(readiness).toContain('from("programs")');
    expect(readiness).toContain('from("academic_groups")');
    expect(readiness).not.toContain("setup_progress");
    expect(readiness).not.toContain("onboarding_state");
  });

  it("keeps the setup page connected to normal configuration", () => {
    expect(page).toContain("settings/configuration");
    expect(page).toContain("getguidedsetupsnapshot");
  });

  it("does not introduce client-side roles or privileged secrets", () => {
    expect(wizard).not.toContain("raw_user_meta_data");
    expect(wizard).not.toContain("service_role");
    expect(wizard).not.toContain("supabase_secret_key");
  });
});
