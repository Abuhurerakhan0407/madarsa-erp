import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";

type Raw=Record<string,unknown>;
const obj=(v:unknown):Raw=>v&&typeof v==="object"&&!Array.isArray(v)?v as Raw:{};
const rows=(v:unknown):Raw[]=>Array.isArray(v)?v.filter(x=>x&&typeof x==="object"&&!Array.isArray(x)) as Raw[]:[];
const num=(v:unknown):number|null=>Number.isFinite(Number(v))?Number(v):null;
const text=(v:unknown):string|null=>typeof v==="string"&&v.trim()?v:null;
const bool=(v:unknown)=>v===true;
async function ws(){const w=await getTenantContext();if(!w||!w.branchId)throw new Error("Active branch is required.");return w;}
async function rpc(name:string,args:Raw){const admin=createAdminClient();const{data,error}=await admin.rpc(name,args);if(error)throw new Error(error.message);return data;}

export type HostelMessCenter={
 permissions:{resident:boolean;security:boolean;mess:boolean};
 hostels:Array<{id:number;key:string;label:string;wardenName:string|null;state:string;bedCount:number;availableCount:number}>;
 beds:Array<{id:number;hostelId:number;hostelLabel:string;buildingKey:string;floorKey:string|null;roomKey:string;bedKey:string;category:string|null;state:string}>;
 allocations:Array<{id:number;bedId:number;studentPersonId:number;displayName:string;studentNumber:string|null;hostelLabel:string;buildingKey:string;roomKey:string;bedKey:string;startsOn:string;endsOn:string|null;state:string}>;
 students:Array<{personId:number;enrollmentId:number;displayName:string;studentNumber:string|null}>;
 visitors:Array<{id:number;allocationId:number;residentName:string;purpose:string;checkedInAt:string;checkedOutAt:string|null}>;
 incidents:Array<{id:number;allocationId:number|null;residentName:string|null;category:string;severity:string;state:string;occurredAt:string}>;
 messUnits:Array<{id:number;key:string;label:string;state:string}>;
 mealServices:Array<{id:number;messUnitId:number;unitLabel:string;mealType:string;servingDate:string;expectedCount:number|null;servedCount:number;state:string}>;
 mealAttendance:Array<{id:number;mealServiceId:number;personId:number|null;displayName:string|null;servedCount:number;mealType:string;servingDate:string}>;
 mealPeople:Array<{personId:number;displayName:string;personType:string}>;
};

