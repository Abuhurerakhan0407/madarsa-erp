import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STAGING_REF = "loihcxyblzdfiogrdihm";

type Role = "admin" | "teacher" | "parent";
type Credentials = Record<Role, { email: string; password: string }>;
type Provisioned = { credentials: Credentials };

const clean = (value: string | undefined) => (value ?? "").trim().replace(/^['"]|['"]$/g, "");
const password = () => randomBytes(18).toString("base64url") + "aA1!";

function requireStaging(url: string, secret: string) {
  if (!process.env.CI) throw new Error("Staging role provisioning is CI-only.");
  const normalized = url.replace(/\/$/, "");
  if (!normalized.endsWith("." + STAGING_REF + ".supabase.co")) {
    throw new Error("Refusing to seed a non-staging Supabase project.");
  }
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is required for staging E2E provisioning.");
}

async function findUser(admin: SupabaseClient, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (result.error) throw new Error("Unable to inspect staging auth users: " + result.error.message);
    const user = result.data.users.find((item) => (item.email ?? "").toLowerCase() === email);
    if (user) return user;
    if (result.data.users.length < 100) return null;
  }
  return null;
}

async function ensureUser(admin: SupabaseClient, email: string, portalAccount: boolean) {
  const nextPassword = password();
  const existing = await findUser(admin, email);
  if (existing) {
    const updated = await admin.auth.admin.updateUserById(existing.id, {
      password: nextPassword,
      email_confirm: true,
      app_metadata: { ...existing.app_metadata, ...(portalAccount ? { portal_account: true } : {}) },
    });
    if (updated.error || !updated.data.user) throw new Error("Unable to reset staging E2E user: " + email);
    return { id: updated.data.user.id, email, password: nextPassword };
  }

  const created = await admin.auth.admin.createUser({
    email,
    password: nextPassword,
    email_confirm: true,
    app_metadata: portalAccount ? { portal_account: true } : {},
  });
  if (created.error || !created.data.user) throw new Error("Unable to create staging E2E user: " + email);
  return { id: created.data.user.id, email, password: nextPassword };
}

export async function provisionStagingRoleUsers(projectName: string): Promise<Provisioned> {
  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const secret = clean(process.env.SUPABASE_SECRET_KEY);
  requireStaging(supabaseUrl, secret);
  const admin = createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const suffix = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const domain = "example.com";
  const accounts = {
    admin: await ensureUser(admin, "ilmgaah-e2e-admin-" + suffix + "@" + domain, false),
    teacher: await ensureUser(admin, "ilmgaah-e2e-teacher-" + suffix + "@" + domain, true),
    parent: await ensureUser(admin, "ilmgaah-e2e-parent-" + suffix + "@" + domain, true),
  };

  const existingMembership = await admin.from("memberships")
    .select("id, tenant_id")
    .eq("identity_id", accounts.admin.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingMembership.error) throw new Error("Unable to resolve staging membership: " + existingMembership.error.message);

  let tenantId: number;
  let branchId: number;
  if (existingMembership.data) {
    tenantId = existingMembership.data.tenant_id;
    const branch = await admin.from("branches").select("id").eq("tenant_id", tenantId).eq("status", "active").order("id").limit(1).maybeSingle();
    if (branch.error || !branch.data) throw new Error("Existing staging E2E tenant has no active branch.");
    branchId = branch.data.id;
  } else {
    const bootstrap = await admin.rpc("bootstrap_tenant", {
      p_identity_id: accounts.admin.id,
      p_display_name: "Ilmgaah E2E Admin",
      p_institution_name: "Ilmgaah E2E " + suffix,
      p_slug: "ilmgaah-e2e-" + suffix,
      p_branch_name: "Main Branch",
      p_branch_code: "MAIN",
    });
    if (bootstrap.error || !bootstrap.data) throw new Error("Unable to bootstrap staging E2E tenant: " + (bootstrap.error?.message ?? "unknown error"));
    tenantId = Number(bootstrap.data.tenant_id);
    branchId = Number(bootstrap.data.branch_id);
  }
  const activated = await admin.from("tenants").update({ state: "active" }).eq("id", tenantId).select("id, state").single();
  if (activated.error || activated.data?.state !== "active") throw new Error("Unable to activate staging E2E tenant.");

  const session = await admin.from("academic_sessions").upsert({
    tenant_id: tenantId,
    key: "e2e_2026",
    labels: { en: "E2E Session", ur: "ای ٹو ای سیشن", ar: "جلسة الاختبار" },
    starts_on: "2026-01-01",
    ends_on: "2027-12-31",
    status: "active",
    is_default: true,
  }, { onConflict: "tenant_id,key" }).select("id").single();
  if (session.error || !session.data) throw new Error("Unable to prepare staging academic session: " + (session.error?.message ?? "unknown error"));

  const program = await admin.from("programs").upsert({
    tenant_id: tenantId,
    branch_id: branchId,
    key: "e2e_general",
    labels: { en: "E2E General", ur: "ای ٹو ای عمومی", ar: "عام الاختبار" },
    program_type: "general",
    allows_concurrent_enrollment: true,
    status: "active",
  }, { onConflict: "tenant_id,key" }).select("id").single();
  if (program.error || !program.data) throw new Error("Unable to prepare staging program: " + (program.error?.message ?? "unknown error"));

  const numbering = await admin.rpc("setup_student_number_sequence", {
    p_identity_id: accounts.admin.id,
    p_tenant_id: tenantId,
    p_branch_id: branchId,
    p_pattern: "E2E-{BRANCH}-{SESSION}-{SEQ}",
    p_start_value: 1,
    p_padding: 4,
    p_reset_period: "session",
  });
  if (numbering.error) throw new Error("Unable to prepare staging student numbering: " + numbering.error.message);
  const teacherEmployment = await admin.from("hr_employments").select("employee_person_id").eq("tenant_id", tenantId).eq("branch_id", branchId).eq("state", "active").order("id", { ascending: true }).limit(1).maybeSingle();
  let teacherPersonId: number;
  if (teacherEmployment.data) {
    teacherPersonId = teacherEmployment.data.employee_person_id;
  } else {
    const made = await admin.rpc("create_hr_employee_v1", {
      p_identity_id: accounts.admin.id,
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_display_name: "E2E Teacher",
      p_preferred_locale: "en",
      p_department_key: "academics",
      p_designation: "Teacher",
      p_contract_type: "permanent",
      p_joined_on: "2026-01-01",
      p_payroll_eligible: false,
    });
    if (made.error || !made.data) throw new Error("Unable to create staging teacher: " + (made.error?.message ?? "unknown error"));
    teacherPersonId = Number(made.data.person_id);
  }

  const student = await admin.from("student_profiles")
    .select("person_id")
    .eq("tenant_id", tenantId)
    .order("person_id", { ascending: true })
    .limit(1)
    .maybeSingle();
  let guardianPersonId: number;
  if (student.data) {
    const guardian = await admin.from("person_relationships").select("source_person_id").eq("tenant_id", tenantId).eq("target_person_id", student.data.person_id).eq("status", "verified").eq("portal_visibility", "standard").order("id").limit(1).maybeSingle();
    if (guardian.error || !guardian.data) throw new Error("Existing staging student has no verified guardian.");
    guardianPersonId = guardian.data.source_person_id;
  } else {
    const created = await admin.rpc("create_student_direct", {
      p_identity_id: accounts.admin.id,
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_display_name: "E2E Student",
      p_preferred_locale: "en",
      p_session_id: session.data.id,
      p_program_id: program.data.id,
      p_joined_on: "2026-01-02",
      p_guardian: { name: "E2E Parent", relationship: "father", phone: "+919900000001" },
      p_confirm_new_person: true,
    });
    if (created.error || !created.data?.guardian_person_id) throw new Error("Unable to create staging student/guardian: " + (created.error?.message ?? "unknown error"));
    guardianPersonId = Number(created.data.guardian_person_id);
  }

  const teacherLink = await admin.rpc("link_portal_identity_v1", {
    p_identity_id: accounts.admin.id,
    p_tenant_id: tenantId,
    p_branch_id: branchId,
    p_person_id: teacherPersonId,
    p_link_type: "employee",
    p_portal_identity_id: accounts.teacher.id,
  });
  if (teacherLink.error) throw new Error("Unable to link staging teacher portal: " + teacherLink.error.message);
  const parentLink = await admin.rpc("link_portal_identity_v1", {
    p_identity_id: accounts.admin.id,
    p_tenant_id: tenantId,
    p_branch_id: branchId,
    p_person_id: guardianPersonId,
    p_link_type: "guardian",
    p_portal_identity_id: accounts.parent.id,
  });
  if (parentLink.error) throw new Error("Unable to link staging parent portal: " + parentLink.error.message);

  return { credentials: { admin: accounts.admin, teacher: accounts.teacher, parent: accounts.parent } };
}
