import { createAdminClient } from "@/lib/supabase/admin";
import { publicAdmissionsE2EFixture } from "./public-intake-e2e-fixture";
import type {
  PublicAdmissionField,
  PublicAdmissionSection
} from "./public-intake-model";

const allowedTenantStates = ["onboarding", "trial", "active", "grace"] as const;
const supportedFieldTypes = new Set(["short_text", "long_text", "email", "phone", "date"]);

type LocalizedLabels = Record<string, string>;

type IntakeOption = {
  key: string;
  labels: LocalizedLabels;
};

export type PublicAdmissionsContext = {
  tenant: {
    id: number;
    name: string;
    slug: string;
    clientProfile: string;
  };
  branch: {
    id: number;
    name: string;
  };
  sessions: Array<IntakeOption & { startsOn: string; endsOn: string; isDefault: boolean }>;
  programs: Array<IntakeOption & { programType: string }>;
  groups: Array<IntakeOption & { sessionKey: string; programKey: string }>;
  form: {
    versionId: number;
    labels: LocalizedLabels;
    sections: PublicAdmissionSection[];
  };
  workflowVersionId: number;
};

function asLabels(value: unknown): LocalizedLabels | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const en = typeof source.en === "string" ? source.en : "";
  const ur = typeof source.ur === "string" ? source.ur : "";
  const ar = typeof source.ar === "string" ? source.ar : "";
  if (!en || !ur || !ar) return null;
  return { en, ur, ar };
}

function parseSections(value: unknown): PublicAdmissionSection[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const sections: PublicAdmissionSection[] = [];

  for (const rawSection of value) {
    if (!rawSection || typeof rawSection !== "object" || Array.isArray(rawSection)) return null;
    const section = rawSection as Record<string, unknown>;
    const key = typeof section.key === "string" ? section.key : "";
    const labels = asLabels(section.labels);
    if (!key || !labels || !Array.isArray(section.fields)) return null;

    const fields: PublicAdmissionField[] = [];
    for (const rawField of section.fields) {
      if (!rawField || typeof rawField !== "object" || Array.isArray(rawField)) return null;
      const field = rawField as Record<string, unknown>;
      const fieldKey = typeof field.key === "string" ? field.key : "";
      const type = typeof field.type === "string" ? field.type : "";
      const fieldLabels = asLabels(field.labels);
      if (!fieldKey || !fieldLabels || !supportedFieldTypes.has(type)) return null;
      fields.push({
        key: fieldKey,
        type,
        labels: fieldLabels,
        required: field.required === true
      });
    }

    if (fields.length === 0) return null;
    sections.push({ key, labels, fields });
  }

  return sections;
}

