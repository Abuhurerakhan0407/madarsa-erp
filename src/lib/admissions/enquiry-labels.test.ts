import { describe, expect, it } from "vitest";
import {
  admissionDecisionOutcomeLabel,
  admissionDecisionOutcomes,
  admissionReviewOutcomeLabel,
  admissionReviewOutcomes,
  admissionReviewTypeLabel,
  admissionReviewTypes,
  admissionStateLabel,
  admissionStates,
  enquiryChannelLabel,
  enquiryStatusLabel
} from "./enquiry-labels";

describe("enquiry labels", () => {
  it("localizes enquiry states and channels", () => {
    expect(enquiryStatusLabel("ur", "qualified")).toBe("اہل");
    expect(enquiryStatusLabel("ar", "converted")).toBe("تم التحويل إلى طالب");
    expect(enquiryChannelLabel("ur", "in_person")).toBe("بالمشافہ");
    expect(admissionStateLabel("ar", "enrolled")).toBe("مسجّل");
  });

  it("preserves unknown future values instead of hiding them", () => {
    expect(enquiryStatusLabel("en", "future_state")).toBe("future_state");
    expect(enquiryChannelLabel("ar", "future_channel")).toBe("future_channel");
    expect(admissionStateLabel("ur", "future_state")).toBe("future_state");
    expect(admissionReviewTypeLabel("ar", "future_review")).toBe("future_review");
    expect(admissionReviewOutcomeLabel("ur", "future_outcome")).toBe("future_outcome");
    expect(admissionDecisionOutcomeLabel("en", "future_decision")).toBe("future_decision");
  });

  it("localizes every database-supported admission enum in every locale", () => {
    for (const locale of ["en", "ur", "ar"] as const) {
      for (const state of admissionStates) expect(admissionStateLabel(locale, state)).not.toBe(state);
      for (const reviewType of admissionReviewTypes) expect(admissionReviewTypeLabel(locale, reviewType)).not.toBe(reviewType);
      for (const outcome of admissionReviewOutcomes) expect(admissionReviewOutcomeLabel(locale, outcome)).not.toBe(outcome);
      for (const outcome of admissionDecisionOutcomes) expect(admissionDecisionOutcomeLabel(locale, outcome)).not.toBe(outcome);
    }
  });
});
