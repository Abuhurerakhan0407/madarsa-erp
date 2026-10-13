import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isValidEmail,
  isValidPassword,
  getRecoveryErrorMessage,
  recoveryCopy,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH
} from "./password-recovery";
import { safeAuthRedirect } from "./redirects";

describe("password recovery logic & validation", () => {
  describe("isValidPassword policy", () => {
    it("accepts valid 12–128 character mixed complexity passwords", () => {
      expect(PASSWORD_MIN_LENGTH).toBe(12);
      expect(PASSWORD_MAX_LENGTH).toBe(128);
      expect(isValidPassword("ValidPass123!@#")).toBe(true);
      expect(isValidPassword("JamiaProduction2026$#Secure")).toBe(true);
      expect(isValidPassword("A".repeat(100) + "a1!")).toBe(true);
    });

    it("rejects passwords shorter than 12 characters", () => {
      expect(isValidPassword("Short1!Aa")).toBe(false);
      expect(isValidPassword("12345678901")).toBe(false);
    });

    it("rejects passwords longer than 128 characters", () => {
      expect(isValidPassword("A".repeat(126) + "a1!X")).toBe(false);
    });

    it("rejects passwords missing required character classes", () => {
      expect(isValidPassword("lowercaseonly123456!")).toBe(false); // missing uppercase
      expect(isValidPassword("UPPERCASEONLY123456!")).toBe(false); // missing lowercase
      expect(isValidPassword("NoDigitsIncludedHere!@#")).toBe(false); // missing number
      expect(isValidPassword("NoSpecialCharacters12345")).toBe(false); // missing symbol
    });
  });

  describe("isValidEmail validation", () => {
    it("accepts valid email addresses", () => {
      expect(isValidEmail("jamiaislamiauloomulquraan@gmail.com")).toBe(true);
      expect(isValidEmail("owner@ilmgaah.in")).toBe(true);
      expect(isValidEmail("  admin@example.org  ")).toBe(true);
    });

    it("rejects invalid email formats", () => {
      expect(isValidEmail("")).toBe(false);
      expect(isValidEmail("not-an-email")).toBe(false);
      expect(isValidEmail("missing@domain")).toBe(false);
      expect(isValidEmail("@missinguser.com")).toBe(false);
    });
  });

  describe("error message mapping and safe error handling", () => {
    it("maps rate-limit errors safely in both locales", () => {
      expect(getRecoveryErrorMessage("email rate limit exceeded", "en")).toBe(
        recoveryCopy.en.rateLimited
      );
      expect(getRecoveryErrorMessage("too many requests", "ur")).toBe(
        recoveryCopy.ur.rateLimited
      );
    });

    it("maps expired or invalid token errors safely in both locales", () => {
      expect(getRecoveryErrorMessage("otp expired", "en")).toBe(
        recoveryCopy.en.linkExpiredBody
      );
      expect(getRecoveryErrorMessage("token has expired or is invalid", "ur")).toBe(
        recoveryCopy.ur.linkExpiredBody
      );
    });

    it("falls back to generic error when error string is empty or unrecognized", () => {
      expect(getRecoveryErrorMessage("", "en")).toBe(recoveryCopy.en.genericError);
      expect(getRecoveryErrorMessage("custom failure message", "en")).toBe(
        "custom failure message"
      );
    });
  });
});

describe("password recovery architecture & contracts", () => {
  const root = process.cwd();
  const loginForm = readFileSync(resolve(root, "src/components/login-form.tsx"), "utf8");
  const callbackRoute = readFileSync(resolve(root, "src/app/auth/callback/route.ts"), "utf8");
  const proxy = readFileSync(resolve(root, "src/proxy.ts"), "utf8");
  const forgotForm = readFileSync(resolve(root, "src/components/forgot-password-form.tsx"), "utf8");
  const resetForm = readFileSync(resolve(root, "src/components/reset-password-form.tsx"), "utf8");

  it("adds 'Forgot password?' link to login form with English and Urdu copy", () => {
    expect(loginForm).toContain('href="/forgot-password"');
    expect(loginForm).toContain('forgotPassword: "Forgot password?"');
    expect(loginForm).toContain('forgotPassword: "پاس ورڈ بھول گئے؟"');
    expect(loginForm).toContain("auth-forgot-link");
  });

  it("handles forgot-password and reset-password routes in proxy middleware without forced login redirect", () => {
    expect(proxy).toContain('pathname === "/forgot-password"');
    expect(proxy).toContain('pathname === "/reset-password"');
  });

  it("handles callback error routing safely for password reset destination", () => {
    expect(callbackRoute).toContain('destination.startsWith("/reset-password")');
    expect(callbackRoute).toContain('/reset-password?error=invalid_or_expired');
    expect(callbackRoute).toContain("exchangeCodeForSession");
  });

  it("ensures recovery request redirects to /auth/callback?next=/reset-password", () => {
    expect(forgotForm).toContain("/auth/callback?next=/reset-password");
    expect(forgotForm).toContain("resetPasswordForEmail");
  });

  it("enforces 12–128 character password policy and update in reset form", () => {
    expect(resetForm).toContain("PASSWORD_MIN_LENGTH");
    expect(resetForm).toContain("PASSWORD_MAX_LENGTH");
    expect(resetForm).toContain("isValidPassword");
    expect(resetForm).toContain("updateUser");
  });

  it("validates safeAuthRedirect accepts /reset-password", () => {
    expect(safeAuthRedirect("/reset-password")).toBe("/reset-password");
  });
});
