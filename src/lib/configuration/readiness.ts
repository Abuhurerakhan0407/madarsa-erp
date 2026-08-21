import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenancy/context";
import {
  readinessPercent,
  versionedConfigurationState,
  type ConfigurationState
} from "./readiness-helpers";

export const configurationModuleKeys = [
  "institution",
  "branches",
  "languages",
  "terminology",
  "grading",
  "attendance",
  "workflows",
  "documents",
  "numbering"
] as const;

export type ConfigurationModuleKey = (typeof configurationModuleKeys)[number];

export type ConfigurationReadiness = {
  states: Record<ConfigurationModuleKey, ConfigurationState>;
  completeCount: number;
  percent: number;
  numberPattern: string | null;
};

export async function getConfigurationReadiness(): Promise<ConfigurationReadiness> {
  const workspace = await getTenantContext();
  if (!workspace) {
    throw new Error("Tenant context is required for configuration readiness.");
  }

  const supabase = await createClient();
  const [
    institution,
    branches,
    terminology,
    grading,
    attendance,
    workflows,
    documents,
    numbering
  ] = await Promise.all([
    supabase
      .from("institution_profiles")
      .select("tenant_id,supported_locales,primary_locale")
      .eq("tenant_id", workspace.tenantId)
      .maybeSingle(),
    supabase
      .from("branches")
      .select("id,status")
      .eq("tenant_id", workspace.tenantId),
    supabase
      .from("terminology_sets")
      .select("status")
      .eq("tenant_id", workspace.tenantId),
    supabase
      .from("grading_scale_versions")
      .select("state")
      .eq("tenant_id", workspace.tenantId),
    supabase
      .from("attendance_status_sets")
      .select("status")
      .eq("tenant_id", workspace.tenantId),
    supabase
      .from("workflow_versions")
      .select("status")
      .eq("tenant_id", workspace.tenantId),
    supabase
      .from("document_template_versions")
      .select("state")
      .eq("tenant_id", workspace.tenantId),
    supabase
      .from("number_sequences")
      .select("status,pattern,updated_at")
      .eq("tenant_id", workspace.tenantId)
      .order("updated_at", { ascending: false })
  ]);

  const failures = [
    ["institution", institution.error],
    ["branches", branches.error],
    ["terminology", terminology.error],
    ["grading", grading.error],
    ["attendance", attendance.error],
    ["workflows", workflows.error],
    ["documents", documents.error],
    ["numbering", numbering.error]
  ] as const;

  for (const [label, error] of failures) {
    if (error) {
      throw new Error(`Unable to load ${label} configuration: ${error.message}`);
    }
  }

  const supportedLocales = institution.data?.supported_locales ?? [];
  const requiredLocales = ["en", "ur", "ar"];
  const states: Record<ConfigurationModuleKey, ConfigurationState> = {
    institution: institution.data ? "complete" : "pending",
    branches: (branches.data ?? []).some((branch) => branch.status === "active")
      ? "complete"
      : branches.data?.length
        ? "attention"
        : "pending",
    languages:
      institution.data && requiredLocales.every((locale) => supportedLocales.includes(locale))
        ? "complete"
        : institution.data
          ? "attention"
          : "pending",
    terminology: versionedConfigurationState(terminology.data ?? []),
    grading: versionedConfigurationState(grading.data ?? []),
    attendance: versionedConfigurationState(attendance.data ?? []),
    workflows: versionedConfigurationState(workflows.data ?? []),
    documents: versionedConfigurationState(documents.data ?? []),
    numbering: versionedConfigurationState(numbering.data ?? [])
  };

  const stateList = configurationModuleKeys.map((key) => states[key]);
  const numberRow =
    (numbering.data ?? []).find((row) => row.status === "published") ??
    numbering.data?.[0] ??
    null;

  return {
    states,
    completeCount: stateList.filter((state) => state === "complete").length,
    percent: readinessPercent(stateList),
    numberPattern: numberRow?.pattern ?? null
  };
}
