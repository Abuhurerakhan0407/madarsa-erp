import { afterEach, describe, expect, it } from "vitest";
import { getSupabasePublicEnv, hasSupabasePublicEnv } from "./env";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("getSupabasePublicEnv", () => {
  it("returns configured public keys", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable";

    expect(getSupabasePublicEnv()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "publishable"
    });
    expect(hasSupabasePublicEnv()).toBe(true);
  });

  it("fails closed when configuration is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    expect(() => getSupabasePublicEnv()).toThrow("Missing required environment key");
    expect(hasSupabasePublicEnv()).toBe(false);
  });

  it("treats whitespace-only configuration as missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "   ";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable";

    expect(() => getSupabasePublicEnv()).toThrow("Missing required environment key");
    expect(hasSupabasePublicEnv()).toBe(false);
  });
});
