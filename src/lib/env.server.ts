export function getSupabaseAdminEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url) {
    throw new Error("Missing required environment key: NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!secretKey) {
    throw new Error("Missing required environment key: SUPABASE_SECRET_KEY");
  }

  return { url, secretKey } as const;
}
