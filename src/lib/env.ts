const publicKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
] as const;

type PublicKey = (typeof publicKeys)[number];

export function hasSupabasePublicEnv(): boolean {
  return publicKeys.every((key) => Boolean(process.env[key]?.trim()));
}

function requireEnv(key: PublicKey): string {
  const value = process.env[key]?.trim();

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
