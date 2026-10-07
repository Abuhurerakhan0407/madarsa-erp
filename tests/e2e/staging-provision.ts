import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STAGING_REF = "loihcxyblzdfiogrdihm";
const STAGING_SUPABASE_URL = `https://${STAGING_REF}.supabase.co`;

type Role = "admin" | "teacher" | "parent";
type PortalCredential = { email: string; password: string; username?: string };
type Credentials = Record<Role, PortalCredential>;
type Provisioned = { credentials: Credentials };

const clean = (value: string | undefined) => (value ?? "").trim().replace(/^['"]|['"]$/g, "");
const password = () => randomBytes(18).toString("base64url") + "aA1!";

function requireStaging(url: string, key: string) {
  if (!process.env.CI) throw new Error("Staging role provisioning is CI-only.");
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error("Refusing to seed an invalid Supabase project URL.");
  }
  if (hostname !== (STAGING_REF + ".supabase.co")) {
    throw new Error("Refusing to seed a non-staging Supabase project.");
  }
  if (!key) throw new Error("A staging admin API key is required for E2E provisioning.");
}

async function isValidAdminKey(url: string, key: string) {
  try {
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
      },
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

async function resolveAdminKey(url: string, candidates: string[]) {
  for (const candidate of candidates) {
    if (candidate && await isValidAdminKey(url, candidate)) return candidate;
  }
  throw new Error("No valid staging admin API key was accepted. Refresh the GitHub Actions secret with the exact staging key; do not trim or alter it.");
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

async function ensureUser(
  admin: SupabaseClient,
  email: string,
  portalAccount: boolean,
  appMetadata?: Record<string, unknown>,
) {
  const nextPassword = password();
  const existing = await findUser(admin, email);
  if (existing) {
    const updated = await admin.auth.admin.updateUserById(existing.id, {
      password: nextPassword,
      email_confirm: true,
      app_metadata: {
        ...existing.app_metadata,
        ...(portalAccount ? { portal_account: true } : {}),
        ...appMetadata,
      },
    });
    if (updated.error || !updated.data.user) throw new Error("Unable to reset staging E2E user: " + email);
    return { id: updated.data.user.id, email, password: nextPassword };
  }

  const created = await admin.auth.admin.createUser({
    email,
    password: nextPassword,
    email_confirm: true,
    app_metadata: {
      ...(portalAccount ? { portal_account: true } : {}),
      ...(appMetadata ?? {}),
    },
  });
  if (created.error || !created.data.user) throw new Error("Unable to create staging E2E user: " + email);
  return { id: created.data.user.id, email, password: nextPassword };
}

export async function provisionStagingRoleUsers(projectName: string): Promise<Provisioned> {
  const supabaseUrl = STAGING_SUPABASE_URL;
  const secret = clean(process.env.SUPABASE_SECRET_KEY);
  const legacyServiceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  requireStaging(supabaseUrl, secret || legacyServiceRoleKey);
  const adminKey = await resolveAdminKey(supabaseUrl, [secret, legacyServiceRoleKey]);
  const admin = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const suffix = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const domain = "example.com";
  const usernameAlphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const usernameDigest = createHash("sha256").update(suffix).digest();
  const parentUsername = "e2e-" +
    Array.from({ length: 6 }, (_, index) => usernameAlphabet[usernameDigest[index] % usernameAlphabet.length]).join("");
  const accounts = {
    admin: await ensureUser(admin, "ilmgaah-e2e-admin-" + suffix + "@" + domain, false),
    teacher: await ensureUser(admin, "ilmgaah-e2e-teacher-" + suffix + "@" + domain, true),
    parent: await ensureUser(
      admin,
      parentUsername + "@parents.ilmgaah.in",
      true,
      {
        must_change_password: true,
        portal_login_method: "username",
        portal_username: parentUsername,
      },
    ),
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
  let membershipId: number;
  if (existingMembership.data) {
    tenantId = existingMembership.data.tenant_id;
    membershipId = existingMembership.data.id;
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
    membershipId = Number(bootstrap.data.membership_id);
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

  const employeeSequence = await admin.from("number_sequences")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("key", "employee_default")
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (employeeSequence.error) {
    throw new Error("Unable to inspect staging employee numbering: " + employeeSequence.error.message);
  }
  if (!employeeSequence.data) {
    const createdEmployeeSequence = await admin.from("number_sequences").insert({
      tenant_id: tenantId,
      branch_id: branchId,
      key: "employee_default",
      entity_type: "employee",
      version: 1,
      pattern: "EMP-{BRANCH}-{SEQ}",
      next_value: 1,
      padding: 4,
      reset_period: "never",
      reserved_values: [],
      status: "published",
      effective_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      created_by_membership_id: membershipId,
      published_by_membership_id: membershipId,
    }).select("id").single();
    if (createdEmployeeSequence.error || !createdEmployeeSequence.data) {
      throw new Error("Unable to create staging employee numbering: " + (createdEmployeeSequence.error?.message ?? "unknown error"));
    }
  }
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
  let studentPersonId: number;
  let guardianPersonId: number;
  if (student.data) {
    studentPersonId = Number(student.data.person_id);
    const guardian = await admin.from("person_relationships").select("source_person_id").eq("tenant_id", tenantId).eq("target_person_id", studentPersonId).eq("status", "verified").eq("portal_visibility", "standard").order("id").limit(1).maybeSingle();
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
    if (created.error || !created.data?.guardian_person_id || !created.data?.person_id) {
      throw new Error("Unable to create staging student/guardian: " + (created.error?.message ?? "unknown error"));
    }
    studentPersonId = Number(created.data.person_id);
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

  const parentProfile = await admin.from("guardian_profiles")
    .select("portal_username")
    .eq("tenant_id", tenantId)
    .eq("person_id", guardianPersonId)
    .maybeSingle();
  if (parentProfile.error || !parentProfile.data?.portal_username) {
    throw new Error("Unable to resolve canonical staging parent username: " + (parentProfile.error?.message ?? "missing username"));
  }

  const teacherProfile = await admin.from("employee_profiles")
    .select("portal_username")
    .eq("tenant_id", tenantId)
    .eq("person_id", teacherPersonId)
    .maybeSingle();
  if (teacherProfile.error || !teacherProfile.data?.portal_username) {
    throw new Error("Unable to resolve canonical staging teacher username: " + (teacherProfile.error?.message ?? "missing username"));
  }

  const today = new Date().toISOString().slice(0, 10);
  const hostelKey = "e2e-hostel-" + suffix;
  const existingHostel = await admin.from("hostels")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("key", hostelKey)
    .maybeSingle();
  if (existingHostel.error) throw new Error("Unable to inspect staging Hostel fixture: " + existingHostel.error.message);
  let hostelId: number;
  if (existingHostel.data) {
    hostelId = existingHostel.data.id;
  } else {
    const madeHostel = await admin.rpc("create_hostel_v1", {
      p_identity_id: accounts.admin.id,
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_key: hostelKey,
      p_labels: { en: "E2E Hostel", ur: "ای ٹو ای ہاسٹل" },
      p_warden_person_id: null,
      p_rules: {},
    });
    if (madeHostel.error || !madeHostel.data?.hostel_id) {
      const racedHostel = await admin.from("hostels")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("branch_id", branchId)
        .eq("key", hostelKey)
        .maybeSingle();
      if (racedHostel.error || !racedHostel.data) {
        throw new Error("Unable to create staging Hostel fixture: " + (madeHostel.error?.message ?? "unknown error"));
      }
      hostelId = racedHostel.data.id;
    } else {
      hostelId = Number(madeHostel.data.hostel_id);
    }
  }

  const existingBed = await admin.from("hostel_beds")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("hostel_id", hostelId)
    .eq("building_key", "a")
    .eq("room_key", "101")
    .eq("bed_key", "01")
    .maybeSingle();
  if (existingBed.error) throw new Error("Unable to inspect staging bed fixture: " + existingBed.error.message);
  let bedId: number;
  if (existingBed.data) {
    bedId = existingBed.data.id;
  } else {
    const madeBed = await admin.rpc("add_hostel_bed_v1", {
      p_identity_id: accounts.admin.id,
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_hostel_id: hostelId,
      p_building_key: "a",
      p_floor_key: "1",
      p_room_key: "101",
      p_bed_key: "01",
      p_category: "standard",
    });
    if (madeBed.error || !madeBed.data?.bed_id) {
      const racedBed = await admin.from("hostel_beds")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("hostel_id", hostelId)
        .eq("building_key", "a")
        .eq("room_key", "101")
        .eq("bed_key", "01")
        .maybeSingle();
      if (racedBed.error || !racedBed.data) {
        throw new Error("Unable to create staging bed fixture: " + (madeBed.error?.message ?? "unknown error"));
      }
      bedId = racedBed.data.id;
    } else {
      bedId = Number(madeBed.data.bed_id);
    }
  }

  const existingAllocation = await admin.from("hostel_allocations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("student_person_id", studentPersonId)
    .in("state", ["allocated", "occupied", "temporary_leave"])
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingAllocation.error) throw new Error("Unable to inspect staging resident fixture: " + existingAllocation.error.message);
  let allocationId: number;
  if (existingAllocation.data) {
    allocationId = existingAllocation.data.id;
  } else {
    const allocated = await admin.rpc("allocate_hostel_bed_v1", {
      p_identity_id: accounts.admin.id,
      p_tenant_id: tenantId,
      p_student_person_id: studentPersonId,
      p_bed_id: bedId,
      p_branch_id: branchId,
      p_starts_on: today,
      p_ends_on: null,
    });
    if (allocated.error || !allocated.data?.allocation_id) {
      throw new Error("Unable to allocate staging resident fixture: " + (allocated.error?.message ?? "unknown error"));
    }
    allocationId = Number(allocated.data.allocation_id);
  }

  const existingVisitor = await admin.from("hostel_visitors")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("allocation_id", allocationId)
    .eq("visitor_identity_snapshot->>name", "E2E Visitor")
    .is("checked_out_at", null)
    .limit(1)
    .maybeSingle();
  if (existingVisitor.error) throw new Error("Unable to inspect staging visitor fixture: " + existingVisitor.error.message);
  if (!existingVisitor.data) {
    const visitor = await admin.rpc("check_in_hostel_visitor_v1", {
      p_identity_id: accounts.admin.id,
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_allocation_id: allocationId,
      p_visitor_snapshot: { name: "E2E Visitor" },
      p_purpose: "E2E acceptance",
      p_restriction_flags: {},
    });
    if (visitor.error) throw new Error("Unable to create staging visitor fixture: " + visitor.error.message);
  }

  const existingIncident = await admin.from("hostel_incidents")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("allocation_id", allocationId)
    .limit(1)
    .maybeSingle();
  if (existingIncident.error) throw new Error("Unable to inspect staging incident fixture: " + existingIncident.error.message);
  if (!existingIncident.data) {
    const incident = await admin.rpc("record_hostel_incident_v1", {
      p_identity_id: accounts.admin.id,
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_allocation_id: allocationId,
      p_category: "E2E",
      p_severity: "low",
      p_restricted_details: { summary: "E2E acceptance fixture" },
      p_action_summary: { status: "recorded" },
    });
    if (incident.error) throw new Error("Unable to create staging incident fixture: " + incident.error.message);
  }

  const messKey = "e2e-mess-" + suffix;
  const existingMess = await admin.from("mess_units")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("key", messKey)
    .maybeSingle();
  if (existingMess.error) throw new Error("Unable to inspect staging Mess fixture: " + existingMess.error.message);
  let messUnitId: number;
  if (existingMess.data) {
    messUnitId = existingMess.data.id;
  } else {
    const madeMess = await admin.rpc("create_mess_unit_v1", {
      p_identity_id: accounts.admin.id,
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_key: messKey,
      p_labels: { en: "E2E Mess", ur: "ای ٹو ای میس" },
    });
    if (madeMess.error || !madeMess.data?.mess_unit_id) {
      throw new Error("Unable to create staging Mess fixture: " + (madeMess.error?.message ?? "unknown error"));
    }
    messUnitId = Number(madeMess.data.mess_unit_id);
  }

  const existingMeal = await admin.from("mess_meal_services")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("mess_unit_id", messUnitId)
    .eq("meal_type", "lunch")
    .eq("serving_date", today)
    .maybeSingle();
  if (existingMeal.error) throw new Error("Unable to inspect staging meal fixture: " + existingMeal.error.message);
  let mealServiceId: number;
  if (existingMeal.data) {
    mealServiceId = existingMeal.data.id;
  } else {
    const meal = await admin.rpc("create_mess_meal_service_v1", {
      p_identity_id: accounts.admin.id,
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_mess_unit_id: messUnitId,
      p_meal_type: "lunch",
      p_serving_date: today,
      p_expected_count: 1,
    });
    if (meal.error || !meal.data?.meal_service_id) {
      throw new Error("Unable to create staging meal fixture: " + (meal.error?.message ?? "unknown error"));
    }
    mealServiceId = Number(meal.data.meal_service_id);
  }

  const attendance = await admin.rpc("record_mess_attendance_v1", {
    p_identity_id: accounts.admin.id,
    p_tenant_id: tenantId,
    p_branch_id: branchId,
    p_meal_service_id: mealServiceId,
    p_person_id: studentPersonId,
    p_served_count: 1,
    p_request_key: "e2e-mess-attendance-" + suffix,
  });
  if (attendance.error) throw new Error("Unable to prepare staging meal attendance fixture: " + attendance.error.message);

  return {
    credentials: {
      admin: accounts.admin,
      teacher: { ...accounts.teacher, username: teacherProfile.data.portal_username },
      parent: { ...accounts.parent, username: parentProfile.data.portal_username },
    },
  };
}
