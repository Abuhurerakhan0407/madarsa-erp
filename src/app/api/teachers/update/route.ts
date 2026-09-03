import {NextResponse} from "next/server";
import {isJsonRequest,isSameOriginRequest,readBoundedJson} from "@/lib/security/request";
import {createAdminClient} from "@/lib/supabase/admin";
import {getVerifiedIdentity} from "@/lib/supabase/identity";
import {getTenantContext} from "@/lib/tenancy/context";

type Raw=Record<string,unknown>;
const text=(v:unknown)=>typeof v==="string"?v.trim():"";
function validDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const [year,month,day]=value.split("-").map(Number);const date=new Date(Date.UTC(year,month-1,day));return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;}
export async function POST(request:Request){
 if(!isSameOriginRequest(request))return NextResponse.json({error:"Cross-origin mutation blocked."},{status:403});
 if(!isJsonRequest(request))return NextResponse.json({error:"JSON request required."},{status:415});
 const parsed=await readBoundedJson(request,8192);if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const w=await getTenantContext();if(!w||w.identityId!==identity.id||!w.branchId)return NextResponse.json({error:"Active branch membership required."},{status:403});
 const body=(parsed.value&&typeof parsed.value==="object"&&!Array.isArray(parsed.value)?parsed.value:{}) as Raw;const employmentId=Number(body.employmentId);const displayName=text(body.displayName),nameNative=text(body.nameNative),email=text(body.email).toLowerCase(),phone=text(body.phone),designation=text(body.designation),joinedOn=text(body.joinedOn);
 if(!Number.isSafeInteger(employmentId)||employmentId<=0)return NextResponse.json({error:"Valid teacher employment is required."},{status:400});
 if(displayName.length<2||displayName.length>160)return NextResponse.json({error:"Teacher name must be 2 to 160 characters."},{status:400});
 if(nameNative.length>160||designation.length<1||designation.length>120||!validDate(joinedOn))return NextResponse.json({error:"Teacher profile fields are invalid."},{status:400});
 if(email.length>320||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return NextResponse.json({error:"Valid teacher email required."},{status:400});
 if(phone.length>40||(phone&&phone.length<5))return NextResponse.json({error:"Valid teacher phone required."},{status:400});
 const admin=createAdminClient();const{data,error}=await admin.rpc("update_teacher_profile_v1",{p_identity_id:identity.id,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_employment_id:employmentId,p_display_name:displayName,p_name_native:nameNative||null,p_email:email,p_phone:phone,p_designation:designation,p_joined_on:joinedOn});
 if(error){const m=error.message.toLowerCase();if(m.includes("permission denied"))return NextResponse.json({error:"Teacher management permission required."},{status:403});if(m.includes("not found"))return NextResponse.json({error:error.message},{status:404});if(m.includes("required")||m.includes("valid")||m.includes("characters")||m.includes("too long"))return NextResponse.json({error:error.message},{status:422});return NextResponse.json({error:"Unable to update teacher."},{status:500});}
 return NextResponse.json({result:data},{status:200,headers:{"cache-control":"no-store"}});
}
