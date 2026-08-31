import {NextResponse} from 'next/server';
import {isJsonRequest,isSameOriginRequest,readBoundedJson} from '@/lib/security/request';
import {validateReportRun} from '@/lib/reports/model';
import {createAdminClient} from '@/lib/supabase/admin';
import {getVerifiedIdentity} from '@/lib/supabase/identity';
import {getTenantContext} from '@/lib/tenancy/context';
export async function POST(request:Request){
 if(!isSameOriginRequest(request))return NextResponse.json({error:'Cross-origin mutation blocked.'},{status:403});
 if(!isJsonRequest(request))return NextResponse.json({error:'JSON request required.'},{status:415});
 const body=await readBoundedJson(request,32768);if(!body.ok)return NextResponse.json({error:body.error},{status:body.status});
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:'Authentication required.'},{status:401});
 const workspace=await getTenantContext();if(!workspace||workspace.identityId!==identity.id||!workspace.branchId)return NextResponse.json({error:'Active branch membership required.'},{status:403});
 const validation=validateReportRun(body.value);if(!validation.value)return NextResponse.json({error:validation.errors[0]||'Invalid report request.',details:validation.errors},{status:400});
 const v=validation.value;const admin=createAdminClient();const {data,error}=await admin.rpc('run_operational_report_v1',{p_identity_id:identity.id,p_tenant_id:workspace.tenantId,p_branch_id:workspace.branchId,p_report_key:v.reportKey,p_parameters:v.parameters,p_output_format:v.outputFormat,p_request_key:v.requestKey});
 if(error){const m=error.message.toLowerCase();if(m.includes('permission denied'))return NextResponse.json({error:'Report permission required.'},{status:403});if(m.includes('not found')||m.includes('unsupported'))return NextResponse.json({error:error.message},{status:422});return NextResponse.json({error:'Unable to generate report.'},{status:500});}
 return NextResponse.json({result:data},{status:200,headers:{'cache-control':'no-store'}});
}