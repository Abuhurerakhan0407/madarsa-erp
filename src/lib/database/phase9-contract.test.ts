import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = readFileSync(new URL("../../../database/contracts/phase9_finance.sql", import.meta.url), "utf8");

const tables = [
  "chart_accounts", "fiscal_periods", "journals", "journal_lines", "cash_bank_accounts",
  "fee_items", "fee_structure_versions", "fee_structure_items", "fee_assignments",
  "fee_concessions", "fee_charges", "fee_adjustments", "fee_invoices", "fee_invoice_lines",
  "payments", "payment_events", "payment_allocations", "payment_receipts", "receipt_reversals",
  "payment_refunds", "fee_write_offs", "bank_reconciliations", "bank_reconciliation_items"
] as const;

describe("Phase 9 database contract", () => {
  it("declares fees, collection, and ledger records", () => {
    for (const table of tables) expect(contract).toContain(`create table public.${table}`);
  });
  it("prevents duplicate charges and provider events", () => {
    expect(contract).toContain("unique (tenant_id, fee_assignment_id, fee_item_id, period_key)");
    expect(contract).toContain("payment_events_provider_event_idx");
  });
  it("requires verified online settlement", () => {
    expect(contract).toContain("verification_source = 'verified_webhook'");
    expect(contract).toContain("signature_verified boolean not null default false");
  });
  it("checks balance and closed periods before posting", () => {
    expect(contract).toContain("journal_not_balanced");
    expect(contract).toContain("fiscal_period_closed");
  });
  it("keeps browser writes closed", () => {
    expect(contract).not.toMatch(/grant\s+(insert|update|delete|all)/i);
  });
});
