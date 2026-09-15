import type { SupportedLocale } from "@/lib/i18n/config";
import { formatPortalDate } from "@/lib/portal/locale";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

type Raw = Record<string, unknown>;
const obj = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const rows = (value: unknown): Raw[] => Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Raw[] : [];
const text = (value: unknown) => typeof value === "string" ? value : "";
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

const copy = {
  en: {
    kicker: "Attendance",
    title: "Attendance summary",
    body: "Only students linked to this verified guardian account are included.",
    today: "Today",
    seven: "7 days",
    thirty: "30 days",
    noTrend: "No attendance trend recorded yet.",
    recent: "Recent attendance",
    emergency: "Emergency manual",
    manual: "Manual",
    biometric: "Biometric",
    legacyDevice: "Legacy device",
    imported: "Imported",
    device: "Device",
    present: "Present",
    absent: "Absent",
    late: "Late",
    leave: "Leave",
    excused: "Excused",
    unmarked: "Unmarked"
  },
  ur: {
    kicker: "حاضری",
    title: "حاضری کا خلاصہ",
    body: "صرف وہ طلبہ شامل ہیں جو اس تصدیق شدہ سرپرست اکاؤنٹ سے منسلک ہیں۔",
    today: "آج",
    seven: "7 دن",
    thirty: "30 دن",
    noTrend: "ابھی حاضری کا رجحان درج نہیں ہوا۔",
    recent: "حالیہ حاضری",
    emergency: "ہنگامی دستی اندراج",
    manual: "دستی",
    biometric: "بایومیٹرک",
    legacyDevice: "پرانا ڈیوائس",
    imported: "درآمد شدہ",
    device: "ڈیوائس",
    present: "حاضر",
    absent: "غیر حاضر",
    late: "تاخیر",
    leave: "رخصت",
    excused: "اجازت یافتہ",
    unmarked: "درج نہیں"
  }
} as const;

function sourceLabel(row: Raw, locale: SupportedLocale) {
  const t = copy[locale];
  const value = text(row.source).toLowerCase();
  if (value === "manual" && text(row.source_ref).startsWith("emergency:")) return t.emergency;
  if (value === "manual") return t.manual;
  if (value === "biometric") return t.biometric;
  if (value === "nfc") return t.legacyDevice;
  if (value === "import") return t.imported;
  return value ? t.device : "—";
}

function statusLabel(value: string, locale: SupportedLocale) {
  const t = copy[locale];
  const key = value.toLowerCase() as keyof typeof t;
  return key in t ? t[key] : t.unmarked;
}

export async function PortalAttendanceV2Section({ tenantId, locale }: { tenantId: number; locale: SupportedLocale }) {
  const identity = await getVerifiedIdentity();
  if (!identity) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_portal_attendance_v2_v1", { p_identity_id: identity.id, p_tenant_id: tenantId });
  if (error) {
    if (error.message.toLowerCase().includes("guardian")) return null;
    throw new Error(`Unable to load portal attendance: ${error.message}`);
  }
  const children = rows(obj(data).children);
  if (!children.length) return null;
  const t = copy[locale];

  return (
    <section className="professional-card">
      <div className="section-heading"><div><p className="state-kicker">{t.kicker}</p><h2>{t.title}</h2><p>{t.body}</p></div></div>
      <div className="flow-stack">
        {children.map((child) => (
          <article className="demo-card" key={num(child.person_id)}>
            <div className="section-heading">
              <div><p className="state-kicker">{text(child.student_number)}</p><h3>{text(child.display_name)}</h3></div>
              <div className="quick-actions"><span className="status-pill">{t.today} {num(child.daily_percent)}%</span><span className="status-pill">{t.seven} {num(child.weekly_percent)}%</span><span className="status-pill">{t.thirty} {num(child.monthly_percent)}%</span></div>
            </div>
            {rows(child.trend).length ? <div className="demo-card-grid">{rows(child.trend).slice(-7).map((point) => <div key={text(point.date)}><small>{formatPortalDate(point.date, locale)}</small><strong style={{ display: "block" }}>{num(point.attendance_percent)}%</strong></div>)}</div> : <p>{t.noTrend}</p>}
            {rows(child.recent).length ? <div style={{ marginTop: 12 }}><strong>{t.recent}</strong>{rows(child.recent).slice(0, 5).map((item, index) => <p key={`${text(item.attendance_date)}:${index}`}>{formatPortalDate(item.attendance_date, locale)} · {statusLabel(text(item.status_category) || "unmarked", locale)} · {sourceLabel(item, locale)}</p>)}</div> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
