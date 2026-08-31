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

export type TransportCenter={
 vehicles:Array<{id:number;registrationNumber:string;ownership:string;capacity:number;driverPersonId:number|null;helperPersonId:number|null;driverName:string|null;helperName:string|null;state:string;assignedCount:number}>;
 routes:Array<{id:number;vehicleId:number;key:string;label:string;effectiveFrom:string;effectiveTo:string|null;state:string;registrationNumber:string;capacity:number;stopCount:number;assignedCount:number}>;
 stops:Array<{id:number;routeId:number;key:string;label:string;sequence:number;pickupTime:string|null;dropTime:string|null;assignedCount:number}>;
 assignments:Array<{id:number;studentPersonId:number;enrollmentId:number;routeId:number;stopId:number;startsOn:string;endsOn:string|null;state:string;displayName:string;studentNumber:string|null;routeLabel:string;stopLabel:string;registrationNumber:string}>;
 students:Array<{personId:number;enrollmentId:number;displayName:string;studentNumber:string|null}>;
 employees:Array<{personId:number;displayName:string;employeeNumber:string|null;designationKey:string|null}>;
};

async function workspace(){const w=await getTenantContext();if(!w||!w.branchId)throw new Error("Active branch is required.");return w;}
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{const admin=createAdminClient();const{data,error}=await admin.rpc(name,args);if(error)throw new Error(error.message);return data as T;}

export async function getTransportCenter():Promise<TransportCenter>{
 const w=await workspace();const data=obj(await rpc<unknown>("get_transport_center_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId}));
 return {
  vehicles:rows(data.vehicles).map(x=>({id:num(x.id),registrationNumber:text(x.registration_number),ownership:text(x.ownership),capacity:num(x.capacity),driverPersonId:nullableNum(x.driver_person_id),helperPersonId:nullableNum(x.helper_person_id),driverName:nullableText(x.driver_name),helperName:nullableText(x.helper_name),state:text(x.state),assignedCount:num(x.assigned_count)})),
  routes:rows(data.routes).map(x=>({id:num(x.id),vehicleId:num(x.vehicle_id),key:text(x.key),label:label(x.labels),effectiveFrom:text(x.effective_from),effectiveTo:nullableText(x.effective_to),state:text(x.state),registrationNumber:text(x.registration_number),capacity:num(x.capacity),stopCount:num(x.stop_count),assignedCount:num(x.assigned_count)})),
  stops:rows(data.stops).map(x=>({id:num(x.id),routeId:num(x.route_id),key:text(x.key),label:label(x.labels),sequence:num(x.sequence),pickupTime:nullableText(x.pickup_time),dropTime:nullableText(x.drop_time),assignedCount:num(x.assigned_count)})),
  assignments:rows(data.assignments).map(x=>({id:num(x.id),studentPersonId:num(x.student_person_id),enrollmentId:num(x.enrollment_id),routeId:num(x.route_id),stopId:num(x.stop_id),startsOn:text(x.starts_on),endsOn:nullableText(x.ends_on),state:text(x.state),displayName:text(x.display_name),studentNumber:nullableText(x.student_number),routeLabel:label(x.route_labels),stopLabel:label(x.stop_labels),registrationNumber:text(x.registration_number)})),
  students:rows(data.students).map(x=>({personId:num(x.person_id),enrollmentId:num(x.enrollment_id),displayName:text(x.display_name),studentNumber:nullableText(x.student_number)})),
  employees:rows(data.employees).map(x=>({personId:num(x.person_id),displayName:text(x.display_name),employeeNumber:nullableText(x.employee_number),designationKey:nullableText(x.designation_key)}))
 };
}

export async function createTransportVehicle(input:{registrationNumber:string;ownership:string;capacity:number;driverPersonId:number|null;helperPersonId:number|null}){const w=await workspace();return rpc("create_transport_vehicle_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_registration_number:input.registrationNumber,p_ownership:input.ownership,p_capacity:input.capacity,p_driver_person_id:input.driverPersonId,p_helper_person_id:input.helperPersonId});}
export async function createTransportRoute(input:{vehicleId:number;key:string;label:string;effectiveFrom:string;effectiveTo:string|null}){const w=await workspace();return rpc("create_transport_route_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_vehicle_id:input.vehicleId,p_key:input.key,p_labels:{en:input.label},p_effective_from:input.effectiveFrom,p_effective_to:input.effectiveTo});}
export async function addTransportStop(input:{routeId:number;key:string;label:string;sequence:number;pickupTime:string|null;dropTime:string|null}){const w=await workspace();return rpc("add_transport_stop_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_route_id:input.routeId,p_key:input.key,p_labels:{en:input.label},p_sequence:input.sequence,p_pickup_time:input.pickupTime,p_drop_time:input.dropTime});}
export async function assignStudentTransport(input:{studentPersonId:number;routeId:number;stopId:number;startsOn:string;endsOn:string|null}){const w=await workspace();return rpc("assign_student_transport_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_student_person_id:input.studentPersonId,p_route_id:input.routeId,p_stop_id:input.stopId,p_starts_on:input.startsOn,p_ends_on:input.endsOn});}
export async function endStudentTransport(input:{assignmentId:number;endsOn:string|null}){const w=await workspace();return rpc("end_student_transport_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_assignment_id:input.assignmentId,p_ends_on:input.endsOn});}
