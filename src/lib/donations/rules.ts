import type { Fund, FundUse, SponsorImpact, SponsorSource } from "./model";

export function validateFundUse(fund: Fund, use: FundUse): string[] {
  const issues: string[] = [];
  if (fund.id !== use.fundId) issues.push("fund_mismatch");
  if (use.amountMinor <= 0n) issues.push("amount_must_be_positive");
  if (fund.restricted && !fund.allowedPurposeKeys.includes(use.purposeKey)) issues.push("restricted_purpose_not_allowed");
  if (use.amountMinor > fund.availableMinor) issues.push("insufficient_fund_balance");
  return issues;
}

export function sponsorSafeImpact(source: SponsorSource): SponsorImpact {
  const result: SponsorImpact = {};
  if (source.attendancePercent !== undefined) result.attendancePercent = source.attendancePercent;
  if (source.academicGrade !== undefined) result.academicGrade = source.academicGrade;
  if (source.hifzMilestone !== undefined) result.hifzMilestone = source.hifzMilestone;
  return result;
}

export function canContactDonor(consent: "granted" | "denied" | "withdrawn" | "expired", donorState: "active" | "do_not_contact" | "merged" | "archived"): boolean {
  return consent === "granted" && donorState === "active";
}

export function donationCanPost(mode: string, signatureVerified: boolean, hasFund: boolean): boolean {
  if (!hasFund) return false;
  if (mode === "in_kind") return false;
  return mode !== "razorpay" || signatureVerified;
}