export async function getHostelMessCenter():Promise<HostelMessCenter>{
 const w=await ws();const d=obj(await rpc("get_hostel_mess_center_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId}));const p=obj(d.permissions);
 return{
  permissions:{resident:bool(p.resident),security:bool(p.security),mess:bool(p.mess)},
  hostels:rows(d.hostels).map(x=>({id:num(x.id)!,key:text(x.key)??"",label:text(x.label)??"Hostel",wardenName:text(x.warden_name),state:text(x.state)??"",bedCount:num(x.bed_count)??0,availableCount:num(x.available_count)??0})),
  beds:rows(d.beds).map(x=>({id:num(x.id)!,hostelId:num(x.hostel_id)!,hostelLabel:text(x.hostel_label)??"Hostel",buildingKey:text(x.building_key)??"",floorKey:text(x.floor_key),roomKey:text(x.room_key)??"",bedKey:text(x.bed_key)??"",category:text(x.category),state:text(x.state)??""})),
  allocations:rows(d.allocations).map(x=>({id:num(x.id)!,bedId:num(x.bed_id)!,studentPersonId:num(x.student_person_id)!,displayName:text(x.display_name)??"Student",studentNumber:text(x.student_number),hostelLabel:text(x.hostel_label)??"Hostel",buildingKey:text(x.building_key)??"",roomKey:text(x.room_key)??"",bedKey:text(x.bed_key)??"",startsOn:text(x.starts_on)??"",endsOn:text(x.ends_on),state:text(x.state)??""})),
  students:rows(d.students).map(x=>({personId:num(x.person_id)!,enrollmentId:num(x.enrollment_id)!,displayName:text(x.display_name)??"Student",studentNumber:text(x.student_number)})),
  visitors:rows(d.visitors).map(x=>({id:num(x.id)!,allocationId:num(x.allocation_id)!,residentName:text(x.resident_name)??"Resident",visitorName:text(obj(x.visitor_identity_snapshot).name)??"Visitor",purpose:text(x.purpose)??"",checkedInAt:text(x.checked_in_at)??"",checkedOutAt:text(x.checked_out_at)})),
  incidents:rows(d.incidents).map(x=>({id:num(x.id)!,allocationId:num(x.allocation_id),residentName:text(x.resident_name),category:text(x.category)??"",severity:text(x.severity)??"",state:text(x.state)??"",occurredAt:text(x.occurred_at)??""})),
  messUnits:rows(d.mess_units).map(x=>({id:num(x.id)!,key:text(x.key)??"",label:text(x.label)??"Mess",state:text(x.state)??""})),
  mealServices:rows(d.meal_services).map(x=>({id:num(x.id)!,messUnitId:num(x.mess_unit_id)!,unitLabel:text(x.unit_label)??"Mess",mealType:text(x.meal_type)??"",servingDate:text(x.serving_date)??"",expectedCount:num(x.expected_count),servedCount:num(x.served_count)??0,state:text(x.state)??""})),
  mealAttendance:rows(d.meal_attendance).map(x=>({id:num(x.id)!,mealServiceId:num(x.meal_service_id)!,personId:num(x.person_id),displayName:text(x.display_name),servedCount:num(x.served_count)??0,mealType:text(x.meal_type)??"",servingDate:text(x.serving_date)??""})),
  mealPeople:rows(d.meal_people).map(x=>({personId:num(x.person_id)!,displayName:text(x.display_name)??"Person",personType:text(x.person_type)??"person"}))
 };
}

export async function createHostel(input:{key:string;label:string;wardenPersonId?:number|null}){const w=await ws();return rpc("create_hostel_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_key:input.key,p_labels:{en:input.label},p_warden_person_id:input.wardenPersonId??null,p_rules:{}});}
export async function addHostelBed(input:{hostelId:number;buildingKey:string;floorKey?:string|null;roomKey:string;bedKey:string;category?:string|null}){const w=await ws();return rpc("add_hostel_bed_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_hostel_id:input.hostelId,p_building_key:input.buildingKey,p_floor_key:input.floorKey??null,p_room_key:input.roomKey,p_bed_key:input.bedKey,p_category:input.category??null});}
export async function allocateHostelBed(input:{studentPersonId:number;bedId:number;startsOn:string;endsOn?:string|null}){const w=await ws();return rpc("allocate_hostel_bed_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_student_person_id:input.studentPersonId,p_bed_id:input.bedId,p_starts_on:input.startsOn,p_ends_on:input.endsOn??null});}
export async function vacateHostelAllocation(input:{allocationId:number;endsOn:string}){const w=await ws();return rpc("vacate_hostel_allocation_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_allocation_id:input.allocationId,p_ends_on:input.endsOn,p_clearance:{status:"recorded"}});}
export async function checkInHostelVisitor(input:{allocationId:number;visitorName:string;purpose:string}){const w=await ws();return rpc("check_in_hostel_visitor_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_allocation_id:input.allocationId,p_visitor_snapshot:{name:input.visitorName},p_purpose:input.purpose,p_restriction_flags:{}});}
export async function checkOutHostelVisitor(visitorId:number){const w=await ws();return rpc("check_out_hostel_visitor_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_visitor_id:visitorId});}
export async function recordHostelIncident(input:{allocationId?:number|null;category:string;severity:string;summary:string}){const w=await ws();return rpc("record_hostel_incident_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_allocation_id:input.allocationId??null,p_category:input.category,p_severity:input.severity,p_restricted_details:{summary:input.summary},p_action_summary:{status:"recorded"}});}
export async function createMessUnit(input:{key:string;label:string}){const w=await ws();return rpc("create_mess_unit_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_key:input.key,p_labels:{en:input.label}});}
export async function createMealService(input:{messUnitId:number;mealType:string;servingDate:string;expectedCount?:number|null}){const w=await ws();return rpc("create_mess_meal_service_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_mess_unit_id:input.messUnitId,p_meal_type:input.mealType,p_serving_date:input.servingDate,p_expected_count:input.expectedCount??null});}
export async function recordMealAttendance(input:{mealServiceId:number;personId:number;servedCount:number;requestKey:string}){const w=await ws();return rpc("record_mess_attendance_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_meal_service_id:input.mealServiceId,p_person_id:input.personId,p_served_count:input.servedCount,p_request_key:input.requestKey});}
export async function closeMealService(mealServiceId:number){const w=await ws();return rpc("close_mess_meal_service_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_meal_service_id:mealServiceId});}
