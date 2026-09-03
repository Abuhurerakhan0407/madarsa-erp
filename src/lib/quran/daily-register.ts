import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";

export type QuranDailyTargetView = {
  id?: number;
  workCategory: string;
  mode: "juz" | "ayah" | "page";
  label: string;
  juzNumber?: number;
  startSurahNumber?: number;
  startAyahNumber?: number;
  endSurahNumber?: number;
  endAyahNumber?: number;
  pageStart?: number;
  pageEnd?: number;
};
export type QuranDailyRow = {
  personId: number;
  name: string;
  nameNative: string | null;
  studentNumber: string;
  sabaq: string | null;
  sabqi: string | null;
  manzil: string | null;
  qualityScore: number | null;
  dayStatus: string | null;
  mistakeCount: number;
  revisionDue: number;
  revisionDueOn: string | null;
  memorizedJuz: number;
  nextTarget: QuranDailyTargetView | null;
  repeatTarget: QuranDailyTargetView | null;
};
export type QuranDailyRegister = {
  localDate: string;
  selectedDate: string;
  selectedGroupId: number | null;
  groups: { id:number; key:string; label:string; students:number }[];
  rows: QuranDailyRow[];
  summary: { students:number; recorded:number; needsSupport:number; revisionDue:number; monthlyAttempts:number; monthlyAverage:number|null };
  canRecord: boolean;
};

type Raw = Record<string, unknown>;
const obj = (value: unknown): Raw | null => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : null;
const str = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;
const num = (value: unknown): number | null => { const parsed=Number(value); return value!==null && value!==undefined && value!=="" && Number.isFinite(parsed) ? parsed : null; };
function target(value: unknown): QuranDailyTargetView | null {
  const raw=obj(value); if(!raw) return null;
  const mode=str(raw.mode); if(mode!=="juz"&&mode!=="ayah"&&mode!=="page") return null;
  const label=str(raw.label) ?? "—"; const workCategory=str(raw.work_category) ?? "sabaq";
  const result: QuranDailyTargetView={ mode,label,workCategory };
  const id=num(raw.id); if(id) result.id=id;
  const pairs:[[keyof QuranDailyTargetView,string]] | never = [] as never;
  void pairs;
  const juz=num(raw.juz_number); if(juz) result.juzNumber=juz;
  const ss=num(raw.start_surah_number); if(ss) result.startSurahNumber=ss;
  const sa=num(raw.start_ayah_number); if(sa) result.startAyahNumber=sa;
  const es=num(raw.end_surah_number); if(es) result.endSurahNumber=es;
  const ea=num(raw.end_ayah_number); if(ea) result.endAyahNumber=ea;
  const ps=num(raw.page_start); if(ps) result.pageStart=ps;
  const pe=num(raw.page_end); if(pe) result.pageEnd=pe;
  return result;
}
function mapRow(value: unknown): QuranDailyRow | null {
  const raw=obj(value); if(!raw) return null; const personId=num(raw.person_id); if(!personId) return null;
  return {
    personId,name:str(raw.name)??"Student",nameNative:str(raw.name_native),studentNumber:str(raw.student_number)??"—",
    sabaq:str(raw.sabaq),sabqi:str(raw.sabqi),manzil:str(raw.manzil),qualityScore:num(raw.quality_score),dayStatus:str(raw.day_status),
    mistakeCount:num(raw.mistake_count)??0,revisionDue:num(raw.revision_due)??0,revisionDueOn:str(raw.revision_due_on),memorizedJuz:num(raw.memorized_juz)??0,
    nextTarget:target(raw.next_target),repeatTarget:target(raw.repeat_target)
  };
}

export async function getQuranDailyRegister(args: { groupId?: number | null; date?: string | null }): Promise<QuranDailyRegister> {
  const workspace=await getTenantContext();
  if(!workspace||!workspace.branchId) throw new Error("Active branch is required.");
  const admin=createAdminClient();
  const {data,error}=await admin.rpc("get_quran_hifz_daily_register_v1",{
    p_identity_id:workspace.identityId,p_tenant_id:workspace.tenantId,p_branch_id:workspace.branchId,p_group_id:args.groupId??null,p_session_date:args.date??null
  });
  if(error) throw new Error(`Unable to load Qur'an daily register: ${error.message}`);
  const raw=obj(data)??{}; const summary=obj(raw.summary)??{};
  const groups=Array.isArray(raw.groups)?raw.groups.flatMap((item)=>{const group=obj(item);const id=num(group?.id);if(!group||!id)return[];return[{id,key:str(group.key)??String(id),label:str(group.label)??`Group ${id}`,students:num(group.students)??0}];}):[];
  const rows=Array.isArray(raw.rows)?raw.rows.flatMap((item)=>{const row=mapRow(item);return row?[row]:[];}):[];
  return {
    localDate:str(raw.local_date)??new Date().toISOString().slice(0,10),selectedDate:str(raw.selected_date)??str(raw.local_date)??new Date().toISOString().slice(0,10),selectedGroupId:num(raw.selected_group_id),groups,rows,
    summary:{students:num(summary.students)??0,recorded:num(summary.recorded)??0,needsSupport:num(summary.needs_support)??0,revisionDue:num(summary.revision_due)??0,monthlyAttempts:num(summary.monthly_attempts)??0,monthlyAverage:num(summary.monthly_average)},
    canRecord:raw.can_record===true
  };
}
