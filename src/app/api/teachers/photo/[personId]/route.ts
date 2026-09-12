import {NextResponse} from "next/server";
import {isTenantOwnedStoragePath,protectedPhotoResponse} from "@/lib/storage/protected-photo";
import {createAdminClient} from "@/lib/supabase/admin";
import {getVerifiedIdentity} from "@/lib/supabase/identity";
import {getTenantContext} from "@/lib/tenancy/context";

export async function GET(_request:Request,{params}:{params:Promise<{personId:string}>}){
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const w=await getTenantContext();if(!w||w.identityId!==identity.id||!w.branchId)return NextResponse.json({error:"Active branch membership required."},{status:403});
 const {personId:raw}=await params;const personId=Number(raw);if(!Number.isSafeInteger(personId)||personId<=0)return NextResponse.json({error:"Teacher not found."},{status:404});
 const admin=createAdminClient();const{data:allowed,error:permissionError}=await admin.rpc("operator_has_permission_v1",{p_identity_id:identity.id,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_permission_code:"hr.employee.read"});if(permissionError||allowed!==true)return NextResponse.json({error:"Teacher read permission required."},{status:403});
 const{data:employment,error:employmentError}=await admin.from("hr_employments").select("employee_person_id").eq("tenant_id",w.tenantId).eq("branch_id",w.branchId).eq("employee_person_id",personId).in("state",["active","on_leave","suspended"]).maybeSingle();if(employmentError)return NextResponse.json({error:"Unable to load teacher."},{status:500});if(!employment)return NextResponse.json({error:"Teacher not found."},{status:404});
 const{data:person,error:personError}=await admin.from("persons").select("photo_storage_path").eq("tenant_id",w.tenantId).eq("id",personId).maybeSingle();if(personError)return NextResponse.json({error:"Unable to load teacher photo."},{status:500});const path=person?.photo_storage_path;if(!isTenantOwnedStoragePath(path,w.tenantId))return NextResponse.json({error:"Teacher photo not available."},{status:404});
 const downloaded=await admin.storage.from("tenant-documents").download(path);if(downloaded.error||!downloaded.data)return NextResponse.json({error:"Teacher photo not available."},{status:404});const response=protectedPhotoResponse(downloaded.data);if(!response)return NextResponse.json({error:"Unsupported teacher photo."},{status:415});return response;
}
