import {NextResponse} from "next/server";
import {getPortalHome} from "@/lib/portal/runtime";
import {createAdminClient} from "@/lib/supabase/admin";
import {getVerifiedIdentity} from "@/lib/supabase/identity";

type Raw=Record<string,unknown>;
const object=(value:unknown):Raw=>value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:{};
const rows=(value:unknown):Raw[]=>Array.isArray(value)?value.filter((item)=>item&&typeof item==="object"&&!Array.isArray(item)) as Raw[]:[];
export async function GET(request:Request,{params}:{params:Promise<{personId:string}>}){
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const tenantId=Number(new URL(request.url).searchParams.get("tenant"));const {personId:raw}=await params;const personId=Number(raw);if(!Number.isSafeInteger(tenantId)||tenantId<=0||!Number.isSafeInteger(personId)||personId<=0)return NextResponse.json({error:"Teacher photo not found."},{status:404});
 let home:Raw;try{home=await getPortalHome(tenantId);}catch{return NextResponse.json({error:"Portal access required."},{status:403});}
 const teacher=rows(object(home.overview).teachers).find(item=>Number(item.teacher_person_id)===personId);if(!teacher)return NextResponse.json({error:"Teacher photo not found."},{status:404});const path=teacher.photo_storage_path;if(typeof path!=="string"||!path)return NextResponse.json({error:"Teacher photo not available."},{status:404});
 const admin=createAdminClient();const signed=await admin.storage.from("tenant-documents").createSignedUrl(path,60);if(signed.error||!signed.data.signedUrl)return NextResponse.json({error:"Unable to load teacher photo."},{status:500});return NextResponse.redirect(signed.data.signedUrl,{status:307});
}
