import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenancy/context";
import { getStudentRegister } from "@/lib/students/register";
import { getConfigurationReadiness } from "./readiness";

export type GuidedSetupOption = {
  id: number;
  key: string;
  label: string;
};

export type GuidedSetupSnapshot = {
  institution: {
    displayName: string;
    legalName: string | null;
    timezone: string;
    primaryLocale: string;
    supportedLocales: string[];
  } | null;
  sessions: GuidedSetupOption[];
  programs: GuidedSetupOption[];
  groups: GuidedSetupOption[];
  studentTotal: number;
  readinessPercent: number;
  steps: {
    institution: boolean;
    academicYear: boolean;
    programsAndClasses: boolean;
    start: boolean;
  };
};

function localizedLabel(labels: unknown, locale: string, fallback: string): string {
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) return fallback;
  const map = labels as Record<string, unknown>;
  const value = map[locale] ?? map.en;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function getGuidedSetupSnapshot(locale: string): Promise<GuidedSetupSnapshot> {
  const workspace = await getTenantContext();
  if (!workspace || !workspace.branchId) {
    throw new Error("Active tenant branch is required for guided setup.");
  }

  const supabase = await createClient();
  const [institution, sessions, programs, groups, readiness, register] = await Promise.all([
    supabase
      .from("institution_profiles")
      .select("display_name,legal_name,timezone,primary_locale,supported_locales")
      .eq("tenant_id", workspace.tenantId)
      .maybeSingle(),
    supabase
      .from("academic_sessions")
      .select("id,key,labels,status")
      .eq("tenant_id", workspace.tenantId)
      .eq("status", "active")
      .order("starts_on", { ascending: false }),
    supabase
      .from("programs")
      .select("id,key,labels,branch_id,status")
      .eq("tenant_id", workspace.tenantId)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase
      .from("academic_groups")
      .select("id,key,labels,branch_id,status")
      .eq("tenant_id", workspace.tenantId)
      .eq("branch_id", workspace.branchId)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    getConfigurationReadiness(),
    getStudentRegister({ locale, page: 1, pageSize: 1 })
  ]);

  if (institution.error) throw new Error(`Unable to load institution setup: ${institution.error.message}`);
  if (sessions.error) throw new Error(`Unable to load academic sessions: ${sessions.error.message}`);
  if (programs.error) throw new Error(`Unable to load teaching programs: ${programs.error.message}`);
  if (groups.error) throw new Error(`Unable to load academic groups: ${groups.error.message}`);

  const sessionOptions = (sessions.data ?? []).map((row) => ({
    id: Number(row.id),
    key: String(row.key),
    label: localizedLabel(row.labels, locale, String(row.key))
  }));
  const programOptions = (programs.data ?? [])
    .filter((row) => row.branch_id === null || Number(row.branch_id) === workspace.branchId)
    .map((row) => ({
      id: Number(row.id),
      key: String(row.key),
      label: localizedLabel(row.labels, locale, String(row.key))
    }));
  const groupOptions = (groups.data ?? []).map((row) => ({
    id: Number(row.id),
    key: String(row.key),
    label: localizedLabel(row.labels, locale, String(row.key))
  }));

  const institutionComplete = Boolean(institution.data);
  const academicYearComplete = sessionOptions.length > 0 && programOptions.length > 0;
  const programsAndClassesComplete = academicYearComplete && groupOptions.length > 0;
  const readyToStart = institutionComplete && academicYearComplete && programsAndClassesComplete;

  return {
    institution: institution.data
      ? {
          displayName: institution.data.display_name,
          legalName: institution.data.legal_name,
          timezone: institution.data.timezone,
          primaryLocale: institution.data.primary_locale,
          supportedLocales: institution.data.supported_locales ?? []
        }
      : null,
    sessions: sessionOptions,
    programs: programOptions,
    groups: groupOptions,
    studentTotal: register.total,
    readinessPercent: readiness.percent,
    steps: {
      institution: institutionComplete,
      academicYear: academicYearComplete,
      programsAndClasses: programsAndClassesComplete,
      start: readyToStart
    }
  };
}
