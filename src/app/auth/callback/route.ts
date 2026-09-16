import { NextResponse } from "next/server";
import { safeAuthRedirect } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

function loginFailure(origin: string, destination: string, state: "missing_code" | "callback_failed") {
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("next", destination);
  loginUrl.searchParams.set("auth", state);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const destination = safeAuthRedirect(requestUrl.searchParams.get("next"));

  if (!code) {
    return loginFailure(requestUrl.origin, destination, "missing_code");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return loginFailure(requestUrl.origin, destination, "callback_failed");
  }

  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
