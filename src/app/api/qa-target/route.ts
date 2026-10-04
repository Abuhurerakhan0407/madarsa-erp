import { NextResponse } from "next/server";
import { getSupabasePublicEnv } from "@/lib/env";

export function GET() {
  const { url } = getSupabasePublicEnv();
  return NextResponse.json({
    status: "ok",
    supabaseHost: new URL(url).host
  }, {
    headers: { "cache-control": "no-store" }
  });
}
