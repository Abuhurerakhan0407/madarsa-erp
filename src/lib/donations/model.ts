export type Fund = { id: string; restricted: boolean; allowedPurposeKeys: readonly string[]; availableMinor: bigint };
export type FundUse = { fundId: string; purposeKey: string; amountMinor: bigint };
export type SponsorSource = {
  attendancePercent?: number;
  academicGrade?: string;
  hifzMilestone?: string;
  familyNotes?: string;
  financialNeed?: string;
  healthNotes?: string;
  disciplinaryNotes?: string;
  privateTeacherNotes?: string;
};
export type SponsorImpact = Pick<SponsorSource, "attendancePercent" | "academicGrade" | "hifzMilestone">;
