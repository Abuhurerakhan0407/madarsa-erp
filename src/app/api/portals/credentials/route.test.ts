import {beforeEach,describe,expect,it,vi} from "vitest";

const state=vi.hoisted(()=>({
  existingIdentity:"" as string,
  rpc:vi.fn(),
  createUser:vi.fn(),
  updateUserById:vi.fn(),
  deleteUser:vi.fn(),
  from:vi.fn()
}));

vi.mock("@/lib/supabase/identity",()=>({getVerifiedIdentity:vi.fn(async()=>({id:"11111111-1111-1111-1111-111111111111"}))}));
vi.mock("@/lib/tenancy/context",()=>({getTenantContext:vi.fn(async()=>({identityId:"11111111-1111-1111-1111-111111111111",tenantId:22,branchId:33}))}));
vi.mock("@/lib/portal/runtime",()=>({getPortalOperatorCenter:vi.fn(async()=>({parents:[{personId:44,email:"guardian@example.test"}],teachers:[],accessCodes:[],notices:[]}))}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({
  rpc:state.rpc,
  from:state.from,
  auth:{admin:{createUser:state.createUser,updateUserById:state.updateUserById,deleteUser:state.deleteUser}}
})}));

import {POST} from "./route";

function request(action:"reset"|"provision"){
  return new Request("http://localhost/api/portals/credentials",{
    method:"POST",
    headers:{"content-type":"application/json",origin:"http://localhost"},
    body:JSON.stringify({personId:44,kind:"guardian",action})
  });
}

function linksQuery(data:unknown[]=[]){
  const chain={
    select:vi.fn(()=>chain),
    eq:vi.fn(()=>chain),
    order:vi.fn(()=>chain),
    limit:vi.fn(async()=>({data,error:null}))
  };
  return chain;
}

describe("portal credential security",()=>{
  beforeEach(()=>{
    state.existingIdentity="";
    state.rpc.mockReset();state.createUser.mockReset();state.updateUserById.mockReset();state.deleteUser.mockReset();state.from.mockReset();
    state.from.mockReturnValue(linksQuery([]));
    state.rpc.mockImplementation(async(name:string)=>{
      if(name==="operator_has_permission_v1")return{data:true,error:null};
      if(name==="record_portal_credential_audit_v1")return{data:true,error:null};
      if(name==="find_auth_identity_by_email_v1")return{data:state.existingIdentity||null,error:null};
      if(name==="link_portal_identity_v1")return{data:{state:"verified"},error:null};
      throw new Error(`Unexpected RPC ${name}`);
    });
  });

  it("never lets an institution operator reset a shared Auth password",async()=>{
    const response=await POST(request("reset"));
    const body=await response.json();
    expect(response.status).toBe(409);
    expect(body.error).toMatch(/account owner.*verified account recovery/i);
    expect(state.updateUserById).not.toHaveBeenCalled();
    expect(state.createUser).not.toHaveBeenCalled();
    expect(state.rpc.mock.calls.some(([name])=>name==="link_portal_identity_v1")).toBe(false);
  });

  it("requires owner claim instead of auto-linking an existing global identity",async()=>{
    state.existingIdentity="22222222-2222-2222-2222-222222222222";
    const response=await POST(request("provision"));
    const body=await response.json();
    expect(response.status).toBe(409);
    expect(body.credentialState).toBe("owner_claim_required");
    expect(state.createUser).not.toHaveBeenCalled();
    expect(state.updateUserById).not.toHaveBeenCalled();
    expect(state.rpc.mock.calls.some(([name])=>name==="link_portal_identity_v1")).toBe(false);
  });

  it("still provisions a genuinely new portal identity and links only that new identity",async()=>{
    state.createUser.mockResolvedValue({data:{user:{id:"33333333-3333-3333-3333-333333333333"}},error:null});
    const response=await POST(request("provision"));
    const body=await response.json();
    expect(response.status).toBe(201);
    expect(body.credentialState).toBe("temporary_password_created");
    expect(state.createUser).toHaveBeenCalledTimes(1);
    expect(state.updateUserById).not.toHaveBeenCalled();
    const linkCall=state.rpc.mock.calls.find(([name])=>name==="link_portal_identity_v1");
    expect(linkCall?.[1]?.p_portal_identity_id).toBe("33333333-3333-3333-3333-333333333333");
  });
});
