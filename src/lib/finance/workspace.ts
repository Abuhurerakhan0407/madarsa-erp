import {createAdminClient} from "@/lib/supabase/admin";
import {getTenantContext} from "@/lib/tenancy/context";

type Raw=Record<string,unknown>;
const object=(value:unknown):Raw=>value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:{};
const rows=(value:unknown):Raw[]=>Array.isArray(value)?value.filter((item)=>item&&typeof item==="object"&&!Array.isArray(item)) as Raw[]:[];
const text=(value:unknown):string|null=>typeof value==="string"&&value.trim()?value:null;
const number=(value:unknown):number|null=>Number.isFinite(Number(value))?Number(value):null;

export type FeeStudent={personId:number;studentNumber:string;name:string;enrollmentId:number;groupId:number|null;programId:number|null;levelId:number|null};
export type FeeCharge={id:number;feeItemId:number;feeItemKey:string;feeItemLabels:Raw;periodKey:string;chargeDate:string;dueDate:string;currencyCode:string;grossAmount:number;concessionAmount:number;fineAmount:number;netAmount:number;adjustmentAmount:number;writeOffAmount:number;allocatedAmount:number;reversedAllocationAmount:number;outstandingAmount:number;state:string};
export type FeeReceipt={receiptNumber:string;revision:number;state:string;verificationCode:string;issuedAt:string};
export type FeePayment={id:number;paymentDate:string;currencyCode:string;amount:number;mode:string;providerReference:string|null;state:string;allocatedAmount:number;reversedAmount:number;effectiveAmount:number;receipt:FeeReceipt|null;createdAt:string};
export type FeeStructure={id:number;key:string;version:number;currencyCode:string;frequency:string;effectiveFrom:string;effectiveTo:string|null;state:string};
export type FeeChargeOption={assignmentId:number;structureKey:string;structureVersion:number;currencyCode:string;frequency:string;feeItemId:number;feeItemKey:string;feeItemLabels:Raw;amount:number;sequence:number};
export type StudentFeeWorkspace={students:FeeStudent[];selectedStudentPersonId:number|null;publishedStructures:FeeStructure[];charges:FeeCharge[];payments:FeePayment[];feeConfigurationReady:boolean;chargeOptions:FeeChargeOption[]};

async function rpc(name:string,args:Raw={}){
 const workspace=await getTenantContext();
 if(!workspace||!workspace.branchId)throw new Error("Active branch is required.");
 const admin=createAdminClient();
 const{data,error}=await admin.rpc(name,{p_identity_id:workspace.identityId,p_tenant_id:workspace.tenantId,p_branch_id:workspace.branchId,...args});
 if(error)throw new Error(error.message);
 return data;
}

function parseReceipt(value:unknown):FeeReceipt|null{
 const row=object(value);const receiptNumber=text(row.receipt_number),revision=number(row.revision),verificationCode=text(row.verification_code),issuedAt=text(row.issued_at);
 if(!receiptNumber||!revision||!verificationCode||!issuedAt)return null;
 return{receiptNumber,revision,state:text(row.state)??"issued",verificationCode,issuedAt};
}
function parseChargeOptions(value:unknown):FeeChargeOption[]{return rows(value).flatMap(row=>{const assignmentId=number(row.assignment_id),structureKey=text(row.structure_key),structureVersion=number(row.structure_version),currencyCode=text(row.currency_code),feeItemId=number(row.fee_item_id),feeItemKey=text(row.fee_item_key);if(!assignmentId||!structureKey||!structureVersion||!currencyCode||!feeItemId||!feeItemKey)return[];return[{assignmentId,structureKey,structureVersion,currencyCode,frequency:text(row.frequency)??"manual",feeItemId,feeItemKey,feeItemLabels:object(row.fee_item_labels),amount:number(row.amount)??0,sequence:number(row.sequence)??0}];});}

