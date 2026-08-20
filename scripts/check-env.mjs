const required = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
];

if (process.env.VERCEL === "1" || process.env.REQUIRE_SERVER_SECRETS === "1") {
  required.push("SUPABASE_SECRET_KEY");
}

const missing = required.filter((key) => !process.env[key]?.trim());

if (missing.length > 0) {
  console.error(`Missing environment keys: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`${required.length} required environment keys present.`);
