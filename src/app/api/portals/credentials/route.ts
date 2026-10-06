import { NextResponse } from "next/server";
import { getPortalOperatorCenter } from "@/lib/portal/runtime";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";
import {
  buildParentSyntheticEmail,
  buildTeacherSyntheticEmail,
  validUsernameParentPassword
} from "@/lib/portal/parent-login";
import { generateParentTemporaryPassword } from "@/lib/portal/parent-login-server";

type Kind = "guardian" | "employee";
type Action = "provision" | "provision_username" | "reset";
type AuditOutcome = "allowed" | "succeeded" | "failed";

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const validStaffPassword = (value: string) =>
  value.length >= 12
  && value.length <= 128
  && /[a-z]/.test(value)
  && /[A-Z]/.test(value)
  && /[0-9]/.test(value)
  && /[^A-Za-z0-9]/.test(value);

async function compensate(admin: ReturnType<typeof createAdminClient>, id: string) {
  try { await admin.auth.admin.deleteUser(id); } catch { /* best-effort rollback */ }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const parsed = await readBoundedJson(request, 8192);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  }

  const body = parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value)
    ? parsed.value as Record<string, unknown>
    : {};
  const personId = Number(body.personId);
  const kind = body.kind as Kind;
  const action = body.action as Action;
  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const confirmEmail = normalizeEmail(typeof body.confirmEmail === "string" ? body.confirmEmail : "");
  const requestedUsername = typeof body.username === "string" ? body.username.trim().toUpperCase() : "";
  let temporaryPassword = typeof body.temporaryPassword === "string" ? body.temporaryPassword : "";

  if (!Number.isSafeInteger(personId) || personId <= 0 || !["guardian", "employee"].includes(kind) || !["provision", "provision_username", "reset"].includes(action)) {
    return NextResponse.json({ error: "Portal credential request is invalid." }, { status: 400 });
  }
  if (action === "provision_username" && !["guardian", "employee"].includes(kind)) {
    return NextResponse.json({ error: "Unsupported username login kind." }, { status: 400 });
  }

  const actorIdentityId = identity.id;
  const tenantId = workspace.tenantId;
  const branchId = workspace.branchId;
  const admin = createAdminClient();
  const permission = await admin.rpc("operator_has_permission_v1", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_permission_code: "portal.credentials.create"
  });
  if (permission.error) return NextResponse.json({ error: "Unable to verify portal credential permission." }, { status: 500 });
  if (permission.data !== true) return NextResponse.json({ error: "Portal credential permission required." }, { status: 403 });

  const center = await getPortalOperatorCenter();
  const target = (kind === "guardian" ? center.parents : center.teachers).find((item) => item.personId === personId);
  if (!target) return NextResponse.json({ error: "Portal person is not eligible in this branch." }, { status: 404 });

  const usernameAction = action === "provision_username";
  const usernameAccount = target.loginMethod === "username";
  const usernamePattern = kind === "guardian" ? /^PAR-[0-9]{6}$/ : /^UST-[0-9]{6}$/;
  let targetUsername = target.portalUsername ? target.portalUsername.trim().toUpperCase() : null;

  if (usernameAction && requestedUsername && requestedUsername !== targetUsername) {
    if (target.accountStatus !== "not_created") {
      return NextResponse.json({ error: "Existing portal accounts keep their current username. Reset its password instead." }, { status: 409 });
    }
    if (!usernamePattern.test(requestedUsername)) {
      return NextResponse.json({ error: kind === "guardian" ? "Parent username must match PAR-######." : "Teacher username must match UST-######." }, { status: 400 });
    }
    const update = kind === "guardian"
      ? await admin.from("guardian_profiles").update({ portal_username: requestedUsername }).eq("tenant_id", tenantId).eq("person_id", personId)
      : await admin.from("employee_profiles").update({ portal_username: requestedUsername }).eq("tenant_id", tenantId).eq("person_id", personId);
    if (update.error) {
      if (update.error.code === "23505") {
        return NextResponse.json({ error: "That username is already assigned. Choose another." }, { status: 409 });
      }
      return NextResponse.json({ error: "Unable to save portal username." }, { status: 503 });
    }
    targetUsername = requestedUsername;
  }

  if (usernameAction && !targetUsername) {
    return NextResponse.json({ error: "Unable to allocate this portal username." }, { status: 503 });
  }

  if (!usernameAction && action === "provision" && (!validEmail(email) || email !== confirmEmail)) {
    return NextResponse.json({ error: "Enter the same valid email address twice." }, { status: 400 });
  }
  if (!usernameAction && action === "reset" && target.loginMethod !== "username" && (!validEmail(email) || email !== confirmEmail)) {
    return NextResponse.json({ error: "Enter the same valid email address twice." }, { status: 400 });
  }

  if (usernameAction || usernameAccount) {
    if (!temporaryPassword) temporaryPassword = generateParentTemporaryPassword();
    if (!validUsernameParentPassword(temporaryPassword)) {
      return NextResponse.json({ error: "Generated parent password did not meet policy." }, { status: 500 });
    }
  } else if (!validStaffPassword(temporaryPassword)) {
    return NextResponse.json({ error: "Use 12–128 characters with uppercase, lowercase, number, and symbol." }, { status: 400 });
  }

  if (!usernameAction && action === "provision") {
    if (target.email && normalizeEmail(target.email) !== email) {
      return NextResponse.json({ error: "Email must match the person's saved email address." }, { status: 409 });
    }
    if (!target.email) {
      const duplicate = await admin
        .from("person_contacts")
        .select("person_id")
        .eq("tenant_id", workspace.tenantId)
        .eq("type", "email")
        .eq("normalized_value", email)
        .neq("person_id", personId)
        .limit(1);
      if (duplicate.error) return NextResponse.json({ error: "Unable to verify email uniqueness." }, { status: 500 });
      if ((duplicate.data?.length ?? 0) > 0) {
        return NextResponse.json({ error: "This email is already assigned to another person." }, { status: 409 });
      }
      const saved = await admin.from("person_contacts").insert({
        tenant_id: workspace.tenantId,
        person_id: personId,
        type: "email",
        label: "Portal contact",
        value: email,
        normalized_value: email,
        is_primary: true,
        is_verified: false,
        consent: { source: "portal_access_center", captured_by_identity_id: actorIdentityId },
        visibility: "portal"
      });
      if (saved.error) return NextResponse.json({ error: "Unable to save portal email." }, { status: 503 });
    }
  }

  async function audit(outcome: AuditOutcome) {
    const result = await admin.rpc("record_portal_credential_audit_v1", {
      p_identity_id: actorIdentityId,
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_person_id: personId,
      p_link_type: kind,
      p_credential_action: action === "reset" ? "reset" : "create",
      p_outcome: outcome
    });
    if (result.error) throw new Error(result.error.message);
  }

  try { await audit("allowed"); } catch {
    return NextResponse.json({ error: "Unable to record credential security audit." }, { status: 503 });
  }

  const links = await admin
    .from("identity_person_links")
    .select("identity_id,status,updated_at")
    .eq("tenant_id", workspace.tenantId)
    .eq("person_id", personId)
    .eq("link_type", kind)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (links.error) {
    await audit("failed").catch(() => {});
    return NextResponse.json({ error: "Unable to resolve portal identity." }, { status: 500 });
  }
  const linked = links.data?.[0];

  if (action === "reset") {
    if (!linked?.identity_id) {
      await audit("failed").catch(() => {});
      return NextResponse.json({ error: "Create this portal account before resetting its password." }, { status: 409 });
    }
    const user = await admin.auth.admin.getUserById(String(linked.identity_id));
    if (user.error || !user.data.user) {
      await audit("failed").catch(() => {});
      return NextResponse.json({ error: "Portal account not found." }, { status: 404 });
    }
    const isUsernameLogin = target.loginMethod === "username";
    if (user.data.user.app_metadata?.portal_account !== true && !(isUsernameLogin && kind === "employee")) {
      await audit("failed").catch(() => {});
      return NextResponse.json({ error: "This login is not an Ilmgaah-managed portal account, so its password cannot be reset here." }, { status: 409 });
    }

    if (isUsernameLogin) {
      if (!targetUsername) {
        await audit("failed").catch(() => {});
        return NextResponse.json({ error: "Portal username is missing." }, { status: 409 });
      }
    } else if (normalizeEmail(user.data.user.email ?? "") !== email) {
      await audit("failed").catch(() => {});
      return NextResponse.json({ error: "Portal login email no longer matches this person." }, { status: 409 });
    }

    const updated = await admin.auth.admin.updateUserById(user.data.user.id, {
      password: temporaryPassword,
      app_metadata: {
        ...user.data.user.app_metadata,
        portal_account: true,
        must_change_password: true,
        ...(isUsernameLogin ? {
          portal_login_method: "username",
          portal_username: targetUsername,
        } : {}),
        password_reset_from: "portal_access_center",
        password_reset_at: new Date().toISOString()
      }
    });
    if (updated.error) {
      await audit("failed").catch(() => {});
      return NextResponse.json({ error: "Unable to reset portal password." }, { status: 503 });
    }

    const auditWarning = await audit("succeeded").then(() => undefined).catch(() => "Password reset succeeded, but final audit confirmation could not be recorded.");
    const response = isUsernameLogin
      ? { credentialState: "temporary_username_password_reset", username: targetUsername, temporaryPassword, auditWarning }
      : { credentialState: "temporary_password_reset", email, temporaryPassword, auditWarning };

    return NextResponse.json(response, { status: 200, headers: { "cache-control": "no-store" } });
  }

  if (linked?.identity_id) {
    if (linked.status === "verified") {
      if (usernameAction && target.loginMethod !== "username") {
        await audit("failed").catch(() => {});
        return NextResponse.json({ error: "An existing email portal login is already linked to this guardian." }, { status: 409 });
      }
      await audit("succeeded").catch(() => {});
      return NextResponse.json(
        usernameAction
          ? { credentialState: "existing_username_account", username: targetUsername }
          : { credentialState: "existing_account", email },
        { status: 200, headers: { "cache-control": "no-store" } }
      );
    }
    await audit("failed").catch(() => {});
    return NextResponse.json(
      { error: "This portal account is disabled. Enable access instead of creating another account." },
      { status: 409 }
    );
  }

  let portalIdentityId = "";
  let created = false;
  const authEmail = usernameAction
    ? (kind === "guardian"
        ? buildParentSyntheticEmail(targetUsername as string)
        : buildTeacherSyntheticEmail(targetUsername as string))
    : email;

  const existing = await admin.rpc("find_auth_identity_by_email_v1", { p_email: authEmail });
  if (existing.error) {
    await audit("failed").catch(() => {});
    return NextResponse.json({ error: "Unable to resolve portal login identity." }, { status: 500 });
  }
  portalIdentityId = typeof existing.data === "string" ? existing.data : "";

  if (portalIdentityId) {
    const existingUser = await admin.auth.admin.getUserById(portalIdentityId);
    if (existingUser.error || !existingUser.data.user || !existingUser.data.user.email_confirmed_at) {
      await audit("failed").catch(() => {});
      return NextResponse.json({ error: "Existing login is not verified for safe linking." }, { status: 409 });
    }

    const existingMetadata = existingUser.data.user.app_metadata ?? {};
    if (usernameAction && existingMetadata.portal_account !== true) {
      await audit("failed").catch(() => {});
      return NextResponse.json({ error: "Synthetic portal login identifier is already occupied." }, { status: 409 });
    }

    const metadata = usernameAction
      ? {
          ...existingMetadata,
          portal_account: true,
          must_change_password: true,
          portal_login_method: "username",
          portal_username: targetUsername,
          password_reset_from: "portal_access_center",
          password_reset_at: new Date().toISOString()
        }
      : { ...existingMetadata, portal_account: true };

    const updated = usernameAction
      ? await admin.auth.admin.updateUserById(portalIdentityId, { password: temporaryPassword, app_metadata: metadata })
      : await admin.auth.admin.updateUserById(portalIdentityId, { app_metadata: metadata });

    if (updated.error) {
      await audit("failed").catch(() => {});
      return NextResponse.json({ error: "Unable to prepare the existing login for portal access." }, { status: 503 });
    }
  } else {
    const made = await admin.auth.admin.createUser({
      email: authEmail,
      password: temporaryPassword,
      email_confirm: true,
      app_metadata: {
        portal_account: true,
        must_change_password: true,
        ...(usernameAction ? {
          portal_login_method: "username",
          portal_username: targetUsername,
        } : {}),
        provisioned_from: "portal_access_center",
        provisioned_at: new Date().toISOString()
      }
    });
    if (made.error || !made.data.user?.id) {
      const retry = await admin.rpc("find_auth_identity_by_email_v1", { p_email: authEmail });
      if (retry.error || typeof retry.data !== "string") {
        await audit("failed").catch(() => {});
        return NextResponse.json({ error: "Unable to create portal account." }, { status: 503 });
      }
      portalIdentityId = retry.data;
      const racedUser = await admin.auth.admin.getUserById(portalIdentityId);
      const racedMetadata = racedUser.data.user?.app_metadata ?? {};
      if (
        racedUser.error
        || !racedUser.data.user
        || racedMetadata.portal_account !== true
        || (usernameAction && (
          racedMetadata.portal_login_method !== "username"
          || racedMetadata.portal_username !== targetUsername
        ))
      ) {
        await audit("failed").catch(() => {});
        return NextResponse.json({ error: "Portal account creation was already claimed." }, { status: 409 });
      }
    } else {
      portalIdentityId = made.data.user.id;
      created = true;
    }
  }

  const linkedResult = await admin.rpc("link_portal_identity_v1", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_person_id: personId,
    p_link_type: kind,
    p_portal_identity_id: portalIdentityId
  });

  if (linkedResult.error) {
    if (created) await compensate(admin, portalIdentityId);
    await audit("failed").catch(() => {});
    const message = linkedResult.error.message.includes("another person")
      ? linkedResult.error.message
      : "Unable to link portal account.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const auditWarning = await audit("succeeded")
    .then(() => undefined)
    .catch(() => "Portal access was created, but final audit confirmation could not be recorded.");

  return NextResponse.json(
    usernameAction
      ? {
          credentialState: created ? "temporary_username_created" : "temporary_username_reset",
          username: targetUsername,
          temporaryPassword,
          auditWarning
        }
      : {
          credentialState: created ? "temporary_password_created" : "existing_account_linked",
          email,
          temporaryPassword: created ? temporaryPassword : undefined,
          auditWarning
        },
    { status: created ? 201 : 200, headers: { "cache-control": "no-store" } }
  );
}
