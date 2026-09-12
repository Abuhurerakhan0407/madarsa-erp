import { NextResponse } from "next/server";
import { operatorHasPermissions } from "@/lib/access/operator-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function GET(_request:Request,{params}:{params:Promise<{personId:string}>}){
 const identity=await getVerifiedIdentity();
 if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const w=await getTenantContext();
 if(!w||w.identityId!==identity.id||!w.branchId)return NextResponse.json({error:"Active branch membership required."},{status:403});
 if(!(await operatorHasPermissions(w,["students.profile.read"])))return NextResponse.json({error:"Student read permission required."},{status:403});
 const {personId:raw}=await params;const personId=Number(raw);
 if(!Number.isSafeInteger(personId)||personId<=0)return NextResponse.json({error:"Student not found."},{status:404});
 const admin=createAdminClient();
 const {data:enrollment,error:enrollmentError}=await admin.from("enrollments").select("student_person_id,group_id").eq("tenant_id",w.tenantId).eq("branch_id",w.branchId).eq("student_person_id",personId).neq("status","cancelled").limit(1).maybeSingle();
 if(enrollmentError)return NextResponse.json({error:"Unable to load student."},{status:500});
 if(!enrollment)return NextResponse.json({error:"Student not found."},{status:404});
 const canReadInstitutionStudents=await operatorHasPermissions(w,["people.person.read"]);
 if(!canReadInstitutionStudents){
  const {data:link,error:linkError}=await admin.from("identity_person_links").select("person_id").eq("tenant_id",w.tenantId).eq("identity_id",w.identityId).eq("link_type","employee").eq("status","verified").limit(1).maybeSingle();
  if(linkError)return NextResponse.json({error:"Unable to verify teaching scope."},{status:500});
  if(!link)return NextResponse.json({error:"Student not found."},{status:404});
  const {data:assignment,error:assignmentError}=await admin.from("timetable_entries").select("id").eq("tenant_id",w.tenantId).eq("branch_id",w.branchId).eq("teacher_person_id",link.person_id).eq("group_id",enrollment.group_id).eq("status","active").limit(1).maybeSingle();
  if(assignmentError)return NextResponse.json({error:"Unable to verify teaching scope."},{status:500});
  if(!assignment)return NextResponse.json({error:"Student not found."},{status:404});
 }
 const {data:person,error:personError}=await admin.from("persons").select("photo_storage_path").eq("tenant_id",w.tenantId).eq("id",personId).maybeSingle();
 if(personError)return NextResponse.json({error:"Unable to load student photo."},{status:500});
 const path=person?.photo_storage_path;
 if(typeof path!=="string"||!path)return NextResponse.json({error:"Student photo not available."},{status:404});
 const signed=await admin.storage.from("tenant-documents").createSignedUrl(path,60);
 if(signed.error||!signed.data.signedUrl)return NextResponse.json({error:"Unable to load student photo."},{status:500});
 return NextResponse.redirect(signed.data.signedUrl,{status:307});
}
