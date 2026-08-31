import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";

type Raw=Record<string,unknown>;
const obj=(v:unknown):Raw=>v&&typeof v==="object"&&!Array.isArray(v)?v as Raw:{};
const rows=(v:unknown):Raw[]=>Array.isArray(v)?v.filter((x)=>x&&typeof x==="object"&&!Array.isArray(x)) as Raw[]:[];
const num=(v:unknown):number=>Number(v)||0;
const nullableNum=(v:unknown):number|null=>v===null||v===undefined?null:Number(v)||null;
const text=(v:unknown):string=>typeof v==="string"?v:"";
const nullableText=(v:unknown):string|null=>typeof v==="string"&&v.trim()?v:null;
const label=(v:unknown):string=>{const x=obj(v);return text(x.en)||text(x.ur)||text(x.ar)||"—";};

export type HostelResidentCenter={
 hostels:Array<{id:number;key:string;label:string;wardenPersonId:number|null;wardenName:string|null;state:string;bedCount:number;availableBeds:number}>;
 beds:Array<{id:number;hostelId:number;buildingKey:string;floorKey:string|null;roomKey:string;bedKey:string;category:string|null;state:string;hostelLabel:string;activeAllocationId:number|null}>;
 allocations:Array<{id:number;bedId:number;studentPersonId:number;enrollmentId:number;startsOn:string;endsOn:string|null;state:string;displayName:string;studentNumber:string|null;buildingKey:string;floorKey:string|null;roomKey:string;bedKey:string;hostelLabel:string}>;
 students:Array<{personId:number;enrollmentId:number;displayName:string;studentNumber:string|null}>;
 employees:Array<{personId:number;displayName:string;employeeNumber:string|null;designationKey:string|null}>;
};
async function workspace(){const w=await getTenantContext();if(!w||!w.branchId)throw new Error("Active branch is required.");return w;}
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{const admin=createAdminClient();const{data,error}=await admin.rpc(name,args);if(error)throw new Error(error.message);return data as T;}
export async function getHostelResidentCenter():Promise<HostelResidentCenter>{const w=await workspace();const d=obj(await rpc<unknown>("get_hostel_resident_center_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId}));return{
 hostels:rows(d.hostels).map(x=>({id:num(x.id),key:text(x.key),label:label(x.labels),wardenPersonId:nullableNum(x.warden_person_id),wardenName:nullableText(x.warden_name),state:text(x.state),bedCount:num(x.bed_count),availableBeds:num(x.available_beds)})),
 beds:rows(d.beds).map(x=>({id:num(x.id),hostelId:num(x.hostel_id),buildingKey:text(x.building_key),floorKey:nullableText(x.floor_key),roomKey:text(x.room_key),bedKey:text(x.bed_key),category:nullableText(x.category),state:text(x.state),hostelLabel:text(x.hostel_label),activeAllocationId:nullableNum(x.active_allocation_id)})),
 allocations:rows(d.allocations).map(x=>({id:num(x.id),bedId:num(x.bed_id),studentPersonId:num(x.student_person_id),enrollmentId:num(x.enrollment_id),startsOn:text(x.starts_on),endsOn:nullableText(x.ends_on),state:text(x.state),displayName:text(x.display_name),studentNumber:nullableText(x.student_number),buildingKey:text(x.building_key),floorKey:nullableText(x.floor_key),roomKey:text(x.room_key),bedKey:text(x.bed_key),hostelLabel:text(x.hostel_label)})),
 students:rows(d.students).map(x=>({personId:num(x.person_id),enrollmentId:num(x.enrollment_id),displayName:text(x.display_name),studentNumber:nullableText(x.student_number)})),
 employees:rows(d.employees).map(x=>({personId:num(x.person_id),displayName:text(x.display_name),employeeNumber:nullableText(x.employee_number),designationKey:nullableText(x.designation_key)}))
};}
export async function createHostel(input:{key:string;label:string;wardenPersonId:number|null}){const w=await workspace();return rpc("create_hostel_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_key:input.key,p_labels:{en:input.label},p_warden_person_id:input.wardenPersonId});}
export async function addHostelBed(input:{hostelId:number;buildingKey:string;floorKey:string|null;roomKey:string;bedKey:string;category:string|null}){const w=await workspace();return rpc("add_hostel_bed_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_hostel_id:input.hostelId,p_building_key:input.buildingKey,p_floor_key:input.floorKey,p_room_key:input.roomKey,p_bed_key:input.bedKey,p_category:input.category});}
export async function allocateHostelBed(input:{studentPersonId:number;bedId:number;startsOn:string;endsOn:string|null}){const w=await workspace();return rpc("allocate_hostel_bed_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_student_person_id:input.studentPersonId,p_bed_id:input.bedId,p_starts_on:input.startsOn,p_ends_on:input.endsOn});}
export async function vacateHostelAllocation(input:{allocationId:number;endsOn:string|null;reason:string|null}){const w=await workspace();return rpc("vacate_hostel_allocation_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_allocation_id:input.allocationId,p_ends_on:input.endsOn,p_reason:input.reason});}
