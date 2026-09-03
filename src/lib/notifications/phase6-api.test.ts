import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path:string){return readFileSync(resolve(process.cwd(),path),"utf8");}
const readRoute=source("src/app/api/portal/notifications/read/route.ts");
const pushRoute=source("src/app/api/portal/push/route.ts");
const noticeRoute=source("src/app/api/portals/notices/route.ts");
const center=source("src/components/portal-notification-center.tsx");
const worker=source("public/portal-sw.js");
const portalPage=source("src/app/portal/page.tsx");

describe("Phase 6 portal notification API and UI boundaries",()=>{
  it("protects notification read mutations with same-origin bounded JSON and verified identity",()=>{
    expect(readRoute).toContain("isSameOriginRequest(request)");
    expect(readRoute).toContain("isJsonRequest(request)");
    expect(readRoute).toContain("readBoundedJson(request)");
    expect(readRoute).toContain("getVerifiedIdentity()");
    expect(readRoute).toContain('admin.rpc("mark_portal_notification_read_v1"');
  });

  it("does not expose push subscription registration without verified portal tenancy",()=>{
    expect(pushRoute).toContain('from("identity_person_links")');
    expect(pushRoute).toContain('.eq("identity_id", identityId)');
    expect(pushRoute).toContain('.eq("status", "verified")');
    expect(pushRoute).toContain('admin.rpc("upsert_portal_push_subscription_v1"');
    expect(pushRoute).toContain('createHash("sha256").update(endpoint).digest("hex")');
  });

  it("keeps browser push disabled until a sender and VAPID keys are configured",()=>{
    expect(pushRoute).toContain('process.env.WEB_PUSH_DELIVERY_ENABLED === "1"');
    expect(pushRoute).toContain("WEB_PUSH_VAPID_PRIVATE_KEY");
    expect(pushRoute).toContain("NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY");
    expect(pushRoute).toContain("publicKey: deliveryConfigured ?");
  });

  it("requests notification permission only from the explicit Enable push action",()=>{
    expect(center).toContain("async function enablePush()");
    expect(center).toContain("await Notification.requestPermission()");
    expect(center).toContain('onClick={enablePush}');
    expect(center.indexOf("Notification.requestPermission()")).toBeGreaterThan(center.indexOf("async function enablePush()"));
    expect(center).not.toContain("useEffect(");
  });

  it("shows unread state priority source time and relevant links in the portal",()=>{
    expect(center).toContain("unreadCount");
    expect(center).toContain("priorityLabel(item.priority)");
    expect(center).toContain("item.sourceModule");
    expect(center).toContain("new Date(item.sentAt).toLocaleString()");
    expect(center).toContain("Mark read");
    expect(center).toContain("<Link");
    expect(portalPage).toContain("<PortalNotificationCenter tenantId={tenantId} initial={notifications}/>");
  });

  it("limits push notification clicks to the same application origin",()=>{
    expect(worker).toContain("candidate.origin === self.location.origin");
    expect(worker).toContain('new URL("/portal", self.location.origin)');
    expect(worker).toContain("self.clients.openWindow(target.href)");
  });

  it("validates operator-selected priority before publishing v2 notices",()=>{
    expect(noticeRoute).toContain('priority!=="normal"&&priority!=="important"&&priority!=="urgent"');
    expect(noticeRoute).toContain("publishPortalNotice({audienceType,title,body:noticeBody,priority:");
  });
});
