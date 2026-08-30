"use client";

export function PrintAction({label}:{label:string}){
  return <button className="action-button" type="button" onClick={()=>window.print()}>{label}</button>;
}
