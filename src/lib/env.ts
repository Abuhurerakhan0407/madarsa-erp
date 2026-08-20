const publicKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
] as const;

type PublicKey = (typeof publicKeys)[number];

function requireEnv(key: PublicKey): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment key: ${key}`);
  }

  return value;
}

export function getSupabasePublicEnv() {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  } as const;
}
