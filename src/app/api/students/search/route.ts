import { NextResponse } from "next/server";
import { getStudentRegister } from "@/lib/students/register";
import { isLocale } from "@/lib/i18n/config";

export async function GET(request:Request){
 const url=new URL(request.url);const query=(url.searchParams.get("q")??"").trim().slice(0,100);const requestedLocale=url.searchParams.get("locale")??"en";const locale=isLocale(requestedLocale)?requestedLocale:"en";
 if(query.length<2)return NextResponse.json({results:[]},{headers:{"cache-control":"no-store"}});
 try{
  const data=await getStudentRegister({locale,query,status:"all",page:1,pageSize:8});
  return NextResponse.json({results:data.rows.map(row=>({personId:row.personId,name:row.name,nativeName:row.nativeName,studentNumber:row.studentNumber,status:row.status,program:row.program,group:row.group}))},{headers:{"cache-control":"no-store"}});
 }catch(error){
  const message=error instanceof Error?error.message:"Student search failed.";
  if(message.toLowerCase().includes("permission")||message.toLowerCase().includes("active branch"))return NextResponse.json({error:"Student search is not available for this account."},{status:403,headers:{"cache-control":"no-store"}});
  return NextResponse.json({error:"Unable to search students."},{status:500,headers:{"cache-control":"no-store"}});
 }
}
