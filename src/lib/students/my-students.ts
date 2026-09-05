import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNavigationAudience } from "@/lib/navigation/audience";
import { getTenantContext } from "@/lib/tenancy/context";

export type MyStudentRow={personId:number;studentNumber:string;name:string;nativeName:string|null;group:string};
function label(value:unknown,locale:string,fallback:string){if(!value||typeof value!=="object"||Array.isArray(value))return fallback;const r=value as Record<string,unknown>;const v=r[locale]??r.en;return typeof v==="string"&&v.trim()?v:fallback;}
export async function getMyStudents(locale:string):Promise<MyStudentRow[]>{
 const w=await getTenantContext();if(!w||!w.branchId)notFound();if(await getNavigationAudience(w)!=="teacher")notFound();const admin=createAdminClient();
 const link=await admin.from("identity_person_links").select("person_id").eq("tenant_id",w.tenantId).eq("identity_id",w.identityId).eq("link_type","employee").eq("status","verified").limit(1).maybeSingle();if(link.error)throw new Error(`Unable to resolve teacher identity: ${link.error.message}`);if(!link.data)return[];
 const timetable=await admin.from("timetable_entries").select("group_id").eq("tenant_id",w.tenantId).eq("branch_id",w.branchId).eq("teacher_person_id",link.data.person_id).eq("status","active");if(timetable.error)throw new Error(`Unable to load teaching scope: ${timetable.error.message}`);const groupIds=[...new Set((timetable.data??[]).map(r=>Number(r.group_id)).filter(Number.isFinite))];if(!groupIds.length)return[];
 const enrollments=await admin.from("enrollments").select("student_person_id,group_id").eq("tenant_id",w.tenantId).eq("branch_id",w.branchId).eq("status","active").in("group_id",groupIds);if(enrollments.error)throw new Error(`Unable to load assigned students: ${enrollments.error.message}`);const personIds=[...new Set((enrollments.data??[]).map(r=>Number(r.student_person_id)).filter(Number.isFinite))];if(!personIds.length)return[];
 const [people,profiles,groups]=await Promise.all([admin.from("persons").select("id,display_name,name_native").eq("tenant_id",w.tenantId).in("id",personIds),admin.from("student_profiles").select("person_id,student_number").eq("tenant_id",w.tenantId).in("person_id",personIds),admin.from("academic_groups").select("id,key,labels").eq("tenant_id",w.tenantId).in("id",groupIds)]);if(people.error||profiles.error||groups.error)throw new Error("Unable to load assigned student details.");
 const profile=new Map((profiles.data??[]).map(r=>[Number(r.person_id),String(r.student_number)]));const groupMap=new Map((groups.data??[]).map(r=>[Number(r.id),label(r.labels,locale,String(r.key))]));const enrollmentMap=new Map((enrollments.data??[]).map(r=>[Number(r.student_person_id),Number(r.group_id)]));
 return (people.data??[]).map(r=>({personId:Number(r.id),studentNumber:profile.get(Number(r.id))??"—",name:String(r.display_name),nativeName:r.name_native?String(r.name_native):null,group:groupMap.get(enrollmentMap.get(Number(r.id))??0)??"—"})).sort((a,b)=>a.name.localeCompare(b.name));
}