export async function getPublicAdmissionsContext(
  tenantSlug: string
): Promise<PublicAdmissionsContext | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantSlug)) return null;

  // Playwright's UI fixture is deliberately explicit and slug-scoped. It keeps
  // browser regression tests deterministic without weakening production's
  // database-backed public admission flow or accepting invalid credentials.
  if (
    process.env.ILMGAAH_E2E_FIXTURES === "1" &&
    tenantSlug === publicAdmissionsE2EFixture.tenant.slug
  ) {
    return publicAdmissionsE2EFixture;
  }

  const admin = createAdminClient();
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id, name, slug, state, primary_branch_id, client_profile")
    .eq("slug", tenantSlug)
    .in("state", [...allowedTenantStates])
    .maybeSingle();

  if (tenantError) throw new Error(`Unable to resolve admissions tenant: ${tenantError.message}`);
  if (!tenant?.primary_branch_id) return null;

  const { data: branch, error: branchError } = await admin
    .from("branches")
    .select("id, name, status")
    .eq("tenant_id", tenant.id)
    .eq("id", tenant.primary_branch_id)
    .eq("status", "active")
    .maybeSingle();

  if (branchError) throw new Error(`Unable to resolve admissions branch: ${branchError.message}`);
  if (!branch) return null;

  const [sessionsResult, programsResult, groupsResult, formDefinitionResult, workflowDefinitionResult] =
    await Promise.all([
      admin
        .from("academic_sessions")
        .select("id, key, labels, starts_on, ends_on, status, is_default")
        .eq("tenant_id", tenant.id)
        .eq("status", "active")
        .order("is_default", { ascending: false })
        .order("starts_on", { ascending: false }),
      admin
        .from("programs")
        .select("id, key, labels, program_type, branch_id, status")
        .eq("tenant_id", tenant.id)
        .eq("status", "active")
        .or(`branch_id.is.null,branch_id.eq.${branch.id}`)
        .order("created_at", { ascending: true }),
      admin
        .from("academic_groups")
        .select("id, key, labels, session_id, program_id, status")
        .eq("tenant_id", tenant.id)
        .eq("branch_id", branch.id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      admin
        .from("form_definitions")
        .select("id, status, audience")
        .eq("tenant_id", tenant.id)
        .eq("key", "admission_application")
        .eq("status", "active")
        .eq("audience", "public")
        .maybeSingle(),
      admin
        .from("workflow_definitions")
        .select("id, status, workflow_type")
        .eq("tenant_id", tenant.id)
        .eq("key", "admission_default")
        .eq("status", "active")
        .eq("workflow_type", "admission")
        .maybeSingle()
    ]);

  if (sessionsResult.error) throw new Error(`Unable to load sessions: ${sessionsResult.error.message}`);
  if (programsResult.error) throw new Error(`Unable to load programs: ${programsResult.error.message}`);
  if (groupsResult.error) throw new Error(`Unable to load groups: ${groupsResult.error.message}`);
  if (formDefinitionResult.error) throw new Error(`Unable to load admission form: ${formDefinitionResult.error.message}`);
  if (workflowDefinitionResult.error) throw new Error(`Unable to load admission workflow: ${workflowDefinitionResult.error.message}`);
  if (
    !sessionsResult.data?.length ||
    !programsResult.data?.length ||
    !formDefinitionResult.data ||
    !workflowDefinitionResult.data
  ) {
    return null;
  }

  const [formVersionResult, workflowVersionResult] = await Promise.all([
    admin
      .from("form_versions")
      .select("id, labels, sections, status")
      .eq("tenant_id", tenant.id)
      .eq("form_definition_id", formDefinitionResult.data.id)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("workflow_versions")
      .select("id, status")
      .eq("tenant_id", tenant.id)
      .eq("workflow_definition_id", workflowDefinitionResult.data.id)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (formVersionResult.error) throw new Error(`Unable to load published admission form: ${formVersionResult.error.message}`);
  if (workflowVersionResult.error) throw new Error(`Unable to load published admission workflow: ${workflowVersionResult.error.message}`);
  if (!formVersionResult.data || !workflowVersionResult.data) return null;

  const formLabels = asLabels(formVersionResult.data.labels);
  const sections = parseSections(formVersionResult.data.sections);
  if (!formLabels || !sections) return null;

  const sessionKeyById = new Map<number, string>();
  const sessions = sessionsResult.data.flatMap((row) => {
    const labels = asLabels(row.labels);
    if (!labels) return [];
    sessionKeyById.set(Number(row.id), row.key);
    return [{
      key: row.key,
      labels,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      isDefault: row.is_default
    }];
  });
  const programKeyById = new Map<number, string>();
  const programs = programsResult.data.flatMap((row) => {
    const labels = asLabels(row.labels);
    if (!labels) return [];
    programKeyById.set(Number(row.id), row.key);
    return [{ key: row.key, labels, programType: row.program_type }];
  });
  const groups = (groupsResult.data ?? []).flatMap((row) => {
    const labels = asLabels(row.labels);
    const sessionKey = sessionKeyById.get(Number(row.session_id));
    const programKey = programKeyById.get(Number(row.program_id));
    return labels && sessionKey && programKey
      ? [{ key: row.key, labels, sessionKey, programKey }]
      : [];
  });

  if (!sessions.length || !programs.length) return null;

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      clientProfile: tenant.client_profile ?? "full-product"
    },
    branch: { id: branch.id, name: branch.name },
    sessions,
    programs,
    groups,
    form: {
      versionId: formVersionResult.data.id,
      labels: formLabels,
      sections
    },
    workflowVersionId: workflowVersionResult.data.id
  };
}
