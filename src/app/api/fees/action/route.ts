import {NextResponse} from "next/server";
import {collectStudentFeePayment,postStudentFeeCharge,reverseStudentFeePayment} from "@/lib/finance/workspace";
import {isJsonRequest,isSameOriginRequest,readBoundedJson} from "@/lib/security/request";
import {getVerifiedIdentity} from "@/lib/supabase/identity";
import {getTenantContext} from "@/lib/tenancy/context";

type Raw=Record<string,unknown>;
const object=(value:unknown):Raw=>value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:{};
const positiveId=(value:unknown)=>{const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null;};
const positiveAmount=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)&&n>0?Math.round(n*100)/100:null;};
const nonnegativeAmount=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)&&n>=0?Math.round(n*100)/100:null;};
const boundedText=(value:unknown,max:number)=>typeof value==="string"?value.trim().slice(0,max):"";
const requestKey=(value:unknown)=>{const key=boundedText(value,128);return key.length>=16?key:null;};

function errorResponse(error:unknown){
 const message=error instanceof Error?error.message:"Unable to update student fees.";
 const lower=message.toLowerCase();
 if(lower.includes("permission denied")||lower.includes("permission required"))return NextResponse.json({error:"Finance permission required."},{status:403});
 if(lower.includes("not found")||lower.includes("active branch student")||lower.includes("active branch enrollment"))return NextResponse.json({error:message},{status:404});
 if(lower.includes("conflict")||lower.includes("already")||lower.includes("cannot exceed")||lower.includes("no outstanding")||lower.includes("does not apply")||lower.includes("published fee structure")||lower.includes("not part of"))return NextResponse.json({error:message},{status:409});
 return NextResponse.json({error:message},{status:400});
}

export async function POST(request:Request){
 if(!isSameOriginRequest(request))return NextResponse.json({error:"Cross-origin mutation blocked."},{status:403});
 if(!isJsonRequest(request))return NextResponse.json({error:"JSON request required."},{status:415});
 const parsed=await readBoundedJson(request,8192);if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const workspace=await getTenantContext();if(!workspace||workspace.identityId!==identity.id||!workspace.branchId)return NextResponse.json({error:"Active branch membership required."},{status:403});
 const body=object(parsed.value);const action=boundedText(body.action,40);const idempotencyKey=requestKey(body.idempotencyKey);
 if(!idempotencyKey)return NextResponse.json({error:"A valid request key is required."},{status:400});
 try{
  if(action==="collect_payment"){
   const studentPersonId=positiveId(body.studentPersonId),amount=positiveAmount(body.amount),currencyCode=boundedText(body.currencyCode,3).toUpperCase(),mode=boundedText(body.mode,32),providerReference=boundedText(body.providerReference,160)||null;
   if(!studentPersonId||!amount||!/^[A-Z]{3}$/.test(currencyCode))return NextResponse.json({error:"Student, positive amount, and currency are required."},{status:400});
   const result=await collectStudentFeePayment({studentPersonId,amount,currencyCode,mode,providerReference,idempotencyKey});
   return NextResponse.json({result},{status:200,headers:{"cache-control":"no-store"}});
  }
  if(action==="reverse_payment"){
   const paymentId=positiveId(body.paymentId),reason=boundedText(body.reason,1000),refundMethod=boundedText(body.refundMethod,80);
   if(!paymentId||reason.length<4||!refundMethod)return NextResponse.json({error:"Payment, refund method, and a clear reversal reason are required."},{status:400});
   const result=await reverseStudentFeePayment({paymentId,reason,refundMethod,idempotencyKey});
   return NextResponse.json({result},{status:200,headers:{"cache-control":"no-store"}});
  }
  if(action==="post_charge"){
   const studentPersonId=positiveId(body.studentPersonId),feeAssignmentId=positiveId(body.feeAssignmentId),feeItemId=positiveId(body.feeItemId),periodKey=boundedText(body.periodKey,80),chargeDate=boundedText(body.chargeDate,10),dueDate=boundedText(body.dueDate,10),concessionAmount=nonnegativeAmount(body.concessionAmount);
   if(!studentPersonId||!feeAssignmentId||!feeItemId||!periodKey||!/^\d{4}-\d{2}-\d{2}$/.test(chargeDate)||!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||concessionAmount===null)return NextResponse.json({error:"Valid charge configuration is required."},{status:400});
   const result=await postStudentFeeCharge({studentPersonId,feeAssignmentId,feeItemId,periodKey,chargeDate,dueDate,concessionAmount,idempotencyKey});
   return NextResponse.json({result},{status:200,headers:{"cache-control":"no-store"}});
  }
  return NextResponse.json({error:"Unsupported fee action."},{status:400});
 }catch(error){return errorResponse(error);}
}
