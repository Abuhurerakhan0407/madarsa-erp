import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateParentTemporaryPassword } from "./parent-login-server";
import {
  buildParentSyntheticEmail,
  normalizeLoginIdentifier,
  validUsernameParentPassword
} from "./parent-login";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("parent username portal contracts", () => {
  it("normalizes email and username without a database lookup", () => {
    expect(normalizeLoginIdentifier(" PAR-000137 ")).toEqual({
      kind: "username",
      value: "par-000137",
      username: "par-000137",
      email: null
    });
    expect(normalizeLoginIdentifier(" UST-000123 ")).toEqual({
      kind: "username",
      value: "ust-000123",
      username: "ust-000123",
      email: null
    });
    expect(normalizeLoginIdentifier(" parent-abc234 ")).toEqual({
      kind: "username",
      value: "parent-abc234",
      username: "parent-abc234",
      email: null
    });
    expect(normalizeLoginIdentifier("USER@Example.COM")).toMatchObject({
      kind: "email",
      value: "user@example.com",
      email: "user@example.com",
      username: null
    });
    expect(normalizeLoginIdentifier("bad username")).toMatchObject({ kind: "invalid" });
    expect(buildParentSyntheticEmail("PAR-000137")).toBe("par-000137@parents.ilmgaah.in");
  });

  it("keeps parent password policy separate from staff policy", () => {
    expect(validUsernameParentPassword("Abcdefg234")).toBe(true);
    expect(validUsernameParentPassword("abcdefg234")).toBe(false);
    expect(validUsernameParentPassword("Abcdefg12")).toBe(false);
    expect(validUsernameParentPassword("Password123")).toBe(false);
    expect(validUsernameParentPassword("A".repeat(129) + "1a")).toBe(false);
  });

  it("generates readable temporary passwords with no look-alike characters", () => {
    for (let index = 0; index < 40; index += 1) {
      const password = generateParentTemporaryPassword();
      expect(password.length).toBeGreaterThanOrEqual(10);
      expect(password).toMatch(/^[ACDEHJKMNPQRTUVWXYZacdehjkmnpqrtuvwxyz3479-]+!$/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[3479]/);
    }
  });

  it("keeps authentication generic and recovery-free for username accounts", () => {
    const loginRoute = read("src/app/api/auth/login/route.ts");
    const mobileRoute = read("src/app/api/mobile/auth/route.ts");
    const credentialRoute = read("src/app/api/portals/credentials/route.ts");
    expect(loginRoute).toContain("normalizeLoginIdentifier");
    expect(loginRoute).toContain("invalid_credentials");
    expect(loginRoute).toContain("isPortalEmailLogin");
    expect(loginRoute).not.toContain("find_auth_identity_by_email_v1");
    expect(mobileRoute).toContain("normalizeLoginIdentifier");
    expect(mobileRoute).toContain("invalid_credentials");
    expect(mobileRoute).toContain("isPortalEmailLogin");
    expect(credentialRoute).toContain("email_confirm: true");
    expect(credentialRoute).toContain("portal_login_method: \"username\"");
    expect(credentialRoute).toContain("requestedUsername");
    expect(credentialRoute).toContain("usernamePattern");
    expect(credentialRoute).not.toContain("resetPasswordForEmail");
    expect(credentialRoute).not.toContain("inviteUserByEmail");
    expect(credentialRoute).not.toContain("signInWithOtp");
  });

  it("keeps username provisioning audited and secrets out of audit calls", () => {
    const route = read("src/app/api/portals/credentials/route.ts");
    expect(route).toContain("provision_username");
    expect(route).toContain("record_portal_credential_audit_v1");
    expect(route).toContain("cache-control");
    expect(route).toContain('links.data?.find((link) => link.status === "verified")');
    expect(route).toContain('getUserById(String(verifiedLinked.identity_id))');
    expect(route).toContain('isUsernameLogin && kind === "guardian" && verifiedLinked.status === "verified"');
    expect(route).not.toMatch(/p_password|p_temporary_password/);
  });

  it("supports sibling guardian linking without contact matching", () => {
    const guardianRoute = read("src/app/api/students/[personId]/guardian/route.ts");
    const guardianForm = read("src/components/student-guardian-form.tsx");
    const migration = read("supabase/migrations/20261004024535_parent_portal_username_login.sql");
    expect(guardianRoute).toContain('GET(request');
    expect(guardianRoute).toContain("guardianPersonId");
    expect(guardianRoute).toContain("upsert_student_primary_guardian_v2");
    expect(guardianForm).toContain("Link existing guardian");
    expect(guardianForm).toContain("/api/students/");
    expect(guardianForm).toContain("guardianPersonId");
    expect(migration).toContain("upsert_student_primary_guardian_v2");
  });

  it("supports bulk username handouts in English and Urdu with LTR credentials", () => {
    const manager = read("src/components/portal-credential-manager.tsx");
    expect(manager).toContain("Generate logins for this class/guardians");
    expect(manager).toContain("bulkGenerate");
    expect(manager).toContain("dir=\"ltr\"");
    expect(manager).toContain("father_name");
    expect(manager).toContain("Portal URL");
    expect(manager).toContain("پرنٹ");
  });
  it("keeps CI-generated credentials isolated from manually used QA accounts", () => {
    const provisioner = read("tests/e2e/staging-provision.ts");
    const roleSmoke = read("tests/e2e/authenticated-role-smoke.spec.ts");
    const liveSmoke = read("tests/e2e/auth-live-deployment.spec.ts");
    expect(provisioner).toContain('if (!suffix.startsWith("ci-"))');
    expect(roleSmoke).toContain('process.env.GITHUB_RUN_ID || "local"');
    expect(roleSmoke).toContain('process.env.GITHUB_RUN_ATTEMPT || "1"');
    expect(roleSmoke).toContain('"ci-" + runId + "-a"');
    expect(roleSmoke).toContain('"-rs-" + projectKey');
    expect(roleSmoke).toContain('"-r" + testInfo.retry + "-w"');
    expect(liveSmoke).toContain('"-la-" + projectKey');
  });

});
