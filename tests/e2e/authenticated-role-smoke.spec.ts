import { expect, test, type APIRequestContext } from "@playwright/test";
import { provisionStagingRoleUsers } from "./staging-provision";

type Role = "admin" | "teacher" | "parent";
type Workspace = {
  tenantId: number;
  branchId: number | null;
  surface: Role;
  accessMode: "membership" | "portal";
};

const stripQuotes = (value: string | undefined) => (value ?? "").trim().replace(/^['"]|['"]$/g, "");
const supabaseUrl = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/$/, "");
const supabaseKey = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const appBaseUrl = stripQuotes(process.env.E2E_APP_URL).replace(/\/$/, "");

let credentials: Record<Role, { email: string; password: string }> = {
  admin: { email: "", password: "" },
  teacher: { email: "", password: "" },
  parent: { email: "", password: "" },
};

const roles = ["admin", "teacher", "parent"] as const;
const url = (path: string) => appBaseUrl ? `${appBaseUrl}${path}` : path;
const configured = (role: Role) => Boolean(
  supabaseUrl &&
  supabaseKey &&
  credentials[role].email &&
  credentials[role].password
);

test.beforeAll(async ({}, testInfo) => {
  if (!process.env.CI) return;
  const provisioned = await provisionStagingRoleUsers(
    testInfo.project.name + "-worker-" + testInfo.workerIndex
  );
  credentials = provisioned.credentials;
  expect(roles.every((role) => configured(role))).toBe(true);
});

async function accessToken(request: APIRequestContext, role: Role) {
  const response = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: { apikey: supabaseKey, "content-type": "application/json" },
    data: credentials[role],
  });
  expect(response.status(), `${role} authentication failed`).toBe(200);
  const body = await response.json() as { access_token?: unknown };
  expect(typeof body.access_token).toBe("string");
  expect((body.access_token as string).length).toBeGreaterThan(20);
  return body.access_token as string;
}

async function getJson(request: APIRequestContext, path: string, token: string) {
  const response = await request.get(url(path), {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(response.status(), `${path} failed`).toBe(200);
  expect(response.headers()["cache-control"] ?? "").toMatch(/private/i);
  expect(response.headers()["cache-control"] ?? "").toMatch(/no-store/i);
  return response.json() as Promise<Record<string, unknown>>;
}

async function bootstrap(request: APIRequestContext, token: string, role: Role) {
  const body = await getJson(request, "/api/mobile/bootstrap", token);
  const workspaces = Array.isArray(body.workspaces) ? body.workspaces as Workspace[] : [];
  const workspace = workspaces.find((item) => item.surface === role);
  expect(workspace, `${role} workspace missing`).toBeTruthy();
  return workspace as Workspace;
}

for (const role of roles) {
  test(`${role} authenticated mobile workspace stays scoped and read-only`, async ({ request }) => {
    test.skip(!configured(role), `Set dedicated E2E_${role.toUpperCase()}_EMAIL/PASSWORD credentials to run this smoke.`);

    const token = await accessToken(request, role);
    const workspace = await bootstrap(request, token, role);
    expect(workspace.tenantId).toBeGreaterThan(0);

    if (role === "admin") {
      expect(workspace.branchId).toBeGreaterThan(0);
      const body = await getJson(request, `/api/mobile/home?tenantId=${workspace.tenantId}&branchId=${workspace.branchId}`, token);
      expect(body.readOnly).toBe(true);
      expect(body.surface).toBe("admin");
      return;
    }

    if (role === "teacher") {
      expect(workspace.branchId).toBeGreaterThan(0);
      const path = workspace.accessMode === "portal"
        ? `/api/mobile/portal/home?tenantId=${workspace.tenantId}&branchId=${workspace.branchId}&surface=teacher`
        : `/api/mobile/home?tenantId=${workspace.tenantId}&branchId=${workspace.branchId}`;
      const body = await getJson(request, path, token);
      expect(body.readOnly).toBe(true);
      expect(body.surface).toBe("teacher");
      return;
    }

    const body = await getJson(request, `/api/mobile/portal/home?tenantId=${workspace.tenantId}&surface=parent`, token);
    expect(body.readOnly).toBe(true);
    expect(body.surface).toBe("parent");
    expect(Array.isArray(body.children)).toBe(true);
  });
}
