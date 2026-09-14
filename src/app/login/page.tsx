import { LoginWorkspace, type LoginAuthState } from "@/components/login-workspace";
import { authLocaleFromRedirect } from "@/lib/auth/redirects";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string | string[]; auth?: string | string[] }>;
}) {
  const query = await searchParams;
  const nextTarget = typeof query.next === "string" ? query.next : null;
  const auth = typeof query.auth === "string" ? query.auth : null;
  const authState: LoginAuthState = auth === "missing_code" || auth === "callback_failed" ? auth : null;

  return (
    <LoginWorkspace
      initialLocale={authLocaleFromRedirect(nextTarget)}
      nextTarget={nextTarget}
      initialAuthState={authState}
    />
  );
}
