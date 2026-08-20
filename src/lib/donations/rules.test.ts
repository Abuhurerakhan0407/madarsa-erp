import { describe, expect, it } from "vitest";
import { canContactDonor, donationCanPost, sponsorSafeImpact, validateFundUse } from "./rules";

describe("donation rules", () => {
  it("blocks restricted-purpose misuse", () => {
    expect(validateFundUse(
      { id: "zakat", restricted: true, allowedPurposeKeys: ["eligible_support"], availableMinor: 100000n },
      { fundId: "zakat", purposeKey: "building", amountMinor: 5000n }
    )).toContain("restricted_purpose_not_allowed");
  });
  it("filters sensitive sponsor data", () => {
    expect(sponsorSafeImpact({ attendancePercent: 94, hifzMilestone: "Juz 1", familyNotes: "private", financialNeed: "private" })).toEqual({ attendancePercent: 94, hifzMilestone: "Juz 1" });
  });
  it("honors donor consent", () => {
    expect(canContactDonor("granted", "active")).toBe(true);
    expect(canContactDonor("granted", "do_not_contact")).toBe(false);
  });
  it("requires verified online donations", () => {
    expect(donationCanPost("razorpay", false, true)).toBe(false);
    expect(donationCanPost("razorpay", true, true)).toBe(true);
    expect(donationCanPost("in_kind", true, true)).toBe(false);
  });
});
