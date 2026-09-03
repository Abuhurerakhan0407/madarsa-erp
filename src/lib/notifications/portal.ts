import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

type Raw = Record<string, unknown>;
const object = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const rows = (value: unknown): Raw[] => Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Raw[] : [];
const text = (value: unknown): string => typeof value === "string" ? value : "";
const number = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;

export type PortalNotificationPriority = "normal" | "important" | "urgent";
export type PortalNotificationItem = {
  id: number;
  eventId: number;
  eventKey: string;
  priority: PortalNotificationPriority;
  sourceModule: string;
  title: Record<string, unknown>;
  body: Record<string, unknown>;
  link: string | null;
  sentAt: string;
  isRead: boolean;
};
export type PortalNotificationCenter = { unreadCount: number; items: PortalNotificationItem[] };

export async function getPortalNotificationCenter(tenantId: number): Promise<PortalNotificationCenter> {
  const identity = await getVerifiedIdentity();
  if (!identity) throw new Error("Authentication required.");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_portal_notification_center_v1", {
    p_identity_id: identity.id,
    p_tenant_id: tenantId,
    p_limit: 50
  });
  if (error) throw new Error(error.message);
  const raw = object(data);
  return {
    unreadCount: number(raw.unread_count),
    items: rows(raw.items).flatMap((row) => {
      const id = number(row.id);
      const sentAt = text(row.sent_at);
      if (!id || !sentAt) return [];
      const priority = text(row.priority);
      return [{
        id,
        eventId: number(row.event_id),
        eventKey: text(row.event_key),
        priority: priority === "urgent" || priority === "important" ? priority : "normal",
        sourceModule: text(row.source_module) || "Institution",
        title: object(row.title),
        body: object(row.body),
        link: text(row.link) || null,
        sentAt,
        isRead: Boolean(row.is_read)
      }];
    })
  };
}