export async function getStudentFeeWorkspace(studentPersonId?:number|null):Promise<StudentFeeWorkspace>{
 const raw=object(await rpc("get_student_fee_workspace_v1",{p_student_person_id:studentPersonId??null}));
 const chargeOptions=studentPersonId?parseChargeOptions(await rpc("get_student_fee_charge_options_v1",{p_student_person_id:studentPersonId})):[];
 return{
  students:rows(raw.students).flatMap(row=>{const personId=number(row.person_id),enrollmentId=number(row.enrollment_id),studentNumber=text(row.student_number),name=text(row.name);return personId&&enrollmentId&&studentNumber&&name?[{personId,enrollmentId,studentNumber,name,groupId:number(row.group_id),programId:number(row.program_id),levelId:number(row.level_id)}]:[];}),
  selectedStudentPersonId:number(raw.selected_student_person_id),
  publishedStructures:rows(raw.published_structures).flatMap(row=>{const id=number(row.id),key=text(row.key),version=number(row.version),currencyCode=text(row.currency_code),effectiveFrom=text(row.effective_from);return id&&key&&version&&currencyCode&&effectiveFrom?[{id,key,version,currencyCode,frequency:text(row.frequency)??"manual",effectiveFrom,effectiveTo:text(row.effective_to),state:text(row.state)??"published"}]:[];}),
  charges:rows(raw.charges).flatMap(row=>{const id=number(row.id),feeItemId=number(row.fee_item_id),periodKey=text(row.period_key),chargeDate=text(row.charge_date),dueDate=text(row.due_date),currencyCode=text(row.currency_code);if(!id||!feeItemId||!periodKey||!chargeDate||!dueDate||!currencyCode)return[];return[{id,feeItemId,feeItemKey:text(row.fee_item_key)??`fee_${feeItemId}`,feeItemLabels:object(row.fee_item_labels),periodKey,chargeDate,dueDate,currencyCode,grossAmount:number(row.gross_amount)??0,concessionAmount:number(row.concession_amount)??0,fineAmount:number(row.fine_amount)??0,netAmount:number(row.net_amount)??0,adjustmentAmount:number(row.adjustment_amount)??0,writeOffAmount:number(row.write_off_amount)??0,allocatedAmount:number(row.allocated_amount)??0,reversedAllocationAmount:number(row.reversed_allocation_amount)??0,outstandingAmount:number(row.outstanding_amount)??0,state:text(row.state)??"posted"}];}),
  payments:rows(raw.payments).flatMap(row=>{const id=number(row.id),paymentDate=text(row.payment_date),currencyCode=text(row.currency_code),createdAt=text(row.created_at);if(!id||!paymentDate||!currencyCode||!createdAt)return[];return[{id,paymentDate,currencyCode,amount:number(row.amount)??0,mode:text(row.mode)??"custom",providerReference:text(row.provider_reference),state:text(row.state)??"pending",allocatedAmount:number(row.allocated_amount)??0,reversedAmount:number(row.reversed_amount)??0,effectiveAmount:number(row.effective_amount)??0,receipt:parseReceipt(row.receipt),createdAt}];}),
  feeConfigurationReady:raw.fee_configuration_ready===true,
  chargeOptions
 };
}

export async function postStudentFeeCharge(input:{studentPersonId:number;feeAssignmentId:number;feeItemId:number;periodKey:string;chargeDate:string;dueDate:string;concessionAmount:number;idempotencyKey:string}){return object(await rpc("post_student_fee_charge_serialized_v1",{p_student_person_id:input.studentPersonId,p_fee_assignment_id:input.feeAssignmentId,p_fee_item_id:input.feeItemId,p_period_key:input.periodKey,p_charge_date:input.chargeDate,p_due_date:input.dueDate,p_concession_amount:input.concessionAmount,p_idempotency_key:input.idempotencyKey}));}
export async function collectStudentFeePayment(input:{studentPersonId:number;amount:number;currencyCode:string;mode:string;providerReference?:string|null;idempotencyKey:string}){return object(await rpc("collect_student_fee_payment_serialized_v1",{p_student_person_id:input.studentPersonId,p_amount:input.amount,p_currency_code:input.currencyCode,p_mode:input.mode,p_provider_reference:input.providerReference??null,p_idempotency_key:input.idempotencyKey}));}
export async function reverseStudentFeePayment(input:{paymentId:number;reason:string;refundMethod:string;idempotencyKey:string}){return object(await rpc("reverse_student_fee_payment_serialized_v1",{p_payment_id:input.paymentId,p_reason:input.reason,p_refund_method:input.refundMethod,p_idempotency_key:input.idempotencyKey}));}
