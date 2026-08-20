import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = readFileSync(new URL("../../../database/contracts/phase10_donations.sql", import.meta.url), "utf8");
const tables = ["funds","fund_transfers","donors","donor_consents","donation_categories","donation_campaigns","donations","donation_events","donation_receipts","donation_receipt_reversals","in_kind_donations","sponsorship_agreements","sponsorship_beneficiaries","sponsorship_schedules","sponsorship_allocations","sponsor_impact_updates"] as const;

describe("Phase 10 database contract", () => {
  it("declares funds, donations, and sponsorship records", () => {
    for (const table of tables) expect(contract).toContain(`create table public.${table}`);
  });
  it("keeps tax claims outside unapproved scope", () => {
    expect(contract).toContain("tax_claim_status = 'not_implemented'");
  });
  it("prevents anonymous beneficiary ambiguity", () => {
    expect(contract).toContain("num_nonnulls(student_person_id, program_id, pool_key) = 1");
  });
  it("keeps browser writes closed", () => {
    expect(contract).not.toMatch(/grant\s+(insert|update|delete|all)/i);
  });
});
