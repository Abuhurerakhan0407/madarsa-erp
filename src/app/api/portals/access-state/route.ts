import {NextResponse} from "next/server";
import {setPortalIdentityAccess} from "@/lib/portal/runtime";
import {isJsonRequest,isSameOriginRequest,readBoundedJson} from "@/lib/security/request";
import {getVerifiedIdentity} from "@/lib/supabase/identity";
import {getTenantContext} from "@/lib/tenancy/context";

export async function POST(request:Request){
 if(!isSameOriginRequest(request))return NextResponse.json({error:"Cross-origin mutation blocked."},{status:403});
 if(!isJsonRequest(request))return NextResponse.json({error:"JSON request required."},{status:415});
 const parsed=await readBoundedJson(request,2048);if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});const w=await getTenantContext();if(!w||w.identityId!==identity.id||!w.branchId)return NextResponse.json({error:"Active branch membership required."},{status:403});
 const body=(parsed.value&&typeof parsed.value==="object"&&!Array.isArray(parsed.value)?parsed.value:{}) as Record<string,unknown>;const personId=Number(body.personId),kind=body.kind,enabled=body.enabled;if(!Number.isSafeInteger(personId)||personId<=0||(kind!=="guardian"&&kind!=="employee")||typeof enabled!=="boolean")return NextResponse.json({error:"Portal access request is invalid."},{status:400});
 try{const result=await setPortalIdentityAccess({personId,linkType:kind,enabled});return NextResponse.json({result},{status:200,headers:{"cache-control":"no-store"}});}catch(error){const message=error instanceof Error?error.message:"Unable to update portal access.";if(message.toLowerCase().includes("permission denied"))return NextResponse.json({error:"Portal credential permission required."},{status:403});if(message.toLowerCase().includes("not found"))return NextResponse.json({error:message},{status:404});return NextResponse.json({error:message},{status:409});}
}
