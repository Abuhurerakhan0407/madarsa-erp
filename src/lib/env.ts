function readPublicEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  } as const;
}

export function hasSupabasePublicEnv(): boolean {
  const { url, publishableKey } = readPublicEnv();
  return Boolean(url && publishableKey);
}

export function getSupabasePublicEnv() {
  const { url, publishableKey } = readPublicEnv();

  if (!url) {
    throw new Error("Missing required environment key: NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!publishableKey) {
    throw new Error(
      "Missing required environment key: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  return { url, publishableKey } as const;
}
