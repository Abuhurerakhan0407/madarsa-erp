import { getSupabasePublicEnv } from "@/lib/env";

const PROBE_TIMEOUT_MS = 2500;

type DependencyState = "ok" | "unavailable";

async function probe(url: string, publishableKey: string): Promise<DependencyState> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
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
    probe(`${baseUrl}/rest/v1/`, env.publishableKey)
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
