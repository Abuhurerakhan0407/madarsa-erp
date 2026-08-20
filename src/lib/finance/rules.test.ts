import { describe, expect, it } from "vitest";
import { allocateOldestFirst, canPostOnlinePayment, outstandingMinor, validateJournal, validateReversal } from "./rules";

describe("finance rules", () => {
  it("requires exact double-entry balance", () => {
    expect(validateJournal([
      { accountId: "cash", debitMinor: 10000n, creditMinor: 0n },
      { accountId: "fees", debitMinor: 0n, creditMinor: 10000n }
    ])).toEqual([]);
    expect(validateJournal([{ accountId: "cash", debitMinor: 10000n, creditMinor: 0n }])).toContain("journal_not_balanced");
  });

  it("rejects browser redirects as payment proof", () => {
    expect(canPostOnlinePayment({ mode: "razorpay", signatureVerified: false, source: "browser_redirect" })).toBe(false);
    expect(canPostOnlinePayment({ mode: "razorpay", providerEventId: "evt_1", signatureVerified: true, source: "verified_webhook" })).toBe(true);
  });

  it("allocates oldest charges deterministically", () => {
    expect(allocateOldestFirst(12000n, [
      { chargeId: "new", dueOn: "2026-09-01", outstandingMinor: 10000n },
      { chargeId: "old", dueOn: "2026-08-01", outstandingMinor: 5000n }
    ])).toEqual([
      { chargeId: "old", amountMinor: 5000n },
      { chargeId: "new", amountMinor: 7000n }
    ]);
  });

  it("explains balances and caps reversals", () => {
    expect(outstandingMinor(20000n, 1000n, 5000n)).toBe(16000n);
    expect(validateReversal(10000n, 8000n, 3000n, "duplicate receipt")).toContain("reversal_exceeds_original");
  });
});
