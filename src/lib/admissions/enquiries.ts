import { createClient } from "@/lib/supabase/server";
import type { TenantContext } from "@/lib/tenancy/context";

type Labels = Record<string, string>;
export type EnquiryOption = { id: number; labels: Labels };
export type EnquiryListItem = { id: number; applicantName: string; status: string; preferredLocale: string; source: string | null; nextFollowUpAt: string | null; createdAt: string; programLabels: Labels | null; sessionLabels: Labels | null };
export type EnquiryDetail = EnquiryListItem & { guardianName: string | null; phone: string | null; email: string | null; notes: string | null; ownerMembershipId: number | null; followups: Array<{ id: number; dueAt: string; channel: string | null; outcome: string | null; completedAt: string | null }>; application: { id: number; state: string } | null };

export async function getEnquiryOptions(workspace: TenantContext) {
  if (!workspace.branchId) return { sessions: [], programs: [] };
  const supabase = await createClient();
  const [sessions, programs] = await Promise.all([
    supabase.from("academic_sessions").select("id, labels").eq("tenant_id", workspace.tenantId).eq("status", "active").order("starts_on", { ascending: false }),
    supabase.from("programs").select("id, labels, branch_id").eq("tenant_id", workspace.tenantId).eq("status", "active").or(`branch_id.is.null,branch_id.eq.${workspace.branchId}`).order("created_at")
  ]);
  if (sessions.error) throw new Error(`Unable to load enquiry sessions: ${sessions.error.message}`);
  if (programs.error) throw new Error(`Unable to load enquiry programs: ${programs.error.message}`);
  return { sessions: (sessions.data ?? []).map((row) => ({ id: row.id, labels: row.labels as Labels })), programs: (programs.data ?? []).map((row) => ({ id: row.id, labels: row.labels as Labels })) };
}

export async function getEnquiries(workspace: TenantContext): Promise<EnquiryListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("enquiries")
    .select("id, applicant_name, status, preferred_locale, source, next_follow_up_at, created_at, program_id, session_id")
    .eq("tenant_id", workspace.tenantId).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Unable to load enquiries: ${error.message}`);
  if (!data?.length) return [];
  const programIds = [...new Set(data.flatMap((row) => row.program_id ? [row.program_id] : []))];
  const sessionIds = [...new Set(data.flatMap((row) => row.session_id ? [row.session_id] : []))];
  const [programs, sessions] = await Promise.all([
    programIds.length ? supabase.from("programs").select("id, labels").eq("tenant_id", workspace.tenantId).in("id", programIds) : Promise.resolve({ data: [], error: null }),
    sessionIds.length ? supabase.from("academic_sessions").select("id, labels").eq("tenant_id", workspace.tenantId).in("id", sessionIds) : Promise.resolve({ data: [], error: null })
  ]);
  if (programs.error || sessions.error) throw new Error("Unable to load enquiry academic labels.");
  const programMap = new Map((programs.data ?? []).map((row) => [row.id, row.labels as Labels]));
  const sessionMap = new Map((sessions.data ?? []).map((row) => [row.id, row.labels as Labels]));
  return data.map((row) => ({ id: row.id, applicantName: row.applicant_name, status: row.status, preferredLocale: row.preferred_locale, source: row.source, nextFollowUpAt: row.next_follow_up_at, createdAt: row.created_at, programLabels: row.program_id ? programMap.get(row.program_id) ?? null : null, sessionLabels: row.session_id ? sessionMap.get(row.session_id) ?? null : null }));
}

export async function getEnquiryDetail(workspace: TenantContext, enquiryId: number): Promise<EnquiryDetail | null> {
  if (!Number.isSafeInteger(enquiryId) || enquiryId <= 0) return null;
  const supabase = await createClient();
  const { data: enquiry, error } = await supabase.from("enquiries")
    .select("id, applicant_name, guardian_name, normalized_phone, normalized_email, status, preferred_locale, source, next_follow_up_at, notes, owner_membership_id, created_at, program_id, session_id")
    .eq("tenant_id", workspace.tenantId).eq("id", enquiryId).maybeSingle();
  if (error) throw new Error(`Unable to load enquiry: ${error.message}`);
  if (!enquiry) return null;
  const [program, session, followups, application] = await Promise.all([
    enquiry.program_id ? supabase.from("programs").select("labels").eq("tenant_id", workspace.tenantId).eq("id", enquiry.program_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    enquiry.session_id ? supabase.from("academic_sessions").select("labels").eq("tenant_id", workspace.tenantId).eq("id", enquiry.session_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("admission_followups").select("id, due_at, channel, outcome, completed_at").eq("tenant_id", workspace.tenantId).eq("enquiry_id", enquiry.id).order("due_at"),
    supabase.from("applications").select("id, state").eq("tenant_id", workspace.tenantId).eq("enquiry_id", enquiry.id).maybeSingle()
  ]);
  if (program.error || session.error || followups.error || application.error) throw new Error("Unable to load enquiry details.");
  return { id: enquiry.id, applicantName: enquiry.applicant_name, guardianName: enquiry.guardian_name, phone: enquiry.normalized_phone, email: enquiry.normalized_email, status: enquiry.status, preferredLocale: enquiry.preferred_locale, source: enquiry.source, nextFollowUpAt: enquiry.next_follow_up_at, notes: enquiry.notes, ownerMembershipId: enquiry.owner_membership_id, createdAt: enquiry.created_at, programLabels: (program.data?.labels as Labels | undefined) ?? null, sessionLabels: (session.data?.labels as Labels | undefined) ?? null, followups: (followups.data ?? []).map((row) => ({ id: row.id, dueAt: row.due_at, channel: row.channel, outcome: row.outcome, completedAt: row.completed_at })), application: application.data ? { id: application.data.id, state: application.data.state } : null };
}
