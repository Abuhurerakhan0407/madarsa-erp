import {NextResponse} from "next/server";
import {furkaniaDeeniyatLevels,furkaniaDeeniyatProgram,furkaniaDeeniyatSubjects} from "@/lib/client-profiles/furkania-deeniyat";
import {furkaniaProfile} from "@/lib/client-profiles/furkania";
import {isSameOriginRequest} from "@/lib/security/request";
import {createAdminClient} from "@/lib/supabase/admin";
import {getVerifiedIdentity} from "@/lib/supabase/identity";
import {getTenantContext} from "@/lib/tenancy/context";

const FURKANIA_TENANT_SLUG="madrasa-e-furkania";
type Raw=Record<string,unknown>;
const object=(value:unknown):Raw=>value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:{};

function runtimeError(message:string){const normalized=message.toLowerCase();if(normalized.includes("permission denied"))return{status:403,error:"You do not have permission to configure Madrasa-e-Furkania academics."};if(normalized.includes("required")||normalized.includes("invalid")||normalized.includes("must be"))return{status:400,error:message};if(normalized.includes("another branch"))return{status:409,error:message};return{status:500,error:"Unable to bootstrap the Madrasa-e-Furkania Deeniyat structure."};}

export async function POST(request:Request){
 if(!isSameOriginRequest(request))return NextResponse.json({error:"Cross-origin mutation blocked."},{status:403});
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const workspace=await getTenantContext();if(!workspace||workspace.identityId!==identity.id)return NextResponse.json({error:"Active tenant membership required."},{status:403});
 if(workspace.tenantSlug!==FURKANIA_TENANT_SLUG)return NextResponse.json({error:"This setup is not available in the active tenant."},{status:404});
 if(!workspace.branchId)return NextResponse.json({error:"Active primary branch required."},{status:409});

 const admin=createAdminClient();
 const{data,error}=await admin.rpc("bootstrap_furkania_deeniyat_v1",{
  p_identity_id:identity.id,
  p_tenant_id:workspace.tenantId,
  p_branch_id:workspace.branchId,
  p_program_key:furkaniaDeeniyatProgram.key,
  p_program_labels:furkaniaDeeniyatProgram.labels,
  p_program_descriptions:furkaniaDeeniyatProgram.descriptions,
  p_levels:furkaniaDeeniyatLevels,
  p_subjects:furkaniaDeeniyatSubjects.map(subject=>({key:subject.key,labels:subject.labels,subject_type:subject.subjectType,progress_method:subject.progressMethod,unit_structure:subject.unitStructure})),
  p_entry_rules:{age_4_to_5:{min_age:4,max_age:5,default_level_key:"course_1",source:"client_confirmed"}},
  p_metadata:{book_medium:"hinglish",book_version_confirmed:false,client_profile:"madrasa_e_furkania",curriculum_family:"deeniyat",track:"primary_1_to_5"}
 });
 if(error){const mapped=runtimeError(error.message);return NextResponse.json({error:mapped.error},{status:mapped.status,headers:{"cache-control":"no-store"}});}
 const result=object(data);const changed=result.changed===true;
 return NextResponse.json({client:furkaniaProfile.displayName,...result,timetableCreated:false,timetableStatus:"blocked_until_exact_shift_times_are_confirmed",pendingClientDetails:furkaniaProfile.pendingClientDetails},{status:changed?201:200,headers:{"cache-control":"no-store"}});
}
