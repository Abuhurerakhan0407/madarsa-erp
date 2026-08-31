import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";

type Raw = Record<string, unknown>;
const object = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const rows = (value: unknown): Raw[] => Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Raw[] : [];
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;
const number = (value: unknown): number | null => Number.isFinite(Number(value)) ? Number(value) : null;

export type WhatsappCenter = {
  config: { id: number | null; provider: string | null; senderReference: string | null; state: string; hasConfigReference: boolean };
  templates: Array<{ id: number; locale: string; providerTemplateReference: string | null; bodyTemplate: string; state: string; eventKey: string }>;
  recipients: Array<{ studentPersonId: number; studentNumber: string; studentName: string; guardianPersonId: number | null; guardianName: string | null; phoneHint: string | null; consentStatus: string; consentAt: string | null }>;
  dispatches: Array<{ id: number; state: string; providerMessageId: string | null; attemptCount: number; createdAt: string; sentAt: string | null; guardianName: string | null; studentName: string | null; studentNumber: string | null; locale: string; providerTemplateReference: string | null; lastError: unknown }>;
};

async function workspace() {
  const value = await getTenantContext();
  if (!value || !value.branchId) throw new Error("Active branch is required.");
  return value;
}

export async function getWhatsappCenter(): Promise<WhatsappCenter> {
  const w = await workspace(); const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_whatsapp_center_v1", { p_identity_id: w.identityId, p_tenant_id: w.tenantId, p_branch_id: w.branchId });
  if (error) throw new Error(`Unable to load WhatsApp center: ${error.message}`);
  const raw = object(data), config = object(raw.config);
  return {
    config: { id: number(config.id), provider: text(config.provider), senderReference: text(config.sender_reference), state: text(config.state) ?? "inactive", hasConfigReference: Boolean(config.has_config_reference) },
    templates: rows(raw.templates).flatMap((row) => { const id=number(row.id), locale=text(row.locale), body=text(row.body_template), eventKey=text(row.event_key); return id && locale && body && eventKey ? [{ id, locale, providerTemplateReference:text(row.provider_template_reference), bodyTemplate:body, state:text(row.state)??"draft", eventKey }] : []; }),
    recipients: rows(raw.recipients).flatMap((row) => { const studentPersonId=number(row.student_person_id), studentNumber=text(row.student_number), studentName=text(row.student_name); return studentPersonId && studentNumber && studentName ? [{ studentPersonId, studentNumber, studentName, guardianPersonId:number(row.guardian_person_id), guardianName:text(row.guardian_name), phoneHint:text(row.phone_hint), consentStatus:text(row.whatsapp_consent_status)??"not_recorded", consentAt:text(row.whatsapp_consent_at) }] : []; }),
    dispatches: rows(raw.dispatches).flatMap((row) => { const id=number(row.id), createdAt=text(row.created_at), locale=text(row.locale); return id && createdAt && locale ? [{ id, state:text(row.state)??"queued", providerMessageId:text(row.provider_message_id), attemptCount:number(row.attempt_count)??0, createdAt, sentAt:text(row.sent_at), guardianName:text(row.guardian_name), studentName:text(row.student_name), studentNumber:text(row.student_number), locale, providerTemplateReference:text(row.provider_template_reference), lastError:row.last_error }] : []; })
  };
}

export async function configureWhatsappChannel(input: { provider: string; senderReference: string | null; encryptedConfigReference: string | null; state: string }) {
  const w=await workspace(); const admin=createAdminClient();
  const { data,error }=await admin.rpc("configure_whatsapp_channel_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_provider:input.provider,p_sender_reference:input.senderReference,p_encrypted_config_reference:input.encryptedConfigReference,p_state:input.state});
  if(error) throw new Error(error.message); return object(data);
}

export async function publishGuardianWhatsappTemplate(input:{locale:"en"|"ur"|"ar";bodyTemplate:string;providerTemplateReference:string|null;requiredVariables:string[]}){
  const w=await workspace();const admin=createAdminClient();
  const {data,error}=await admin.rpc("upsert_guardian_whatsapp_template_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_locale:input.locale,p_body_template:input.bodyTemplate,p_provider_template_reference:input.providerTemplateReference,p_required_variables:input.requiredVariables});
  if(error) throw new Error(error.message);return object(data);
}

export async function setGuardianWhatsappConsent(input:{studentPersonId:number;status:"opted_in"|"opted_out";source:"written"|"verbal"|"digital"|"provider";evidenceReference:string|null}){
  const w=await workspace();const admin=createAdminClient();
  const {data,error}=await admin.rpc("set_guardian_whatsapp_consent_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_student_person_id:input.studentPersonId,p_status:input.status,p_source:input.source,p_evidence_reference:input.evidenceReference});
  if(error) throw new Error(error.message);return object(data);
}

export async function queueGuardianWhatsapp(input:{studentPersonId:number;templateId:number;variables:Record<string,string|number|boolean|null>;requestKey:string}){
  const w=await workspace();const admin=createAdminClient();
  const {data,error}=await admin.rpc("queue_guardian_whatsapp_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_student_person_id:input.studentPersonId,p_template_id:input.templateId,p_variables:input.variables,p_request_key:input.requestKey});
  if(error) throw new Error(error.message);return object(data);
}
