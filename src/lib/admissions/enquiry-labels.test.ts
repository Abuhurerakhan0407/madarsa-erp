import { describe, expect, it } from "vitest";
import { admissionStateLabel, enquiryChannelLabel, enquiryStatusLabel } from "./enquiry-labels";

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
  });
});
