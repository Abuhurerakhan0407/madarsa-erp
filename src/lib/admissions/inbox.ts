import { createClient } from "@/lib/supabase/server";
import type { TenantContext } from "@/lib/tenancy/context";

type Labels = Record<string, string>;

export type AdmissionsInboxItem = {
  id: number;
  trackingId: string;
  state: string;
  preferredLocale: string;
  submittedAt: string | null;
  applicantName: string;
  programLabels: Labels | null;
  sessionLabels: Labels | null;
};

export async function getAdmissionsInbox(
  workspace: TenantContext
): Promise<AdmissionsInboxItem[]> {
  const supabase = await createClient();
  const { data: applications, error } = await supabase
    .from("applications")
    .select("id, tracking_id, state, preferred_locale, submitted_at, applicant_data, program_id, session_id")
    .eq("tenant_id", workspace.tenantId)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (error) throw new Error(`Unable to load admissions inbox: ${error.message}`);
  if (!applications?.length) return [];

  const programIds = [...new Set(applications.map((row) => row.program_id))];
  const sessionIds = [...new Set(applications.map((row) => row.session_id))];
  const [programsResult, sessionsResult] = await Promise.all([
    supabase
      .from("programs")
      .select("id, labels")
      .eq("tenant_id", workspace.tenantId)
      .in("id", programIds),
    supabase
      .from("academic_sessions")
      .select("id, labels")
      .eq("tenant_id", workspace.tenantId)
      .in("id", sessionIds)
  ]);

  if (programsResult.error) throw new Error(`Unable to load application programs: ${programsResult.error.message}`);
  if (sessionsResult.error) throw new Error(`Unable to load application sessions: ${sessionsResult.error.message}`);

  const programLabels = new Map(
    (programsResult.data ?? []).map((row) => [row.id, row.labels as Labels])
  );
  const sessionLabels = new Map(
    (sessionsResult.data ?? []).map((row) => [row.id, row.labels as Labels])
  );

  return applications.map((row) => {
    const applicantData = row.applicant_data && typeof row.applicant_data === "object"
      ? (row.applicant_data as Record<string, unknown>)
      : {};
    const applicantName = typeof applicantData.applicant_name === "string"
      ? applicantData.applicant_name
      : "—";

    return {
      id: row.id,
      trackingId: row.tracking_id,
      state: row.state,
      preferredLocale: row.preferred_locale,
      submittedAt: row.submitted_at,
      applicantName,
      programLabels: programLabels.get(row.program_id) ?? null,
      sessionLabels: sessionLabels.get(row.session_id) ?? null
    };
  });
}
