import { NextResponse, type NextRequest } from "next/server";
import { safeAuthRedirect } from "@/lib/auth/redirects";
import { getSupabasePublicEnv } from "@/lib/env";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const destination = safeAuthRedirect(requestUrl.searchParams.get("next"));

  const errorParam = requestUrl.searchParams.get("error") || requestUrl.searchParams.get("error_code");

  if (errorParam || (!code && !token_hash)) {
    if (destination.startsWith("/reset-password")) {
      return NextResponse.redirect(new URL("/reset-password?error=invalid_or_expired", requestUrl.origin));
    }
    return NextResponse.redirect(new URL("/en?auth=missing_code", requestUrl.origin));
  }

  const response = NextResponse.redirect(new URL(destination, requestUrl.origin));
  const env = getSupabasePublicEnv();
  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      if (destination.startsWith("/reset-password")) {
        return NextResponse.redirect(new URL("/reset-password?error=invalid_or_expired", requestUrl.origin));
      }
      return NextResponse.redirect(new URL("/en?auth=callback_failed", requestUrl.origin));
    }
    return response;
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) {
      if (destination.startsWith("/reset-password")) {
        return NextResponse.redirect(new URL("/reset-password?error=invalid_or_expired", requestUrl.origin));
      }
      return NextResponse.redirect(new URL("/en?auth=callback_failed", requestUrl.origin));
    }
    return response;
  }

  return response;
}
