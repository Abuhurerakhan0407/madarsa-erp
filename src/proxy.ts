import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/proxy";

const handleI18nRouting = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  if (!hasSupabasePublicEnv()) {
    return handleI18nRouting(request);
  }

  const sessionResponse = NextResponse.next({ request });
  await updateSession(request, sessionResponse);

  const localizedResponse = handleI18nRouting(request);
  sessionResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
    localizedResponse.cookies.set(name, value, options);
  });

  return localizedResponse;
}

export const config = {
  matcher: "/((?!api|auth|trpc|_next|_vercel|.*\\..*).*)"
};
