import {cache} from "react";
import type {Locale} from "@/lib/i18n/config";
import {createClient} from "@/lib/supabase/server";
import {getTenantContext} from "@/lib/tenancy/context";

function localizedLabel(labels:unknown,locale:Locale,fallback:string):string{
 if(!labels||typeof labels!=="object"||Array.isArray(labels))return fallback;
 const map=labels as Record<string,unknown>;
 const value=map[locale]??map.en??map.ur;
 return typeof value==="string"&&value.trim()?value.trim():fallback;
}

async function resolveCurrentAcademicSessionLabel(locale:Locale):Promise<string|null>{
 const workspace=await getTenantContext();
 if(!workspace)return null;
 const supabase=await createClient();
 const{data,error}=await supabase
  .from("academic_sessions")
  .select("key,labels")
  .eq("tenant_id",workspace.tenantId)
  .eq("status","active")
  .order("starts_on",{ascending:false})
  .limit(1)
  .maybeSingle();
 if(error)throw new Error(`Unable to load active academic session: ${error.message}`);
 if(!data)return null;
 return localizedLabel(data.labels,locale,String(data.key));
}

export const getCurrentAcademicSessionLabel=cache(resolveCurrentAcademicSessionLabel);
