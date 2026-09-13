"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import type {WorkspaceChoice} from "@/lib/tenancy/context";

type Props={choices:WorkspaceChoice[];membershipId:number;branchId:number;label:string};
export function WorkspaceSwitcher({choices,membershipId,branchId,label}:Props){
 const router=useRouter();const[busy,setBusy]=useState(false);const[error,setError]=useState<string|null>(null);const current=`${membershipId}:${branchId}`;
 if(choices.length<=1)return null;
 async function select(value:string){const[membership,branch]=value.split(":").map(Number);if(!Number.isSafeInteger(membership)||!Number.isSafeInteger(branch)||value===current)return;setBusy(true);setError(null);try{const response=await fetch("/api/workspace/select",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({membershipId:membership,branchId:branch})});const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error||"Unable to switch workspace.");router.refresh();}catch(caught){setError(caught instanceof Error?caught.message:"Unable to switch workspace.");}finally{setBusy(false);}}
 return <div className="workspace-switcher"><label className="field-label"><span>{label}</span><select className="text-field" value={current} disabled={busy} onChange={event=>void select(event.target.value)}>{choices.map(choice=><option key={`${choice.membershipId}:${choice.branchId}`} value={`${choice.membershipId}:${choice.branchId}`}>{choice.tenantName} · {choice.branchName}</option>)}</select></label>{error?<small role="alert">{error}</small>:null}</div>;
}
