import Link from "next/link";
import type { SupportedLocale } from "@/lib/i18n/config";
import type { PortalGuardianFeeRow } from "@/lib/portal/fees";

const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
}).format(value);

const copy = {
  en: {
    kicker: "Fees & payments",
    title: "Balance & receipts",
    body: "Only fees for students linked to this verified guardian account are shown.",
    gross: "Fee",
    concession: "Concession",
    paid: "Paid",
    outstanding: "Outstanding",
    due: "Due",
    receipts: "Receipts",
    openReceipt: "Open receipt",
    noPayments: "No payment recorded yet."
  },
  ur: {
    kicker: "فیس اور ادائیگیاں",
    title: "بقایا اور رسیدیں",
    body: "صرف اس تصدیق شدہ سرپرست اکاؤنٹ سے منسلک طلبہ کی فیس دکھائی جاتی ہے۔",
    gross: "فیس",
    concession: "رعایت",
    paid: "ادا شدہ",
    outstanding: "بقایا",
    due: "آخری تاریخ",
    receipts: "رسیدیں",
    openReceipt: "رسید کھولیں",
    noPayments: "ابھی کوئی ادائیگی درج نہیں ہوئی۔"
  }
} as const;

export function PortalParentFees({
  tenantId,
  locale,
  rows
}: {
  tenantId: number;
  locale: SupportedLocale;
  rows: PortalGuardianFeeRow[];
}) {
  if (!rows.length) return null;
  const t = copy[locale];

  return <section className="professional-card" data-testid="parent-portal-fees">
    <div className="section-heading">
      <div>
        <p className="state-kicker">{t.kicker}</p>
        <h2>{t.title}</h2>
        <p>{t.body}</p>
      </div>
    </div>
    <div className="flow-stack">
      {rows.map((row) => <article className="demo-card" key={row.assignmentId}>
        <div className="section-heading">
          <div>
            <p className="state-kicker">{row.studentNumber} · {row.branchName}</p>
            <h3>{row.studentName}</h3>
            <p>{row.feeName} · {t.due}: {row.dueDate}</p>
          </div>
          <span className="status-chip">{row.state}</span>
        </div>
        <div className="metric-grid">
          <div><small>{t.gross}</small><strong>{money(row.gross)}</strong></div>
          <div><small>{t.concession}</small><strong>{money(row.concession)}</strong></div>
          <div><small>{t.paid}</small><strong>{money(row.paid)}</strong></div>
          <div><small>{t.outstanding}</small><strong>{money(row.outstanding)}</strong></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <strong>{t.receipts}</strong>
          {row.payments.length ? <div className="flow-stack" style={{ marginTop: 8 }}>
            {row.payments.map((payment) => <div className="row-between" key={payment.id}>
              <p>{payment.paymentDate} · {money(payment.amount)} · {payment.receiptNumber}</p>
              <Link
                className="action-button"
                href={`/portal/fees/receipt/${payment.id}?tenant=${tenantId}&locale=${locale}`}
                target="_blank"
              >{t.openReceipt}</Link>
            </div>)}
          </div> : <p>{t.noPayments}</p>}
        </div>
      </article>)}
    </div>
  </section>;
}
