import { NextResponse } from "next/server";
import { safeAuthRedirect } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const destination = safeAuthRedirect(requestUrl.searchParams.get("next"));

  const errorParam = requestUrl.searchParams.get("error") || requestUrl.searchParams.get("error_code");

  if (errorParam || !code) {
    if (destination.startsWith("/reset-password")) {
      return NextResponse.redirect(new URL("/reset-password?error=invalid_or_expired", requestUrl.origin));
    }
    return NextResponse.redirect(new URL("/en?auth=missing_code", requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (destination.startsWith("/reset-password")) {
      return NextResponse.redirect(new URL("/reset-password?error=invalid_or_expired", requestUrl.origin));
    }
    return NextResponse.redirect(new URL("/en?auth=callback_failed", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
