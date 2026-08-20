import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/proxy";

const handleI18nRouting = createMiddleware(routing);

function copySessionCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value, ...options }) => {
    to.cookies.set(name, value, options);
  });
  return to;
}

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!hasSupabasePublicEnv()) {
    return new NextResponse("Application configuration unavailable.", {
      status: 503,
      headers: {
        "cache-control": "no-store"
      }
    });
  }

  const baseResponse = NextResponse.next({ request });
  const { response: sessionResponse, identityId } = await updateSession(
    request,
    baseResponse
  );

  if (pathname === "/login") {
    if (!identityId) return sessionResponse;
    return copySessionCookies(
      sessionResponse,
      NextResponse.redirect(new URL("/en", request.url))
    );
  }

  if (pathname === "/onboarding") {
    if (identityId) return sessionResponse;

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", "/onboarding");
    return copySessionCookies(sessionResponse, NextResponse.redirect(loginUrl));
  }

  if (!identityId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`
    );
    return copySessionCookies(sessionResponse, NextResponse.redirect(loginUrl));
  }

  return copySessionCookies(sessionResponse, handleI18nRouting(request));
}

export const config = {
  matcher: "/((?!api|auth|trpc|_next|_vercel|.*\\..*).*)"
};
