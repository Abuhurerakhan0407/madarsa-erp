import { createClient } from "./server";

export type VerifiedIdentity = {
  id: string;
  email?: string;
};

const TRANSIENT_AUTH_PATTERN =
  /bad gateway|failed to get api key info|failed to get project config|fetch failed|network|timeout|timed out|502|503|504|connection reset|socket/i;
const MISSING_SESSION_PATTERN = /auth session missing|session missing|no session|invalid refresh token/i;

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return String(error ?? "Unknown authentication error");
}

function errorStatus(error: unknown): number | null {
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number") {
    return error.status;
  }
  return null;
}

export function isTransientIdentityError(error: unknown): boolean {
  const status = errorStatus(error);
  return (status !== null && status >= 500) || TRANSIENT_AUTH_PATTERN.test(errorMessage(error));
}

function isUnauthenticatedError(error: unknown): boolean {
  const status = errorStatus(error);
  if (status === 400 || status === 401 || status === 403) return true;
  return MISSING_SESSION_PATTERN.test(errorMessage(error));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getVerifiedIdentity(): Promise<VerifiedIdentity | null> {
  const supabase = await createClient();
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.auth.getClaims();

    if (!error && typeof data?.claims?.sub === "string") {
      return {
        id: data.claims.sub,
        email: typeof data.claims.email === "string" ? data.claims.email : undefined
      };
    }

    if (!error) return null;
    if (isUnauthenticatedError(error) && !isTransientIdentityError(error)) return null;

    lastError = error;
    if (!isTransientIdentityError(error) || attempt === 2) break;
    await wait(120 * (attempt + 1));
  }

  throw new Error(`Unable to verify session: ${errorMessage(lastError)}`);
}
