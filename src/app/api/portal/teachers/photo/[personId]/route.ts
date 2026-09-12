import {NextResponse} from "next/server";
import {getPortalHome} from "@/lib/portal/runtime";
import {isTenantOwnedStoragePath,protectedPhotoResponse} from "@/lib/storage/protected-photo";
import {createAdminClient} from "@/lib/supabase/admin";
import {getVerifiedIdentity} from "@/lib/supabase/identity";

type Raw=Record<string,unknown>;
const object=(value:unknown):Raw=>value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:{};
const rows=(value:unknown):Raw[]=>Array.isArray(value)?value.filter((item)=>item&&typeof item==="object"&&!Array.isArray(item)) as Raw[]:[];
export async function GET(request:Request,{params}:{params:Promise<{personId:string}>}){
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const tenantId=Number(new URL(request.url).searchParams.get("tenant"));const {personId:raw}=await params;const personId=Number(raw);if(!Number.isSafeInteger(tenantId)||tenantId<=0||!Number.isSafeInteger(personId)||personId<=0)return NextResponse.json({error:"Teacher photo not found."},{status:404});
 let home:Raw;try{home=await getPortalHome(tenantId);}catch{return NextResponse.json({error:"Portal access required."},{status:403});}
 const teacher=rows(object(home.overview).teachers).find(item=>Number(item.teacher_person_id)===personId);if(!teacher)return NextResponse.json({error:"Teacher photo not found."},{status:404});const path=teacher.photo_storage_path;if(!isTenantOwnedStoragePath(path,tenantId))return NextResponse.json({error:"Teacher photo not available."},{status:404});
 const admin=createAdminClient();const downloaded=await admin.storage.from("tenant-documents").download(path);if(downloaded.error||!downloaded.data)return NextResponse.json({error:"Teacher photo not available."},{status:404});const response=protectedPhotoResponse(downloaded.data);if(!response)return NextResponse.json({error:"Unsupported teacher photo."},{status:415});return response;
}
