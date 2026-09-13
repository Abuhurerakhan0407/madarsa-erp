import { getSupabasePublicEnv } from "@/lib/env";

const PROBE_TIMEOUT_MS = 2500;
const REST_PROBE_PATH = "/rest/v1/tenants";

type DependencyState = "ok" | "unavailable";
type ProbeMethod = "GET" | "OPTIONS";

async function probe(
  url: string,
  publishableKey: string,
  method: ProbeMethod = "GET"
): Promise<DependencyState> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        apikey: publishableKey
      },
      cache: "no-store",
      signal: controller.signal
    });

    return response.ok ? "ok" : "unavailable";
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  let env: ReturnType<typeof getSupabasePublicEnv>;

  try {
    env = getSupabasePublicEnv();
  } catch {
    return Response.json(
      {
        status: "not_ready",
        service: "madarsa-erp",
        dependencies: {
          supabaseAuth: "unavailable",
          supabaseRest: "unavailable"
        },
        timestamp: new Date().toISOString()
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const baseUrl = env.url.replace(/\/$/, "");
  const [supabaseAuth, supabaseRest] = await Promise.all([
    probe(`${baseUrl}/auth/v1/health`, env.publishableKey),
    // Supabase no longer permits publishable/anon keys to read the PostgREST
    // OpenAPI document at /rest/v1/. OPTIONS on a known table verifies that
    // the Data REST gateway and PostgREST route are reachable without reading
    // tenant data or requiring elevated server-side credentials.
    probe(`${baseUrl}${REST_PROBE_PATH}`, env.publishableKey, "OPTIONS")
  ]);

  const ready = supabaseAuth === "ok" && supabaseRest === "ok";

  return Response.json(
    {
      status: ready ? "ready" : "not_ready",
      service: "madarsa-erp",
      dependencies: {
        supabaseAuth,
        supabaseRest
      },
      timestamp: new Date().toISOString()
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
