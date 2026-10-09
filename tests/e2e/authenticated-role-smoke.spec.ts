import { expect, test, type APIRequestContext } from "@playwright/test";
import { provisionStagingRoleUsers } from "./staging-provision";

type Role = "admin" | "teacher" | "parent";
type Workspace = {
  tenantId: number;
  branchId: number | null;
  surface: Role;
  accessMode: "membership" | "portal";
};

const stripQuotes = (value: string | undefined) => (value ?? "").trim().replace(/^[\'"]|[\'"]$/g, "");
const STAGING_SUPABASE_URL = "https://loihcxyblzdfiogrdihm.supabase.co";
const supabaseUrl = STAGING_SUPABASE_URL;
const supabaseKey = stripQuotes(process.env.E2E_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const appBaseUrl = stripQuotes(process.env.E2E_APP_URL).replace(/\/$/, "");

let credentials: Record<Role, { email: string; password: string; username?: string }> = {
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
  const runId = process.env.GITHUB_RUN_ID || "local";
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT || "1";
  const projectKey = testInfo.project.name === "chromium" ? "chr" : "and";
  const fixtureSuffix =
    "ci-" + runId + "-a" + runAttempt + "-rs-" + projectKey +
    "-r" + testInfo.retry + "-w" + testInfo.workerIndex;
  const provisioned = await provisionStagingRoleUsers(fixtureSuffix);
  credentials = provisioned.credentials;
  expect(roles.every((role) => configured(role))).toBe(true);
});

async function accessToken(request: APIRequestContext, role: Role) {
  const credential = credentials[role];
  const identifier = credential.username ?? credential.email;
  const response = await request.post(url("/api/mobile/auth"), {
    headers: { "content-type": "application/json" },
    data: {
      identifier,
      password: credential.password,
    },
  });
  expect(
    response.status(),
    `${role} app mobile-auth endpoint rejected valid ${credential.username ? "username" : "email"} credentials`
  ).toBe(200);
  expect(response.headers()["cache-control"] ?? "").toMatch(/no-store/i);

  const body = await response.json() as {
    access_token?: unknown;
    refresh_token?: unknown;
    token_type?: unknown;
    user?: unknown;
  };
  expect(typeof body.access_token).toBe("string");
  expect((body.access_token as string).length).toBeGreaterThan(20);
  expect(typeof body.refresh_token).toBe("string");
  expect(typeof body.user).toBe("object");
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

async function exerciseParentUsernameLogin(request: APIRequestContext) {
  const username = credentials.parent.username;
  expect(username).toMatch(/^PAR-[0-9]{6}$/);

  const requestOrigin = appBaseUrl || "http://localhost:3000";
  const response = await request.post(url("/api/auth/login"), {
    headers: {
      origin: requestOrigin,
      referer: requestOrigin + "/login",
      "content-type": "application/json",
    },
    data: {
      identifier: username,
      password: credentials.parent.password,
    },
  });

  expect(response.status(), "parent username login endpoint rejected valid staging credentials").toBe(200);
  await expect(response.json()).resolves.toMatchObject({ signedIn: true });
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

    if (role === "parent") {
      await exerciseParentUsernameLogin(request);
    }

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
      if (!workspace.branchId) throw new Error("Teacher workspace branch missing.");
      const teacherBranchId = workspace.branchId;
      expect(teacherBranchId).toBeGreaterThan(0);
      const path = workspace.accessMode === "portal"
        ? `/api/mobile/portal/home?tenantId=${workspace.tenantId}&branchId=${teacherBranchId}&surface=teacher`
        : `/api/mobile/home?tenantId=${workspace.tenantId}&branchId=${teacherBranchId}`;
      const body = await getJson(request, path, token);
      expect(body.readOnly).toBe(true);
      expect(body.surface).toBe("teacher");

      // The same verified teacher identity must not read another/unassigned branch.
      const outsideBranch = await request.get(url(
        `/api/mobile/portal/home?tenantId=${workspace.tenantId}&branchId=${teacherBranchId + 987654321}&surface=teacher`
      ), { headers: { authorization: `Bearer ${token}` } });
      expect(outsideBranch.status()).toBe(403);
      await expect(outsideBranch.json()).resolves.toMatchObject({ error: "portal_scope_denied" });
      return;
    }

    const body = await getJson(request, `/api/mobile/portal/home?tenantId=${workspace.tenantId}&surface=parent`, token);
    expect(body.readOnly).toBe(true);
    expect(body.surface).toBe("parent");
    expect(Array.isArray(body.children)).toBe(true);
    expect((body.children as unknown[]).length).toBeGreaterThan(0);

    // A parent token must not resolve another tenant's parent-home data.
    const outsideTenant = await request.get(url(
      `/api/mobile/portal/home?tenantId=${workspace.tenantId + 987654321}&surface=parent`
    ), { headers: { authorization: `Bearer ${token}` } });
    expect(outsideTenant.status()).toBe(403);
    await expect(outsideTenant.json()).resolves.toMatchObject({ error: "portal_scope_denied" });
  });
}
